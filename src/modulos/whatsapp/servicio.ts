// MOD-06 Mensajería de WhatsApp (CU-14 a CU-17, CU-20; RF-11, RF-12, RF-33, RF-34).
// Reglas clave:
// - El plazo de 24 h empieza cuando WhatsApp informa «enviado», no al presionar el botón (RN-11.5).
// - Sin aviso de envío en 15 min o con error: mensaje Fallido, se libera el apartado y la solicitud vuelve a revisión (RN-11.6).
// - Cada cotización tiene como máximo un envío exitoso; avisos repetidos o fuera de orden no duplican efectos (RN-11.8, RN-33.3).
import { q, q1, tx } from "@/lib/db";
import { ReglaError } from "@/lib/errores";
import { leerConfig } from "@/lib/config";
import { apartar, liberar } from "../agenda";
import { auditar, notificar } from "../seguridad";
import { COD, MSG, ORDEN_MSG, SOL } from "../estados";
import { enviarPlantilla, ErrorWhatsApp, modoWhatsApp } from "./cliente";
import { Plantilla, plantillaConfirmacion, plantillaCotizacion } from "./plantillas";

type DatosSolicitud = {
  id: number; estado: string; tipo: string; cliente_id: string; nombre: string; whatsapp: string; acepta_whatsapp: boolean;
  actividad: string; inicio: Date; fuera_local: boolean; direccion: string | null;
  cotizacion_id: number | null; precio_total: number | null; anticipo: number | null; saldo: number | null;
};

export async function datosSolicitud(solicitudId: number, db = undefined as Parameters<typeof q1>[2]): Promise<DatosSolicitud | null> {
  return q1<DatosSolicitud>(
    `SELECT s.id, s.estado, s.tipo, s.cliente_id, c.nombre, c.whatsapp, c.acepta_whatsapp,
            COALESCE(sv.nombre, cu.nombre) AS actividad, COALESCE(s.inicio_solicitado, ses.inicio) AS inicio,
            s.fuera_local, s.direccion, co.id AS cotizacion_id, co.precio_total, co.anticipo, co.saldo
     FROM solicitud_actividad s JOIN cliente c ON c.id = s.cliente_id
     LEFT JOIN servicio sv ON sv.id = s.servicio_id
     LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id LEFT JOIN curso cu ON cu.id = ses.curso_id
     LEFT JOIN cotizacion co ON co.solicitud_id = s.id AND co.vigente
     WHERE s.id = $1`,
    [solicitudId],
    db,
  );
}

export async function vistaPreviaCotizacion(solicitudId: number): Promise<Plantilla | null> {
  const d = await datosSolicitud(solicitudId);
  if (!d?.cotizacion_id) return null;
  const cfg = await leerConfig();
  return plantillaCotizacion({ nombre: d.nombre, actividad: d.actividad, inicio: d.inicio, total: d.precio_total!, anticipo: d.anticipo!, datosPago: cfg.datos_pago });
}

export async function vistaPreviaConfirmacion(solicitudId: number): Promise<Plantilla | null> {
  const d = await datosSolicitud(solicitudId);
  if (!d?.cotizacion_id) return null;
  const cfg = await leerConfig();
  const pagado = await totalPagado(solicitudId);
  return plantillaConfirmacion({
    nombre: d.nombre, actividad: d.actividad, inicio: d.inicio, anticipo: pagado, saldo: Math.max(0, d.precio_total! - pagado),
    lugar: d.fuera_local ? `a domicilio (${d.direccion ?? "dirección registrada"})` : cfg.lugar_local,
  });
}

async function totalPagado(solicitudId: number, db?: Parameters<typeof q1>[2]) {
  const r = await q1<{ t: number }>("SELECT COALESCE(sum(monto),0)::numeric AS t FROM pago WHERE solicitud_id = $1", [solicitudId], db);
  return Number(r?.t ?? 0);
}

