"use server";
// Acciones de la interfaz pública (P07 a P13).
import { redirect } from "next/navigation";
import { aResultado } from "@/lib/errores";
import { desdeLocal } from "@/lib/tiempo";
import { leerConfig } from "@/lib/config";
import { abrirHistorial, cerrarHistorial, guardarClienta, olvidarClienta, sesionClienta, sesionHistorial } from "@/lib/sesion";
import { mostrarWhatsApp } from "@/lib/telefono";
import { clientaPorId, identificar, solicitarCodigo, validarCodigo } from "@/modulos/clientas";
import { registrarSolicitudCurso, registrarSolicitudServicio } from "@/modulos/solicitudes";
import { cambiarCarrito, crearPedido } from "@/modulos/pedidos";
import type { EstadoForm } from "@/componentes/Formulario";

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
/** Cantidad del carrito: entero de min a 99; con letras, decimales o negativos se usa el valor por defecto. */
const cantidadSegura = (v: FormDataEntryValue | null, porDefecto: number, min = 1) => {
  const t = String(v ?? "").trim();
  if (!/^\d{1,3}$/.test(t)) return porDefecto;
  return Math.min(99, Math.max(min, Number(t)));
};

/** Toma la clienta de la sesión o registra sus datos desde el formulario (RN-07.1, RN-08.1). */
async function clientaDelFormulario(fd: FormData) {
  const s = await sesionClienta();
  if (s && !fd.get("nombre")) return s.cid;
  const c = await identificar(txt(fd, "nombre"), txt(fd, "whatsapp"), fd.get("acepta") === "on");
  await guardarClienta({ cid: c.id, nombre: c.nombre, whatsapp: c.whatsapp });
  return c.id;
}

/**
 * Antes de enviar una solicitud se confirma que el número de WhatsApp es de la clienta, con el mismo método del historial:
 * código de 6 dígitos por WhatsApp (CU-05 y CU-06). Si ya lo confirmó hace poco en esta visita, no se vuelve a pedir.
 * Devuelve null cuando el número está confirmado; si no, el estado que el formulario muestra (pide o revisa el código).
 */
async function confirmarNumero(fd: FormData, clienteId: string): Promise<EstadoForm> {
  const h = await sesionHistorial();
  if (h && h.cid === clienteId) return null;
  const cli = await clientaPorId(clienteId);
  if (!cli) return { ok: false, error: "No encontramos tus datos. Vuelve a escribirlos." };
  const cfg = await leerConfig();
  const codigo = txt(fd, "codigo");
  if (!codigo || txt(fd, "paso") === "reenviar") {
    const r = await solicitarCodigo(cli.whatsapp);
    if (!r.ok) return { ok: false, error: r.mensaje };
    return {
      ok: true,
      pedirCodigo: true,
      mensaje: `Para confirmar que el número es tuyo, te enviamos un código de 6 dígitos por WhatsApp al ${mostrarWhatsApp(cli.whatsapp)}. Escríbelo abajo y vuelve a enviar. Vale ${cfg.codigo_vigencia_min} minutos.`,
    };
  }
  try {
    const c = await validarCodigo(cli.whatsapp, codigo);
    await abrirHistorial({ cid: c.id, whatsapp: c.whatsapp }, Number(cfg.historial_inactividad_min));
    return null;
  } catch (e) {
    return { ...aResultado(e), pedirCodigo: true };
  }
}

export async function accionIdentificarse(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const c = await identificar(txt(fd, "nombre"), txt(fd, "whatsapp"), fd.get("acepta") === "on");
    await guardarClienta({ cid: c.id, nombre: c.nombre, whatsapp: c.whatsapp });
  } catch (e) {
    return aResultado(e);
  }
  const destino = txt(fd, "siguiente");
  redirect(destino.startsWith("/") ? destino : "/");
}

export async function accionOlvidarme() {
  await olvidarClienta();
  redirect("/");
}

