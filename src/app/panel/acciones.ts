"use server";
// Acciones del panel de Andrea. Todas exigen la sesión de administradora (RN-02.4) y quedan en auditoría (RNF-08).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aResultado, ReglaError } from "@/lib/errores";
import { desdeLocal, fechaHora, moneda } from "@/lib/tiempo";
import { abrirSesionAdmin, cerrarPerfilClienta, cerrarSesionAdmin, sesionAdmin } from "@/lib/sesion";
import { q, pool } from "@/lib/db";
import { CONFIG_INICIAL, ClaveConfig } from "@/lib/config";
import { auditar, marcarLeidas, validarCredenciales } from "@/modulos/seguridad";
import { guardarCotizacion, rechazarOCancelar, registroDirecto, reprogramar, rechazarReprogramacion } from "@/modulos/solicitudes";
import { enviarAvisoConfirmacion, enviarCotizacion, registrarAvisoManual, registrarEnvioManual } from "@/modulos/whatsapp/servicio";
import { cargarComprobante, declararExpiracion, rechazarComprobante, registrarAtencion, registrarSaldo, validarAnticipoYConfirmar } from "@/modulos/pagos";
import { cancelarSesion, guardarCurso, guardarServicio, habilitarSesion, marcarSesionRealizada, programarSesion } from "@/modulos/catalogo";
import { ejecutarTareas } from "@/modulos/planificador";
import { guardarArchivo } from "@/lib/almacenamiento";
import { cambiarEntrega, cancelarPedido, confirmarYReservar, pedidoPorAndrea, registrarPagoPedido } from "@/modulos/pedidos";
import { eliminarGasto, guardarProducto, registrarAjuste, registrarEntrada, registrarGasto, registrarVentaDirecta } from "@/modulos/inventario";
import type { EstadoForm } from "@/componentes/Formulario";

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const v = txt(fd, k).replace(/,/g, "");
  return v === "" ? NaN : Number(v);
};

async function uid() {
  const s = await sesionAdmin();
  if (!s) throw new ReglaError("Tu sesión terminó. Vuelve a iniciar sesión.");
  return s.uid;
}

async function ejecutar(fn: () => Promise<string | void>, rutas: string[] = []): Promise<EstadoForm> {
  try {
    const mensaje = (await fn()) || "Listo.";
    for (const r of ["/panel", ...rutas]) revalidatePath(r, "layout");
    return { ok: true, mensaje };
  } catch (e) {
    return aResultado(e);
  }
}

// ---------- A01 Iniciar sesión (CU-10) ----------
export async function accionLogin(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const s = await validarCredenciales(txt(fd, "usuario"), String(fd.get("password") ?? ""));
  if (!s) {
    await new Promise((r) => setTimeout(r, 600)); // frena intentos repetidos
    return { ok: false, error: "Usuario o contraseña incorrectos." };
  }
  await abrirSesionAdmin(s);
  await cerrarPerfilClienta();
  await auditar(pool, s.uid, "Iniciar sesión", "usuario_admin", s.uid);
  const sig = txt(fd, "siguiente");
  redirect(sig.startsWith("/panel") ? sig : "/panel");
}

export async function accionLogout() {
  await cerrarSesionAdmin();
  await cerrarPerfilClienta();
  redirect("/panel/login");
}

// ---------- A05 Cotizar (CU-12) ----------
export async function accionCotizar(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const id = Number(fd.get("solicitud_id"));
    const traslado = txt(fd, "traslado_min");
    await guardarCotizacion(await uid(), id, num(fd, "precio_total"), Number(txt(fd, "duracion_min") || 180), traslado === "" ? null : Number(traslado));
    return "Cotización guardada. Todavía no se aparta el horario ni empieza el plazo: eso ocurre al enviarla.";
  }, ["/panel/solicitudes"]);
}

// ---------- A06 Enviar cotización (CU-14, CU-15) ----------
export async function accionEnviarCotizacion(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const r = await enviarCotizacion(await uid(), Number(fd.get("solicitud_id")));
    if (!r.ok) throw new ReglaError(`WhatsApp rechazó el envío: ${r.error}. El horario se liberó; puedes reintentar o usar el envío manual.`);
    return "Cotización en envío. El plazo de 24 horas empezará cuando WhatsApp informe que el mensaje fue enviado.";
  }, ["/panel/solicitudes"]);
}

export async function accionEnvioManual(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const plazo = await registrarEnvioManual(await uid(), Number(fd.get("solicitud_id")), desdeLocal(txt(fd, "enviado_en")));
    return `Envío manual registrado. El plazo de pago vence el ${fechaHora(plazo)}.`;
  }, ["/panel/solicitudes"]);
}