/** Despacha el mensaje ya registrado «En cola» y guarda el identificador de WhatsApp o el error. */
export async function despachar(mensajeId: number, para: string, p: Plantilla) {
  try {
    const { idExterno } = await enviarPlantilla(para, p);
    await q("UPDATE mensaje_whatsapp SET id_externo = $2 WHERE id = $1", [mensajeId, idExterno]);
    if (modoWhatsApp() === "simulado") simularAviso(idExterno, para);
    return { ok: true as const, idExterno };
  } catch (e) {
    const err = e instanceof ErrorWhatsApp ? e : new ErrorWhatsApp("DESCONOCIDO", (e as Error).message);
    await registrarFallo(mensajeId, err.codigo, err.detalle);
    return { ok: false as const, error: err.detalle };
  }
}

/** Modo simulado: a los 2 s llega el aviso «enviado» (o «fallido» si el número termina en 9999). */
function simularAviso(idExterno: string, para: string) {
  const falla = para.endsWith("9999");
  setTimeout(() => {
    procesarAviso({
      idExterno, estado: falla ? "failed" : "sent", ocurrido: new Date(), idEvento: `${idExterno}:${falla ? "failed" : "sent"}`,
      errorCodigo: falla ? "131026" : undefined, errorDetalle: falla ? "Mensaje no entregable (simulado)" : undefined,
    }).catch((e) => console.error("[simulado]", e));
  }, 2000);
}

/** CU-14: Andrea presiona «Enviar cotización». Aparta el intervalo o cupo y deja el mensaje en cola (RN-11.3, RN-11.4). */
export async function enviarCotizacion(uid: number, solicitudId: number) {
  const cfg = await leerConfig();
  const preparado = await tx(async (c) => {
    const s = await q1<{ estado: string }>("SELECT estado FROM solicitud_actividad WHERE id = $1 FOR UPDATE", [solicitudId], c);
    if (!s) throw new ReglaError("La solicitud no existe.");
    if (s.estado === SOL.COTIZACION_ENVIO) throw new ReglaError("La cotización ya se está enviando; espera el aviso de WhatsApp", "RN-11.8");
    if (s.estado !== SOL.PENDIENTE_REVISION) throw new ReglaError(`No se puede enviar una cotización en estado «${s.estado}».`);
    const d = (await datosSolicitud(solicitudId, c))!;
    if (!d.cotizacion_id) throw new ReglaError("Primero registra la cotización", "RN-11.2");
    if (!d.acepta_whatsapp) throw new ReglaError("La clienta no aceptó recibir mensajes por WhatsApp; usa el envío manual", "RN-01.6, RN-11.7");
    const exito = await q1("SELECT 1 FROM mensaje_whatsapp WHERE cotizacion_id = $1 AND estado IN ('Enviado','Entregado','Leído')", [d.cotizacion_id], c);
    if (exito) throw new ReglaError("Esta cotización ya tiene un envío exitoso", "RN-11.8");

    await apartar(c, solicitudId); // comprueba disponibilidad y aparta en la misma operación
    await q("UPDATE solicitud_actividad SET estado = $2, actualizado_en = now() WHERE id = $1", [solicitudId, SOL.COTIZACION_ENVIO], c);
    const p = plantillaCotizacion({ nombre: d.nombre, actividad: d.actividad, inicio: d.inicio, total: d.precio_total!, anticipo: d.anticipo!, datosPago: cfg.datos_pago });
    const m = await q1<{ id: number }>(
      `INSERT INTO mensaje_whatsapp (cliente_id, solicitud_id, cotizacion_id, tipo, plantilla, estado, origen)
       VALUES ($1,$2,$3,'Cotización',$4,'En cola','API') RETURNING id`,
      [d.cliente_id, solicitudId, d.cotizacion_id, p.nombre],
      c,
    );
    await auditar(c, uid, "Enviar cotización por la API", "solicitud_actividad", solicitudId, `mensaje ${m!.id}`);
    return { mensajeId: m!.id, para: d.whatsapp, plantilla: p };
  });
  return despachar(preparado.mensajeId, preparado.para, preparado.plantilla);
}

