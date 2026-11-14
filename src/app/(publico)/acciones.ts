"use server";
// Acciones de la interfaz pública (P07 a P13).
import { redirect } from "next/navigation";
import { aResultado } from "@/lib/errores";
import { desdeLocal } from "@/lib/tiempo";
import { leerConfig } from "@/lib/config";
import { abrirHistorial, cerrarHistorial, guardarClienta, olvidarClienta, sesionClienta } from "@/lib/sesion";
import { identificar, solicitarCodigo, validarCodigo } from "@/modulos/clientas";
import { registrarSolicitudCurso, registrarSolicitudServicio } from "@/modulos/solicitudes";
import { cambiarCarrito, crearPedido } from "@/modulos/pedidos";
import type { EstadoForm } from "@/componentes/Formulario";

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Toma la clienta de la sesión o registra sus datos desde el formulario (RN-07.1, RN-08.1). */
async function clientaDelFormulario(fd: FormData) {
  const s = await sesionClienta();
  if (s && !fd.get("nombre")) return s.cid;
  const c = await identificar(txt(fd, "nombre"), txt(fd, "whatsapp"), fd.get("acepta") === "on");
  await guardarClienta({ cid: c.id, nombre: c.nombre, whatsapp: c.whatsapp });
  return c.id;
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
  const s = await clientaOIdentificar(`/catalogo/${pid}`);
  await cambiarCarrito(s.cid, pid, Math.max(1, Number(fd.get("cantidad") || 1)), true);
  redirect("/carrito");
}

export async function accionCambiarCantidad(fd: FormData) {
  const s = await clientaOIdentificar("/carrito");
  await cambiarCarrito(s.cid, Number(fd.get("producto_id")), Number(fd.get("cantidad")));
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