// ---------- A08 Comprobante y confirmación (CU-18, CU-19, CU-20) ----------
export async function accionCargarComprobante(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const archivo = fd.get("archivo");
    await cargarComprobante(await uid(), Number(fd.get("solicitud_id")), archivo instanceof File ? archivo : (null as never), num(fd, "monto"), desdeLocal(txt(fd, "pagado_en")));
    return "Comprobante cargado. Verifica el depósito antes de validarlo.";
  }, ["/panel/solicitudes"]);
}

export async function accionValidarComprobante(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const r = await validarAnticipoYConfirmar(await uid(), Number(fd.get("comprobante_id")));
    return r.aviso.ok
      ? "Anticipo validado y solicitud confirmada. El aviso de confirmación está en envío por WhatsApp."
      : `Anticipo validado y solicitud confirmada. El aviso por WhatsApp no se envió (${r.aviso.error}); la cita sigue confirmada.`;
  }, ["/panel/solicitudes", "/panel/agenda"]);
}

export async function accionRechazarComprobante(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await rechazarComprobante(await uid(), Number(fd.get("comprobante_id")), txt(fd, "motivo") || "No corresponde");
    return "Comprobante rechazado.";
  });
}

export async function accionReenviarAviso(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const r = await enviarAvisoConfirmacion(await uid(), Number(fd.get("solicitud_id")));
    if (!r.ok) throw new ReglaError(r.error);
    return "Aviso de confirmación en envío.";
  });
}

export async function accionAvisoManual(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await registrarAvisoManual(await uid(), Number(fd.get("solicitud_id")), desdeLocal(txt(fd, "enviado_en")));
    return "Aviso manual registrado.";
  });
}

// ---------- A09 Plazo vencido (CU-22) y A10 Rechazar o cancelar (CU-23) ----------
export async function accionExpirar(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await declararExpiracion(await uid(), Number(fd.get("solicitud_id")), txt(fd, "motivo"));
    return "Solicitud expirada. Se liberó su horario o cupo.";
  }, ["/panel/solicitudes", "/panel/agenda"]);
}

export async function accionRechazarCancelar(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const nuevo = await rechazarOCancelar(await uid(), Number(fd.get("solicitud_id")), txt(fd, "motivo"), txt(fd, "origen") === "clienta" ? "clienta" : "andrea");
    return nuevo === "Rechazada" ? "Solicitud rechazada." : "Solicitud cancelada. Se liberó su horario o cupo; los pagos registrados se conservan.";
  }, ["/panel/solicitudes", "/panel/agenda"]);
}

// ---------- A11 Registro directo (CU-24) ----------
export async function accionRegistroDirecto(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: number;
  try {
    const tipo = txt(fd, "tipo") === "curso" ? "curso" : "servicio";
    const inicio = txt(fd, "inicio");
    id = await registroDirecto(await uid(), {
      nombre: txt(fd, "nombre"), whatsapp: txt(fd, "whatsapp"), acepta: fd.get("acepta") === "on", tipo,
      servicioId: Number(fd.get("servicio_id")) || undefined, cursoId: Number(fd.get("curso_id")) || undefined, sesionId: Number(fd.get("sesion_id")) || undefined,
      inicio: inicio ? desdeLocal(inicio) : undefined, descripcion: txt(fd, "descripcion"), fueraLocal: txt(fd, "lugar") === "domicilio",
      direccion: txt(fd, "direccion"), referencia: txt(fd, "referencia"),
    });
  } catch (e) {
    return aResultado(e);
  }
  revalidatePath("/panel", "layout");
  redirect(`/panel/solicitudes/${id}`);
}

// ---------- Pedido registrado por Andrea a nombre de una clienta ----------
export async function accionPedidoPorClienta(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: number;
  try {
    const ids = fd.getAll("producto_id").map(Number);
    const cantidades = fd.getAll("cantidad").map(Number);
    id = await pedidoPorAndrea(await uid(), {
      nombre: txt(fd, "nombre"), whatsapp: txt(fd, "whatsapp"), acepta: fd.get("acepta") === "on",
      lineas: ids.map((productoId, i) => ({ productoId, cantidad: Number.isInteger(cantidades[i]) ? cantidades[i] : 0 })),
      entrega: txt(fd, "lugar") === "domicilio" ? "delivery" : "retiro", direccion: txt(fd, "direccion"), referencia: txt(fd, "referencia"),
    });
  } catch (e) {
    return aResultado(e);
  }
  revalidatePath("/panel", "layout");
  redirect(`/panel/pedidos/${id}`);
}