/** CU-15: Envío manual. Andrea envió el mensaje desde su teléfono y registra la hora efectiva (RN-11.7, RN-12.1). */
export async function registrarEnvioManual(uid: number, solicitudId: number, enviadoEn: Date) {
  const cfg = await leerConfig();
  if (enviadoEn.getTime() > Date.now() + 60_000) throw new ReglaError("La hora del envío no puede estar en el futuro.");
  return tx(async (c) => {
    const s = await q1<{ estado: string }>("SELECT estado FROM solicitud_actividad WHERE id = $1 FOR UPDATE", [solicitudId], c);
    if (!s) throw new ReglaError("La solicitud no existe.");
    if (s.estado !== SOL.PENDIENTE_REVISION) throw new ReglaError(`No se puede registrar el envío en estado «${s.estado}».`);
    const d = (await datosSolicitud(solicitudId, c))!;
    if (!d.cotizacion_id) throw new ReglaError("Primero registra la cotización", "RN-11.2");
    const cot = await q1<{ creado_en: Date }>("SELECT creado_en FROM cotizacion WHERE id = $1", [d.cotizacion_id], c);
    if (enviadoEn < new Date(new Date(cot!.creado_en).getTime() - 60_000)) throw new ReglaError("La hora del envío es anterior a la cotización.");
    await apartar(c, solicitudId);
    const plazo = new Date(enviadoEn.getTime() + Number(cfg.plazo_pago_horas) * 3600_000);
    await q(
      `INSERT INTO mensaje_whatsapp (cliente_id, solicitud_id, cotizacion_id, tipo, plantilla, estado, origen, enviado_en)
       VALUES ($1,$2,$3,'Cotización','manual','Enviado','manual',$4)`,
      [d.cliente_id, solicitudId, d.cotizacion_id, enviadoEn],
      c,
    );
    await q("UPDATE solicitud_actividad SET estado = $2, plazo_pago_hasta = $3, actualizado_en = now() WHERE id = $1", [solicitudId, SOL.PENDIENTE_PAGO, plazo], c);
    await auditar(c, uid, "Registrar envío manual de cotización", "solicitud_actividad", solicitudId, `enviado ${enviadoEn.toISOString()}`);
    return plazo;
  });
}

/** CU-20: aviso de confirmación tras confirmar (RF-34). Su fallo no revierte la confirmación (RN-34.3). */
export async function enviarAvisoConfirmacion(uid: number | null, solicitudId: number) {
  const preparado = await tx(async (c) => {
    const d = await datosSolicitud(solicitudId, c);
    if (!d) throw new ReglaError("La solicitud no existe.");
    if (d.estado !== SOL.CONFIRMADA) throw new ReglaError("El aviso solo se envía para solicitudes confirmadas", "RN-34.1");
    if (!d.acepta_whatsapp) return null;
    const previo = await q1(
      "SELECT 1 FROM mensaje_whatsapp WHERE solicitud_id = $1 AND tipo = 'Aviso de confirmación' AND estado <> 'Fallido' FOR UPDATE",
      [solicitudId],
      c,
    );
    if (previo) throw new ReglaError("El aviso de confirmación ya se envió o está en cola", "RN-34.4");
    const p = (await vistaPreviaConfirmacion(solicitudId))!;
    const m = await q1<{ id: number }>(
      `INSERT INTO mensaje_whatsapp (cliente_id, solicitud_id, tipo, plantilla, estado, origen) VALUES ($1,$2,'Aviso de confirmación',$3,'En cola','API') RETURNING id`,
      [d.cliente_id, solicitudId, p.nombre],
      c,
    );
    await auditar(c, uid, "Enviar aviso de confirmación", "solicitud_actividad", solicitudId, `mensaje ${m!.id}`);
    return { mensajeId: m!.id, para: d.whatsapp, plantilla: p };
  });
  if (!preparado) return { ok: false as const, error: "La clienta no aceptó mensajes por WhatsApp; avísale manualmente." };
  return despachar(preparado.mensajeId, preparado.para, preparado.plantilla);
}

/** Registra un aviso manual de confirmación (Andrea avisó desde su teléfono). */
export async function registrarAvisoManual(uid: number, solicitudId: number, enviadoEn: Date) {
  return tx(async (c) => {
    const d = await datosSolicitud(solicitudId, c);
    if (!d || d.estado !== SOL.CONFIRMADA) throw new ReglaError("El aviso solo se registra para solicitudes confirmadas.");
    await q(
      `INSERT INTO mensaje_whatsapp (cliente_id, solicitud_id, tipo, plantilla, estado, origen, enviado_en) VALUES ($1,$2,'Aviso de confirmación','manual','Enviado','manual',$3)`,
      [d.cliente_id, solicitudId, enviadoEn],
      c,
    );
    await auditar(c, uid, "Registrar aviso manual de confirmación", "solicitud_actividad", solicitudId);
  });
}