export async function accionSolicitarServicio(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: number;
  try {
    const clienteId = await clientaDelFormulario(fd);
    const pendiente = await confirmarNumero(fd, clienteId);
    if (pendiente) return pendiente;
    const fotos = fd.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);
    id = await registrarSolicitudServicio({
      clienteId,
      servicioId: Number(fd.get("servicio_id")),
      inicio: desdeLocal(txt(fd, "inicio")),
      descripcion: txt(fd, "descripcion"),
      fueraLocal: txt(fd, "lugar") === "domicilio",
      direccion: txt(fd, "direccion"),
      referencia: txt(fd, "referencia"),
      fotos,
    });
  } catch (e) {
    return aResultado(e);
  }
  redirect(`/solicitar/listo?id=${id}`);
}

export async function accionSolicitarCurso(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: number;
  try {
    const clienteId = await clientaDelFormulario(fd);
    const pendiente = await confirmarNumero(fd, clienteId);
    if (pendiente) return pendiente;
    const inicio = txt(fd, "inicio");
    id = await registrarSolicitudCurso({
      clienteId,
      cursoId: Number(fd.get("curso_id")),
      inicio: inicio ? desdeLocal(inicio) : undefined,
      sesionId: fd.get("sesion_id") ? Number(fd.get("sesion_id")) : undefined,
      descripcion: txt(fd, "descripcion"),
    });
  } catch (e) {
    return aResultado(e);
  }
  redirect(`/solicitar/listo?id=${id}`);
}

export async function accionPedirCodigo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let w: string;
  try {
    w = txt(fd, "whatsapp");
    const r = await solicitarCodigo(w);
    if (!r.ok) return { ok: false, error: r.mensaje };
  } catch (e) {
    return aResultado(e);
  }
  redirect(`/historial/codigo?w=${encodeURIComponent(w)}`);
}

export async function accionValidarCodigo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const c = await validarCodigo(txt(fd, "whatsapp"), txt(fd, "codigo"));
    const cfg = await leerConfig();
    await abrirHistorial({ cid: c.id, whatsapp: c.whatsapp }, Number(cfg.historial_inactividad_min));
  } catch (e) {
    return aResultado(e);
  }
  redirect("/historial/mi");
}

export async function accionCerrarHistorial() {
  await cerrarHistorial();
  redirect("/historial");
}

// ---------- Catálogo, carrito y pedido (P14 a P18) ----------

async function clientaOIdentificar(siguiente: string) {
  const s = await sesionClienta();
  if (!s) redirect(`/identificarse?siguiente=${encodeURIComponent(siguiente)}`);
  return s;
}

export async function accionAgregarCarrito(fd: FormData) {
  const pid = Number(fd.get("producto_id"));
  if (!Number.isInteger(pid) || pid <= 0) redirect("/catalogo");
  const s = await clientaOIdentificar(`/catalogo/${pid}`);
  await cambiarCarrito(s.cid, pid, cantidadSegura(fd.get("cantidad"), 1), true);
  // «Agregar y seguir comprando» vuelve al catálogo para elegir otro producto; «Agregar y ver carrito» va al carrito.
  redirect(txt(fd, "ir") === "ver" ? "/carrito" : `/catalogo?agregado=${pid}#aviso-carrito`);
}

export async function accionCambiarCantidad(fd: FormData) {
  const s = await clientaOIdentificar("/carrito");
  const pid = Number(fd.get("producto_id"));
  if (Number.isInteger(pid) && pid > 0) await cambiarCarrito(s.cid, pid, cantidadSegura(fd.get("cantidad"), 1, 0));
  redirect("/carrito");
}

export async function accionCrearPedido(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: number;
  try {
    const s = await sesionClienta();
    if (!s) return { ok: false, error: "Identifícate para continuar." };
    id = await crearPedido(s.cid, { entrega: txt(fd, "lugar") === "domicilio" ? "delivery" : "retiro", direccion: txt(fd, "direccion"), referencia: txt(fd, "referencia") });
  } catch (e) {
    return aResultado(e);
  }
  redirect(`/pedido/${id}`);
}
