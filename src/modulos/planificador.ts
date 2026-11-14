// MOD-11 Planificador de tareas (CU-21). Se ejecuta cada minuto.
// - Envíos sin aviso de WhatsApp dentro de la espera → Fallido y se libera el apartado (RN-11.6).
// - Plazo de 24 h vencido → «Plazo vencido pendiente de revisión»; NO libera la reserva (RN-12.4, RN-12.5).
// - Códigos de verificación vencidos (RN-18.11).
// - Recordatorios en el panel para actividades confirmadas próximas (RF-19).
import { q, tx, pool } from "@/lib/db";
import { leerConfig } from "@/lib/config";
import { auditar, notificar } from "./seguridad";
import { SOL } from "./estados";
import { vencerEnviosSinConfirmar } from "./whatsapp/servicio";
import { fechaHora } from "@/lib/tiempo";

export async function vencerPlazos() {
  return tx(async (c) => {
    const vencidas = await q<{ id: number; clienta: string }>(
      `UPDATE solicitud_actividad s SET estado = $1, actualizado_en = now()
       FROM cliente c WHERE c.id = s.cliente_id AND s.estado = $2 AND s.plazo_pago_hasta < now()
       RETURNING s.id, c.nombre AS clienta`,
      [SOL.PLAZO_VENCIDO, SOL.PENDIENTE_PAGO],
      c,
    );
    for (const v of vencidas) {
      await notificar(c, "Plazo vencido", `Venció el plazo de pago de ${v.clienta} (solicitud #${v.id}). Revisa si pagó a tiempo antes de liberar la reserva.`, "solicitud_actividad", v.id);
      await auditar(c, null, "Vencer plazo de pago", "solicitud_actividad", v.id);
    }
    return vencidas.length;
  });
}

export async function vencerCodigos() {
  const r = await q<{ id: number }>("UPDATE codigo_verificacion SET estado = 'Vencido' WHERE estado IN ('Solicitado','Enviado') AND expira_en < now() RETURNING id");
  return r.length;
}

export async function generarRecordatorios() {
  const cfg = await leerConfig();
  const horas = Number(cfg.recordatorio_horas);
  const proximas = await q<{ id: number; actividad: string; inicio: Date; clienta: string | null; sesion_id: number | null; inscritas: number | null }>(
    `SELECT a.id, COALESCE(sv.nombre, cu1.nombre, cu2.nombre) AS actividad, a.inicio, c.nombre AS clienta, a.sesion_id,
            CASE WHEN a.sesion_id IS NOT NULL THEN (SELECT count(*)::int FROM solicitud_actividad x WHERE x.sesion_id = a.sesion_id AND x.estado = 'Confirmada') END AS inscritas
     FROM actividad_agenda a
     LEFT JOIN solicitud_actividad s ON s.id = a.solicitud_id LEFT JOIN cliente c ON c.id = s.cliente_id
     LEFT JOIN servicio sv ON sv.id = s.servicio_id
     LEFT JOIN sesion_curso se1 ON se1.id = s.sesion_id LEFT JOIN curso cu1 ON cu1.id = se1.curso_id
     LEFT JOIN sesion_curso se2 ON se2.id = a.sesion_id LEFT JOIN curso cu2 ON cu2.id = se2.curso_id
     WHERE a.estado = 'Confirmada' AND a.inicio BETWEEN now() AND now() + make_interval(hours => $1)
       AND (s.id IS NULL OR s.estado = 'Confirmada')
       AND NOT EXISTS (SELECT 1 FROM notificacion n WHERE n.tipo = 'Recordatorio' AND n.entidad = 'actividad_agenda' AND n.entidad_id = a.id)`,
    [horas],
  );
  let n = 0;
  for (const p of proximas) {
    if (p.sesion_id && !p.inscritas) continue; // sesiones sin inscripciones confirmadas no generan recordatorio (RN-19.1)
    const quien = p.sesion_id ? `${p.inscritas} participante(s) confirmada(s)` : p.clienta;
    await notificar(pool, "Recordatorio", `${p.actividad} · ${fechaHora(p.inicio)} · ${quien}`, "actividad_agenda", p.id);
    n++;
  }
  return n;
}

let corriendo = false;
export async function ejecutarTareas() {
  if (corriendo) return null;
  corriendo = true;
  try {
    const envios = await vencerEnviosSinConfirmar();
    const plazos = await vencerPlazos();
    const codigos = await vencerCodigos();
    const recordatorios = await generarRecordatorios();
    return { envios, plazos, codigos, recordatorios, en: new Date().toISOString() };
  } finally {
    corriendo = false;
  }
}