/** Marca un mensaje como fallido y aplica sus efectos (RN-11.6, RN-34.3, RN-18.10). */
export async function registrarFallo(mensajeId: number, codigo: string, detalle: string) {
  await tx(async (c) => {
    const m = await q1<{ id: number; tipo: string; estado: string; solicitud_id: number | null }>(
      "SELECT id, tipo, estado, solicitud_id FROM mensaje_whatsapp WHERE id = $1 FOR UPDATE",
      [mensajeId],
      c,
    );
    if (!m || m.estado === MSG.FALLIDO) return;
    const yaEnviado = m.estado !== MSG.EN_COLA;
    await q("UPDATE mensaje_whatsapp SET estado = 'Fallido', codigo_error = $2, detalle_error = $3 WHERE id = $1", [mensajeId, codigo.slice(0, 30), detalle.slice(0, 200)], c);
    if (m.tipo === "Cotización" && m.solicitud_id) {
      const s = await q1<{ estado: string }>("SELECT estado FROM solicitud_actividad WHERE id = $1 FOR UPDATE", [m.solicitud_id], c);
      if (s?.estado === SOL.COTIZACION_ENVIO) {
        await q("UPDATE solicitud_actividad SET estado = $2, actualizado_en = now() WHERE id = $1", [m.solicitud_id, SOL.PENDIENTE_REVISION], c);
        await liberar(c, m.solicitud_id);
        await notificar(c, "Envío fallido", `La cotización de la solicitud #${m.solicitud_id} no se pudo enviar por WhatsApp (${detalle}). Reintenta o usa el envío manual.`, "solicitud_actividad", m.solicitud_id);
      } else if (yaEnviado) {
        await notificar(c, "Error tras el envío", `WhatsApp informó un error después de enviar la cotización de la solicitud #${m.solicitud_id} (${detalle}). Verifica con la clienta.`, "solicitud_actividad", m.solicitud_id);
      }
    } else if (m.tipo === "Aviso de confirmación" && m.solicitud_id) {
      await notificar(c, "Aviso fallido", `El aviso de confirmación de la solicitud #${m.solicitud_id} no se pudo enviar (${detalle}). La cita sigue confirmada; reintenta o avisa manualmente.`, "solicitud_actividad", m.solicitud_id);
    } else if (m.tipo === "Código de verificación") {
      await q("UPDATE codigo_verificacion SET estado = 'Fallido' WHERE mensaje_id = $1 AND estado IN ('Solicitado','Enviado')", [mensajeId], c);
    }
    await auditar(c, null, "Mensaje fallido", "mensaje_whatsapp", mensajeId, `${codigo}: ${detalle}`);
  });
}

export type Aviso = { idExterno: string; estado: string; ocurrido: Date; idEvento: string; errorCodigo?: string; errorDetalle?: string };
const MAPA: Record<string, string> = { sent: MSG.ENVIADO, delivered: MSG.ENTREGADO, read: MSG.LEIDO, failed: MSG.FALLIDO };

