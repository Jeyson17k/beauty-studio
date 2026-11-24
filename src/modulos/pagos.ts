// MOD-05 Pagos y confirmación (CU-18, CU-19, CU-22, CU-27; RF-13, RF-14, RF-15, RF-31).
// El sistema no valida depósitos: la administradora comprueba el dinero y registra la validación (RN-13.4, RN-13.5).
import { q, q1, tx } from "@/lib/db";
import { ReglaError } from "@/lib/errores";
import { monto as validarMonto } from "@/lib/validar";
import { guardarArchivo } from "@/lib/almacenamiento";
import { confirmar, liberar } from "./agenda";
import { auditar } from "./seguridad";
import { SOL } from "./estados";
import { enviarAvisoConfirmacion } from "./whatsapp/servicio";

/** CU-18: la administradora carga el comprobante que la clienta le envió por WhatsApp (RN-13.1, RN-13.7). */
export async function cargarComprobante(uid: number, solicitudId: number, archivo: File, monto: number, pagadoEn: Date) {
  if (!archivo || archivo.size === 0) throw new ReglaError("Adjunta el comprobante.");
  if (!(monto > 0)) throw new ReglaError("Escribe el monto del pago.");
  validarMonto(monto, "el monto del pago");
  if (Number.isNaN(pagadoEn.getTime()) || pagadoEn.getTime() > Date.now() + 60_000) throw new ReglaError("La fecha y hora del pago no puede estar en el futuro", "RN-13.3");
  const s = await q1<{ estado: string }>("SELECT estado FROM solicitud_actividad WHERE id = $1", [solicitudId]);
  if (!s) throw new ReglaError("La solicitud no existe.");
  if (![SOL.PENDIENTE_PAGO, SOL.PLAZO_VENCIDO, SOL.CONFIRMADA, SOL.REALIZADA].includes(s.estado as never))
    throw new ReglaError(`No se cargan comprobantes en estado «${s.estado}».`);
  const clave = await guardarArchivo(archivo, "comprobantes");
  return tx(async (c) => {
    const r = await q1<{ id: number }>(
      "INSERT INTO comprobante_pago (solicitud_id, archivo_url, monto, pagado_en, estado) VALUES ($1,$2,$3,$4,'Pendiente') RETURNING id",
      [solicitudId, clave, Math.round(monto * 100) / 100, pagadoEn],
      c,
    );
    await auditar(c, uid, "Cargar comprobante", "solicitud_actividad", solicitudId, `comprobante ${r!.id}, C$ ${monto}`);
    return r!.id;
  });
}