// ---------- A12 Reprogramar (CU-28) ----------
export async function accionReprogramar(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const inicio = txt(fd, "inicio");
    await reprogramar(await uid(), Number(fd.get("solicitud_id")), txt(fd, "motivo"), {
      inicio: inicio ? desdeLocal(inicio) : undefined,
      sesionId: Number(fd.get("sesion_id")) || undefined,
    });
    return "Reprogramada. Se conservó el anticipo y la fecha original quedó registrada.";
  }, ["/panel/agenda"]);
}

export async function accionRechazarReprogramacion(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await rechazarReprogramacion(await uid(), Number(fd.get("solicitud_id")), desdeLocal(txt(fd, "inicio")), txt(fd, "motivo"));
    return "Se registró el rechazo. La reserva original sigue vigente.";
  });
}

// ---------- A13 Atención y saldo (CU-27) ----------
export async function accionAtencion(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const r = txt(fd, "resultado") === "No asistida" ? "No asistida" : "Realizada";
    await registrarAtencion(await uid(), Number(fd.get("solicitud_id")), r);
    return r === "Realizada" ? "Atención registrada como realizada. Ahora registra el cobro del saldo." : "Inasistencia registrada; el anticipo queda retenido.";
  }, ["/panel/agenda"]);
}

export async function accionSaldo(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const r = await registrarSaldo(await uid(), Number(fd.get("solicitud_id")), num(fd, "monto"));
    return r.cerrada ? "Saldo cobrado. La atención quedó cerrada." : `Pago registrado. Falta ${moneda(r.saldoRestante)} para cerrar.`;
  });
}

// ---------- A15 Servicios y A16 Cursos y sesiones (CU-25, CU-26) ----------
export async function accionGuardarServicio(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const nombre = txt(fd, "nombre");
    if (nombre.length < 3) throw new ReglaError("Escribe el nombre del servicio.");
    const precio = txt(fd, "precio_base");
    await guardarServicio(await uid(), {
      id: Number(fd.get("id")) || undefined, nombre, descripcion: txt(fd, "descripcion") || nombre,
      precio_base: precio ? Number(precio) : null, imagen_url: txt(fd, "imagen_url") || null, activo: fd.get("activo") === "on",
    });
    return "Servicio guardado.";
  }, ["/", "/servicios"]);
}

export async function accionGuardarCurso(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const nombre = txt(fd, "nombre");
    if (nombre.length < 3) throw new ReglaError("Escribe el nombre del curso.");
    const precio = txt(fd, "precio_base");
    await guardarCurso(await uid(), {
      id: Number(fd.get("id")) || undefined, nombre, descripcion: txt(fd, "descripcion") || nombre,
      modalidad: txt(fd, "modalidad") === "grupal" ? "grupal" : "individual", precio_base: precio ? Number(precio) : null, activo: fd.get("activo") === "on",
    });
    return "Curso guardado.";
  }, ["/cursos"]);
}

export async function accionProgramarSesion(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await programarSesion(await uid(), Number(fd.get("curso_id")), desdeLocal(txt(fd, "inicio")), Number(fd.get("capacidad")), fd.get("habilitar") === "on");
    return "Sesión programada.";
  }, ["/cursos", "/panel/agenda"]);
}

export async function accionSesion(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const id = Number(fd.get("sesion_id"));
    const op = txt(fd, "op");
    if (op === "habilitar") {
      await habilitarSesion(await uid(), id);
      return "Sesión habilitada: su intervalo quedó apartado en la agenda.";
    }
    if (op === "realizada") {
      await marcarSesionRealizada(await uid(), id);
      return "Sesión marcada como realizada.";
    }
    const n = await cancelarSesion(await uid(), id, txt(fd, "motivo") || "Cancelada por Andrea");
    return `Sesión cancelada. Inscripciones canceladas: ${n}.`;
  }, ["/cursos", "/panel/agenda"]);
}

// ---------- Notificaciones, configuración y planificador ----------
export async function accionLeerNotificaciones(fd: FormData) {
  const s = await sesionAdmin();
  if (!s) return;
  const id = Number(fd.get("id"));
  await marcarLeidas(s.uid, id ? [id] : undefined);
  revalidatePath("/panel", "layout");
}

export async function accionGuardarConfig(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const id = await uid();
    for (const clave of Object.keys(CONFIG_INICIAL) as ClaveConfig[]) {
      const v = txt(fd, clave);
      if (!v) continue;
      if (!["datos_pago", "lugar_local", "whatsapp_negocio"].includes(clave) && !(Number(v) > 0)) throw new ReglaError(`Valor no válido para ${clave}.`);
      await q(
        "INSERT INTO configuracion (clave, valor, descripcion) VALUES ($1,$2,$3) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor",
        [clave, v.slice(0, 100), CONFIG_INICIAL[clave].descripcion],
      );
    }
    await auditar(pool, id, "Modificar configuración", "configuracion", null);
    return "Configuración guardada.";
  });
}