/** Procesa un aviso de estado del webhook (RN-33.3). Devuelve qué hizo, para registro y pruebas. */
export async function procesarAviso(a: Aviso): Promise<"procesado" | "duplicado" | "desconocido" | "ignorado"> {
  const nuevo = MAPA[a.estado];
  if (!nuevo) return "ignorado";
  const cfg = await leerConfig();
  let falloPendiente: { id: number } | null = null;
  const r = await tx(async (c) => {
    const m = await q1<{ id: number; tipo: string; estado: string; solicitud_id: number | null; enviado_en: Date | null }>(
      "SELECT id, tipo, estado, solicitud_id, enviado_en FROM mensaje_whatsapp WHERE id_externo = $1 FOR UPDATE",
      [a.idExterno],
      c,
    );
    if (!m) return "desconocido" as const;
    const ev = await q1<{ id: number }>(
      `INSERT INTO evento_mensaje_whatsapp (mensaje_id, id_evento, estado, ocurrido_en) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id_evento) DO NOTHING RETURNING id`,
      [m.id, a.idEvento.slice(0, 100), nuevo, a.ocurrido],
      c,
    );
    if (!ev) return "duplicado" as const;

    if (nuevo === MSG.FALLIDO) {
      falloPendiente = { id: m.id };
      return "procesado" as const;
    }
    if (m.estado === MSG.FALLIDO) {
      // Confirmación tardía de un mensaje dado por fallido: no se revierte nada automáticamente.
      if (m.tipo === "Cotización" && m.solicitud_id)
        await notificar(c, "Envío confirmado tarde", `WhatsApp confirmó tarde el envío de la cotización de la solicitud #${m.solicitud_id}. Revisa la solicitud antes de reenviar.`, "solicitud_actividad", m.solicitud_id);
      return "procesado" as const;
    }
    if (ORDEN_MSG[nuevo] > ORDEN_MSG[m.estado]) {
      await q("UPDATE mensaje_whatsapp SET estado = $2 WHERE id = $1", [m.id, nuevo], c);
    }
    if (!m.enviado_en) {
      // Entregado o leído implican que ya se envió (aviso fuera de orden).
      await q("UPDATE mensaje_whatsapp SET enviado_en = $2 WHERE id = $1", [m.id, a.ocurrido], c);
      if (m.tipo === "Cotización" && m.solicitud_id) {
        const s = await q1<{ estado: string }>("SELECT estado FROM solicitud_actividad WHERE id = $1 FOR UPDATE", [m.solicitud_id], c);
        if (s?.estado === SOL.COTIZACION_ENVIO) {
          const plazo = new Date(a.ocurrido.getTime() + Number(cfg.plazo_pago_horas) * 3600_000);
          await q("UPDATE solicitud_actividad SET estado = $2, plazo_pago_hasta = $3, actualizado_en = now() WHERE id = $1", [m.solicitud_id, SOL.PENDIENTE_PAGO, plazo], c);
          await auditar(c, null, "Inicio del plazo de pago", "solicitud_actividad", m.solicitud_id, `WhatsApp informó el envío; vence ${plazo.toISOString()}`);
        }
      } else if (m.tipo === "Código de verificación") {
        await q("UPDATE codigo_verificacion SET estado = $2 WHERE mensaje_id = $1 AND estado = 'Solicitado'", [m.id, COD.ENVIADO], c);
      }
    }
    return "procesado" as const;
  });
  if (falloPendiente) await registrarFallo((falloPendiente as { id: number }).id, a.errorCodigo ?? "ERROR", a.errorDetalle ?? "WhatsApp informó un error");
  return r;
}

/** Planificador: mensajes sin aviso de envío dentro de la espera configurada pasan a Fallido (RN-11.6). */
export async function vencerEnviosSinConfirmar() {
  const cfg = await leerConfig();
  const pendientes = await q<{ id: number }>(
    "SELECT id FROM mensaje_whatsapp WHERE estado = 'En cola' AND creado_en < now() - make_interval(mins => $1)",
    [Number(cfg.espera_envio_min)],
  );
  for (const p of pendientes) await registrarFallo(p.id, "SIN_CONFIRMACION", `WhatsApp no confirmó el envío en ${cfg.espera_envio_min} minutos`);
  return pendientes.length;
}

export async function mensajesDeSolicitud(solicitudId: number) {
  return q<{ id: number; tipo: string; plantilla: string; estado: string; origen: string; id_externo: string | null; enviado_en: Date | null; codigo_error: string | null; detalle_error: string | null; creado_en: Date }>(
    "SELECT id, tipo, plantilla, estado, origen, id_externo, enviado_en, codigo_error, detalle_error, creado_en FROM mensaje_whatsapp WHERE solicitud_id = $1 ORDER BY creado_en",
    [solicitudId],
  );
}

export async function eventosDeMensaje(mensajeId: number) {
  return q<{ estado: string; ocurrido_en: Date; recibido_en: Date }>("SELECT estado, ocurrido_en, recibido_en FROM evento_mensaje_whatsapp WHERE mensaje_id = $1 ORDER BY ocurrido_en", [mensajeId]);
}