/** CU-19 y CU-22: validar el anticipo y confirmar. Si el plazo venció, solo se acepta un pago hecho dentro del plazo (RN-13.6, RN-15.3). */
export async function validarAnticipoYConfirmar(uid: number, comprobanteId: number) {
  const solicitudId = await tx(async (c) => {
    const cp = await q1<{ id: number; solicitud_id: number; monto: number; pagado_en: Date; estado: string }>(
      "SELECT id, solicitud_id, monto, pagado_en, estado FROM comprobante_pago WHERE id = $1 FOR UPDATE",
      [comprobanteId],
      c,
    );
    if (!cp?.solicitud_id) throw new ReglaError("El comprobante no existe.");
    if (cp.estado !== "Pendiente") throw new ReglaError(`El comprobante ya está ${cp.estado.toLowerCase()}.`);
    const s = await q1<{ estado: string; plazo_pago_hasta: Date | null }>("SELECT estado, plazo_pago_hasta FROM solicitud_actividad WHERE id = $1 FOR UPDATE", [cp.solicitud_id], c);
    if (!s || ![SOL.PENDIENTE_PAGO, SOL.PLAZO_VENCIDO].includes(s.estado as never))
      throw new ReglaError(`Solo se confirma una solicitud pendiente de pago o con plazo vencido (estado: ${s?.estado}).`);
    const cot = await q1<{ anticipo: number }>("SELECT anticipo FROM cotizacion WHERE solicitud_id = $1 AND vigente", [cp.solicitud_id], c);
    if (!cot) throw new ReglaError("La solicitud no tiene cotización vigente.");
    if (cp.monto + 0.001 < cot.anticipo) throw new ReglaError(`El monto (C$ ${cp.monto}) no cubre el anticipo de C$ ${cot.anticipo}`, "RN-13.5");
    if (s.plazo_pago_hasta && new Date(cp.pagado_en) > new Date(s.plazo_pago_hasta))
      throw new ReglaError("El pago se realizó después del plazo de 24 horas; no puede confirmarse. Declara la expiración o acuerda una nueva solicitud", "RN-15.3");
    await q("UPDATE comprobante_pago SET estado = 'Validado', validado_en = now(), validado_por = $2 WHERE id = $1", [cp.id, uid], c);
    await q(
      "INSERT INTO pago (solicitud_id, comprobante_id, tipo, monto, registrado_por) VALUES ($1,$2,'Anticipo',$3,$4)",
      [cp.solicitud_id, cp.id, cp.monto, uid],
      c,
    );
    await confirmar(c, cp.solicitud_id); // mantiene el mismo intervalo o cupo (RN-14.7, RN-14.8)
    await q(
      "UPDATE solicitud_actividad SET estado = 'Confirmada', revisada_en = CASE WHEN estado = $2 THEN now() ELSE revisada_en END, actualizado_en = now() WHERE id = $1",
      [cp.solicitud_id, SOL.PLAZO_VENCIDO],
      c,
    );
    await auditar(c, uid, "Validar anticipo y confirmar", "solicitud_actividad", cp.solicitud_id, `comprobante ${cp.id}`);
    return cp.solicitud_id;
  });
  // RF-34: el aviso se envía después de confirmar; si falla, la confirmación se mantiene (RN-34.3).
  let aviso: { ok: boolean; error?: string };
  try {
    aviso = await enviarAvisoConfirmacion(uid, solicitudId);
  } catch (e) {
    aviso = { ok: false, error: (e as Error).message };
  }
  return { solicitudId, aviso };
}

export async function rechazarComprobante(uid: number, comprobanteId: number, motivo: string) {
  return tx(async (c) => {
    const cp = await q1<{ solicitud_id: number; estado: string }>("SELECT solicitud_id, estado FROM comprobante_pago WHERE id = $1 FOR UPDATE", [comprobanteId], c);
    if (!cp) throw new ReglaError("El comprobante no existe.");
    if (cp.estado !== "Pendiente") throw new ReglaError("El comprobante ya fue revisado.");
    await q("UPDATE comprobante_pago SET estado = 'Rechazado', validado_en = now(), validado_por = $2 WHERE id = $1", [comprobanteId, uid], c);
    await auditar(c, uid, "Rechazar comprobante", "solicitud_actividad", cp.solicitud_id, motivo);
  });
}

/** CU-22: sin pago oportuno, la administradora declara la expiración y se libera la reserva (RN-15.4 a RN-15.6). */
export async function declararExpiracion(uid: number, solicitudId: number, motivo: string) {
  return tx(async (c) => {
    const s = await q1<{ estado: string }>("SELECT estado FROM solicitud_actividad WHERE id = $1 FOR UPDATE", [solicitudId], c);
    if (s?.estado !== SOL.PLAZO_VENCIDO) throw new ReglaError("Solo se declara la expiración de solicitudes con plazo vencido", "RF-15");
    await q(
      "UPDATE solicitud_actividad SET estado = 'Expirada', revisada_en = now(), motivo_cierre = $2, actualizado_en = now() WHERE id = $1",
      [solicitudId, (motivo?.trim() || "Sin pago dentro del plazo").slice(0, 150)],
      c,
    );
    await liberar(c, solicitudId);
    await auditar(c, uid, "Declarar expiración", "solicitud_actividad", solicitudId, motivo);
  });
}