export async function accionEjecutarPlanificador() {
  return ejecutar(async () => {
    await uid();
    const r = await ejecutarTareas();
    return r ? `Planificador ejecutado: ${r.envios} envío(s) vencido(s), ${r.plazos} plazo(s) vencido(s), ${r.codigos} código(s) vencido(s), ${r.recordatorios} recordatorio(s).` : "El planificador ya se estaba ejecutando.";
  });
}

// ---------- A17 a A22: pedidos, inventario, ventas, gastos (CU-30 a CU-34) ----------
export async function accionConfirmarPedido(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const costo = txt(fd, "costo_entrega");
    await confirmarYReservar(await uid(), Number(fd.get("pedido_id")), costo === "" ? null : Number(costo));
    return "Pedido confirmado. Las unidades quedaron reservadas por 48 horas.";
  }, ["/panel/pedidos", "/panel/productos"]);
}

export async function accionPagoPedido(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await registrarPagoPedido(await uid(), Number(fd.get("pedido_id")));
    return "Pago registrado. El pedido ya no expira.";
  }, ["/panel/pedidos"]);
}

export async function accionEntregaPedido(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const r = await cambiarEntrega(await uid(), Number(fd.get("pedido_id")), txt(fd, "entrega"));
    return r.cerrado ? "Pedido entregado y cerrado: se registró la venta y la salida de inventario." : "Estado de entrega actualizado.";
  }, ["/panel/pedidos", "/panel/productos"]);
}

export async function accionCancelarPedido(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await cancelarPedido(await uid(), Number(fd.get("pedido_id")), txt(fd, "motivo"));
    return "Pedido cancelado y unidades liberadas.";
  }, ["/panel/pedidos", "/panel/productos"]);
}

export async function accionGuardarProducto(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const uidAdmin = await uid();
    // Foto: archivo nuevo > quitar la actual > conservar la actual.
    let foto_url: string | null = txt(fd, "foto_actual") || null;
    if (fd.get("quitar_foto") === "on") foto_url = null;
    const archivo = fd.get("foto");
    if (archivo instanceof File && archivo.size > 0) foto_url = `/api/imagenes/${(await guardarArchivo(archivo, "productos")).split("/")[1]}`;
    await guardarProducto(uidAdmin, {
      id: Number(fd.get("id")) || undefined, categoria_id: Number(fd.get("categoria_id")), nombre: txt(fd, "nombre"), descripcion: txt(fd, "descripcion") || null,
      foto_url, precio_venta: num(fd, "precio_venta"), stock_minimo: Number(txt(fd, "stock_minimo") || 0),
      visible_publico: fd.get("visible_publico") === "on", activo: fd.get("activo") === "on",
    });
    return "Producto guardado.";
  }, ["/panel/productos", "/catalogo"]);
}

export async function accionEntrada(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await registrarEntrada(await uid(), Number(fd.get("producto_id")), Number(fd.get("cantidad")), num(fd, "costo_unitario"), txt(fd, "motivo"));
    return "Entrada registrada.";
  }, ["/panel/productos"]);
}

export async function accionAjuste(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await registrarAjuste(await uid(), Number(fd.get("producto_id")), Number(fd.get("cantidad")), txt(fd, "tipo") === "Daño" ? "Daño" : "Corrección", txt(fd, "motivo"));
    return "Ajuste registrado.";
  }, ["/panel/productos"]);
}

export async function accionVentaDirecta(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    const ids = fd.getAll("producto_id").map(Number);
    const cant = fd.getAll("cantidad").map(Number);
    const r = await registrarVentaDirecta(await uid(), ids.map((productoId, i) => ({ productoId, cantidad: cant[i] || 0 })), txt(fd, "nota"));
    return `Venta #${r.ventaId} registrada por ${moneda(r.total)}. Se descontaron las existencias.`;
  }, ["/panel/ventas", "/panel/productos"]);
}

export async function accionGasto(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await registrarGasto(await uid(), { categoriaId: Number(fd.get("categoria_id")), concepto: txt(fd, "concepto"), monto: num(fd, "monto"), fecha: txt(fd, "fecha"), observacion: txt(fd, "observacion") });
    return "Gasto registrado.";
  }, ["/panel/gastos"]);
}

export async function accionEliminarGasto(_: EstadoForm, fd: FormData) {
  return ejecutar(async () => {
    await eliminarGasto(await uid(), Number(fd.get("gasto_id")));
    return "Gasto eliminado.";
  }, ["/panel/gastos"]);
}