/** CU-27: registrar atención realizada o inasistencia (RN-31.1, RN-31.2, RN-31.6). */
export async function registrarAtencion(uid: number, solicitudId: number, resultado: "Realizada" | "No asistida") {
  return tx(async (c) => {
    const s = await q1<{ estado: string; inicio: Date }>(
      "SELECT s.estado, COALESCE(s.inicio_solicitado, ses.inicio) AS inicio FROM solicitud_actividad s LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id WHERE s.id = $1 FOR UPDATE OF s",
      [solicitudId],
      c,
    );
    if (s?.estado !== SOL.CONFIRMADA) throw new ReglaError("Solo se registra la atención de citas o inscripciones confirmadas.");
    if (new Date(s.inicio) > new Date()) throw new ReglaError("La actividad todavía no ha empezado", "RN-31.2");
    await q(
      "UPDATE solicitud_actividad SET estado = $2, motivo_cierre = $3, actualizado_en = now() WHERE id = $1",
      [solicitudId, resultado, resultado === "No asistida" ? "Anticipo retenido por inasistencia (RN-31.6)" : null],
      c,
    );
    await auditar(c, uid, resultado === "Realizada" ? "Registrar atención realizada" : "Registrar inasistencia", "solicitud_actividad", solicitudId);
  });
}

/** Saldo = precio total − pagos válidos (RN-31.3). */
export async function saldoPendiente(solicitudId: number, db = undefined as Parameters<typeof q1>[2]) {
  const r = await q1<{ precio: number; pagado: number }>(
    `SELECT co.precio_total AS precio, COALESCE((SELECT sum(monto) FROM pago WHERE solicitud_id = $1), 0)::numeric AS pagado
     FROM cotizacion co WHERE co.solicitud_id = $1 AND co.vigente`,
    [solicitudId],
    db,
  );
  if (!r) return null;
  return { precio: Number(r.precio), pagado: Number(r.pagado), saldo: Math.round((Number(r.precio) - Number(r.pagado)) * 100) / 100 };
}

/** CU-27: cobro del saldo. La atención se cierra solo con el pago completo (RN-31.4). */
export async function registrarSaldo(uid: number, solicitudId: number, monto: number) {
  return tx(async (c) => {
    const s = await q1<{ estado: string }>("SELECT estado FROM solicitud_actividad WHERE id = $1 FOR UPDATE", [solicitudId], c);
    if (s?.estado !== SOL.REALIZADA) throw new ReglaError("El saldo se cobra en atenciones realizadas", "RN-31.4");
    const sp = await saldoPendiente(solicitudId, c);
    if (!sp) throw new ReglaError("La solicitud no tiene cotización.");
    const m = Math.round(monto * 100) / 100;
    if (!(m > 0)) throw new ReglaError("Escribe el monto recibido.");
    validarMonto(monto, "el monto recibido");
    if (m > sp.saldo + 0.001) throw new ReglaError(`El monto supera el saldo pendiente (C$ ${sp.saldo}).`);
    await q("INSERT INTO pago (solicitud_id, tipo, monto, registrado_por) VALUES ($1,'Saldo',$2,$3)", [solicitudId, m, uid], c);
    const cierra = Math.abs(sp.saldo - m) < 0.005;
    if (cierra) await q("UPDATE solicitud_actividad SET estado = 'Cerrada', actualizado_en = now() WHERE id = $1", [solicitudId], c);
    await auditar(c, uid, cierra ? "Cobrar saldo y cerrar" : "Cobrar parte del saldo", "solicitud_actividad", solicitudId, `C$ ${m}`);
    return { cerrada: cierra, saldoRestante: Math.round((sp.saldo - m) * 100) / 100 };
  });
}

export async function comprobantesPendientes() {
  return q<{ id: number; solicitud_id: number; clienta: string; actividad: string; monto: number; pagado_en: Date; cargado_en: Date; estado_solicitud: string }>(
    `SELECT cp.id, cp.solicitud_id, c.nombre AS clienta, COALESCE(sv.nombre, cu.nombre) AS actividad, cp.monto, cp.pagado_en, cp.cargado_en, s.estado AS estado_solicitud
     FROM comprobante_pago cp JOIN solicitud_actividad s ON s.id = cp.solicitud_id JOIN cliente c ON c.id = s.cliente_id
     LEFT JOIN servicio sv ON sv.id = s.servicio_id LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id LEFT JOIN curso cu ON cu.id = ses.curso_id
     WHERE cp.estado = 'Pendiente' ORDER BY cp.cargado_en`,
  );
}
