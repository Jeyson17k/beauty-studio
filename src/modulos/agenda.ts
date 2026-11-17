// MOD-03 Agenda y disponibilidad (CU-13, CU-28). Calendario unificado de servicios y cursos (RF-05).
// La restricción EXCLUDE de actividad_agenda impide intervalos superpuestos (RNF-06); aquí se traducen sus errores.
import type { PoolClient } from "pg";
import { q, q1, Db, pool } from "@/lib/db";
import { ReglaError } from "@/lib/errores";
import { AGENDA, SESION, SOL_CON_RESERVA } from "./estados";
import { fechaHora, hora } from "@/lib/tiempo";

type Sol = {
  id: number; tipo: "servicio" | "curso"; sesion_id: number | null; inicio_solicitado: Date | null;
};

async function insertarIntervalo(c: PoolClient, datos: { solicitudId?: number; sesionId?: number; inicio: Date; fin: Date; estado: string }) {
  if (datos.fin <= datos.inicio) throw new ReglaError("El intervalo no es válido.");
  await c.query("SAVEPOINT apartar");
  try {
    const r = await c.query<{ id: number }>(
      `INSERT INTO actividad_agenda (solicitud_id, sesion_id, inicio, fin, estado, confirmado_en)
       VALUES ($1, $2, $3, $4, $5::varchar, CASE WHEN $5::varchar = 'Confirmada' THEN now() END) RETURNING id`,
      [datos.solicitudId ?? null, datos.sesionId ?? null, datos.inicio, datos.fin, datos.estado],
    );
    await c.query("RELEASE SAVEPOINT apartar");
    return r.rows[0].id;
  } catch (e) {
    await c.query("ROLLBACK TO SAVEPOINT apartar");
    if ((e as { code?: string }).code === "23P01") {
      const cruce = await primerCruce(c, datos.inicio, datos.fin);
      throw new ReglaError(
        `El horario ${hora(datos.inicio)}–${hora(datos.fin)} se cruza con otra actividad${cruce ? ` (${fechaHora(cruce.inicio)} a ${hora(cruce.fin)})` : ""}`,
        "RN-05.8",
      );
    }
    throw e;
  }
}

export async function primerCruce(db: Db, inicio: Date, fin: Date, excluirSolicitud?: number) {
  return q1<{ id: number; inicio: Date; fin: Date }>(
    `SELECT id, inicio, fin FROM actividad_agenda
     WHERE estado IN ('Provisional','Confirmada') AND tstzrange(inicio, fin, '[)') && tstzrange($1, $2, '[)')
       AND ($3::bigint IS NULL OR solicitud_id IS DISTINCT FROM $3)
     ORDER BY inicio LIMIT 1`,
    [inicio, fin, excluirSolicitud ?? null],
    db,
  );
}

export async function estaDisponible(inicio: Date, fin: Date, excluirSolicitud?: number, db: Db = pool) {
  return !(await primerCruce(db, inicio, fin, excluirSolicitud));
}

/** Cupos disponibles de una sesión grupal: capacidad − inscripciones con reserva vigente (RN-08.9). */
export async function cuposDisponibles(db: Db, sesionId: number, excluirSolicitud?: number) {
  const r = await q1<{ capacidad: number; ocupados: number }>(
    `SELECT s.capacidad, (SELECT count(*)::int FROM solicitud_actividad a
        WHERE a.sesion_id = s.id AND a.estado = ANY($2) AND ($3::bigint IS NULL OR a.id <> $3)) AS ocupados
     FROM sesion_curso s WHERE s.id = $1`,
    [sesionId, SOL_CON_RESERVA, excluirSolicitud ?? null],
    db,
  );
  return r ? r.capacidad - r.ocupados : 0;
}

/** Recalcula Abierta/Llena de una sesión grupal (RN-04.10). */
export async function recalcularSesion(c: Db, sesionId: number) {
  const s = await q1<{ estado: string; modalidad: string }>(
    "SELECT s.estado, cu.modalidad FROM sesion_curso s JOIN curso cu ON cu.id = s.curso_id WHERE s.id = $1",
    [sesionId],
    c,
  );
  if (!s || s.modalidad !== "grupal" || ![SESION.ABIERTA, SESION.LLENA].includes(s.estado as never)) return;
  const libres = await cuposDisponibles(c, sesionId);
  await q("UPDATE sesion_curso SET estado = $2 WHERE id = $1", [sesionId, libres > 0 ? SESION.ABIERTA : SESION.LLENA], c);
}

/** Recalcula la sesión grupal de una solicitud después de cambiar su estado. */
export async function recalcularSesionDeSolicitud(c: Db, solicitudId: number) {
  const s = await q1<{ sesion_id: number | null }>("SELECT sesion_id FROM solicitud_actividad WHERE id = $1", [solicitudId], c);
  if (s?.sesion_id) await recalcularSesion(c, s.sesion_id);
}

/** Datos para apartar: servicio o clase individual usan su propio intervalo; la clase grupal, un cupo. */
async function datosReserva(c: PoolClient, sol: Sol) {
  if (sol.tipo === "servicio") {
    const cot = await q1<{ duracion_min: number; traslado_min: number | null }>(
      "SELECT duracion_min, traslado_min FROM cotizacion WHERE solicitud_id = $1 AND vigente",
      [sol.id],
      c,
    );
    if (!cot) throw new ReglaError("Primero registra la cotización con su duración", "RN-11.2");
    if (!sol.inicio_solicitado) throw new ReglaError("La solicitud no tiene fecha y hora.");
    const inicio = new Date(sol.inicio_solicitado);
    const fin = new Date(inicio.getTime() + (cot.duracion_min + (cot.traslado_min ?? 0)) * 60_000);
    return { grupal: false as const, inicio, fin };
  }
  const ses = await q1<{ id: number; inicio: Date; fin: Date; estado: string; modalidad: string }>(
    "SELECT s.id, s.inicio, s.fin, s.estado, cu.modalidad FROM sesion_curso s JOIN curso cu ON cu.id = s.curso_id WHERE s.id = $1 FOR UPDATE OF s",
    [sol.sesion_id],
    c,
  );
  if (!ses) throw new ReglaError("La sesión del curso no existe.");
  if (ses.modalidad === "grupal") return { grupal: true as const, sesion: ses };
  return { grupal: false as const, inicio: new Date(ses.inicio), fin: new Date(ses.fin) };
}

/** Aparta provisionalmente el intervalo o un cupo de la solicitud (RN-05.7, RN-11.4). */
export async function apartar(c: PoolClient, solicitudId: number) {
  const sol = await q1<Sol>("SELECT id, tipo, sesion_id, inicio_solicitado FROM solicitud_actividad WHERE id = $1", [solicitudId], c);
  if (!sol) throw new ReglaError("La solicitud no existe.");
  const d = await datosReserva(c, sol);
  const inicioActividad = d.grupal ? new Date(d.sesion.inicio) : d.inicio;
  if (inicioActividad < new Date()) throw new ReglaError("La fecha de la actividad ya pasó; reprograma o rechaza la solicitud", "RN-05.1");
  if (d.grupal) {
    if (d.sesion.estado !== SESION.ABIERTA) throw new ReglaError(`La sesión no recibe inscripciones (estado: ${d.sesion.estado})`, "RN-04.10");
    const libres = await cuposDisponibles(c, d.sesion.id, solicitudId);
    if (libres <= 0) throw new ReglaError("La sesión ya no tiene cupos disponibles", "RN-08.8");
    return { grupal: true };
  }
  await insertarIntervalo(c, { solicitudId, inicio: d.inicio, fin: d.fin, estado: AGENDA.PROVISIONAL });
  return { grupal: false };
}

/** Libera el intervalo (o el cupo) de una solicitud (RN-05.10). Debe llamarse después de cambiar el estado de la solicitud. */
export async function liberar(c: PoolClient, solicitudId: number) {
  await q("UPDATE actividad_agenda SET estado = 'Liberada' WHERE solicitud_id = $1 AND estado IN ('Provisional','Confirmada')", [solicitudId], c);
  const s = await q1<{ sesion_id: number | null }>("SELECT sesion_id FROM solicitud_actividad WHERE id = $1", [solicitudId], c);
  if (s?.sesion_id) await recalcularSesion(c, s.sesion_id);
}

/** Pasa la reserva provisional a confirmada (RN-14.7). En inscripciones grupales no crea otro intervalo (RN-14.8). */
export async function confirmar(c: PoolClient, solicitudId: number) {
  const sol = await q1<Sol>("SELECT id, tipo, sesion_id, inicio_solicitado FROM solicitud_actividad WHERE id = $1", [solicitudId], c);
  if (!sol) throw new ReglaError("La solicitud no existe.");
  const grupal = sol.sesion_id
    ? (await q1<{ m: string }>("SELECT cu.modalidad AS m FROM sesion_curso s JOIN curso cu ON cu.id = s.curso_id WHERE s.id = $1", [sol.sesion_id], c))?.m === "grupal"
    : false;
  if (grupal) {
    await recalcularSesion(c, sol.sesion_id!);
    return;
  }
  const r = await c.query(
    "UPDATE actividad_agenda SET estado = 'Confirmada', confirmado_en = now() WHERE solicitud_id = $1 AND estado IN ('Provisional','Confirmada')",
    [solicitudId],
  );
  if (r.rowCount === 0) throw new ReglaError("La solicitud no tiene un intervalo reservado; vuelve a enviar la cotización", "RN-14.4");
}

/** Reprogramación (RF-32): asegura el nuevo intervalo en la misma transacción antes de liberar el anterior. */
export async function moverIntervalo(c: PoolClient, solicitudId: number, nuevoInicio: Date) {
  const actual = await q1<{ id: number; inicio: Date; fin: Date; estado: string }>(
    "SELECT id, inicio, fin, estado FROM actividad_agenda WHERE solicitud_id = $1 AND estado IN ('Provisional','Confirmada') FOR UPDATE",
    [solicitudId],
    c,
  );
  if (!actual) throw new ReglaError("La solicitud no tiene un intervalo reservado.");
  const duracion = new Date(actual.fin).getTime() - new Date(actual.inicio).getTime();
  const nuevoFin = new Date(nuevoInicio.getTime() + duracion);
  await q("UPDATE actividad_agenda SET estado = 'Liberada' WHERE id = $1", [actual.id], c);
  await insertarIntervalo(c, { solicitudId, inicio: nuevoInicio, fin: nuevoFin, estado: actual.estado });
  return { inicioOriginal: new Date(actual.inicio), nuevoFin };
}

/** Habilita una sesión grupal: aparta su intervalo completo (RN-04.9). */
export async function abrirSesion(c: PoolClient, sesionId: number) {
  const s = await q1<{ id: number; inicio: Date; fin: Date; estado: string }>("SELECT id, inicio, fin, estado FROM sesion_curso WHERE id = $1 FOR UPDATE", [sesionId], c);
  if (!s) throw new ReglaError("La sesión no existe.");
  if (s.estado !== SESION.PROGRAMADA) throw new ReglaError(`Solo se habilitan sesiones programadas (estado: ${s.estado}).`);
  if (new Date(s.inicio) < new Date()) throw new ReglaError("La sesión ya pasó", "RN-05.1");
  const previo = await q1<{ id: number }>("SELECT id FROM actividad_agenda WHERE sesion_id = $1", [sesionId], c);
  if (previo) {
    await c.query("SAVEPOINT reabrir");
    try {
      await q("UPDATE actividad_agenda SET inicio = $2, fin = $3, estado = 'Confirmada', confirmado_en = now() WHERE id = $1", [previo.id, s.inicio, s.fin], c);
      await c.query("RELEASE SAVEPOINT reabrir");
    } catch (e) {
      await c.query("ROLLBACK TO SAVEPOINT reabrir");
      if ((e as { code?: string }).code === "23P01") throw new ReglaError("El horario de la sesión se cruza con otra actividad", "RN-05.4");
      throw e;
    }
  } else {
    await insertarIntervalo(c, { sesionId, inicio: new Date(s.inicio), fin: new Date(s.fin), estado: AGENDA.CONFIRMADA });
  }
  await q("UPDATE sesion_curso SET estado = 'Abierta' WHERE id = $1", [sesionId], c);
  await recalcularSesion(c, sesionId);
}

/** Intervalos ocupados para la vista pública, sin datos personales (RN-05.6). «pendiente_pago» = apartado provisional (E1: Pendiente de pago). */
export async function ocupacionPublica(desde: Date, hasta: Date) {
  return q<{ inicio: Date; fin: Date; pendiente_pago: boolean }>(
    `SELECT inicio, fin, (estado = 'Provisional') AS pendiente_pago FROM actividad_agenda
     WHERE estado IN ('Provisional','Confirmada') AND inicio < $2 AND fin > $1 ORDER BY inicio`,
    [desde, hasta],
  );
}

export type FilaAgenda = {
  id: number; inicio: Date; fin: Date; estado: string; solicitud_id: number | null; sesion_id: number | null;
  clienta: string | null; actividad: string; fuera_local: boolean | null; inscritas: number | null; capacidad: number | null; estado_solicitud: string | null; directo: boolean | null; plazo: Date | null;
};

/** Agenda del panel (CU-13) con el detalle de cada intervalo. */
export async function agendaAdmin(desde: Date, hasta: Date): Promise<FilaAgenda[]> {
  return q<FilaAgenda>(
    `SELECT a.id, a.inicio, a.fin, a.estado, a.solicitud_id, a.sesion_id, c.nombre AS clienta,
            COALESCE(sv.nombre, cu1.nombre, cu2.nombre, 'Actividad') AS actividad, s.fuera_local, s.estado AS estado_solicitud, s.registro_directo AS directo, s.plazo_pago_hasta AS plazo,
            CASE WHEN a.sesion_id IS NOT NULL THEN (SELECT count(*)::int FROM solicitud_actividad x WHERE x.sesion_id = a.sesion_id AND x.estado = ANY($3)) END AS inscritas,
            ses2.capacidad
     FROM actividad_agenda a
     LEFT JOIN solicitud_actividad s ON s.id = a.solicitud_id
     LEFT JOIN cliente c ON c.id = s.cliente_id
     LEFT JOIN servicio sv ON sv.id = s.servicio_id
     LEFT JOIN sesion_curso ses1 ON ses1.id = s.sesion_id LEFT JOIN curso cu1 ON cu1.id = ses1.curso_id
     LEFT JOIN sesion_curso ses2 ON ses2.id = a.sesion_id LEFT JOIN curso cu2 ON cu2.id = ses2.curso_id
     WHERE a.estado IN ('Provisional','Confirmada') AND a.inicio < $2 AND a.fin > $1
     ORDER BY a.inicio`,
    [desde, hasta, SOL_CON_RESERVA],
  );
}

/** Entrada del calendario de selección: «o» ocupado en firme (Confirmada), «e» pendiente de pago (cotización enviada, 24 h para el anticipo; apartado provisional que también bloquea) o «p» solicitud pendiente de revisión (solo aviso, RN-05.7). */
export type CasillaCalendario = { i: string; f: string; t: "o" | "e" | "p"; e?: string };

/**
 * Datos del calendario para elegir fecha y hora (próximos 120 días). La vista pública solo trae intervalos ocupados, sin datos personales (RN-05.6).
 * El panel de Andrea suma el nombre de la clienta, el origen (web o registro directo) y las solicitudes aún sin cotizar.
 */
export async function datosCalendario(admin: boolean): Promise<CasillaCalendario[]> {
  const desde = new Date();
  const hasta = new Date(Date.now() + 120 * 86_400_000);
  if (!admin) {
    const o = await ocupacionPublica(desde, hasta);
    return o.map((x) => ({ i: new Date(x.inicio).toISOString(), f: new Date(x.fin).toISOString(), t: x.pendiente_pago ? ("e" as const) : ("o" as const) }));
  }
  const filas = await agendaAdmin(desde, hasta);
  const ocupados: CasillaCalendario[] = filas.map((f) => ({
    i: new Date(f.inicio).toISOString(), f: new Date(f.fin).toISOString(), t: f.estado === "Provisional" ? "e" : "o",
    e: `${f.actividad}${f.clienta ? ` · ${f.clienta}` : ""}${f.estado === "Provisional" ? (f.estado_solicitud === "Plazo vencido pendiente de revisión" ? " · plazo vencido, por revisar" : ` · pendiente de pago${f.plazo ? `, el anticipo vence ${fechaHora(f.plazo)}` : ""}`) : ""}`,
  }));
  const pend = await q<{ inicio: Date; actividad: string; clienta: string; directo: boolean; dur: number }>(
    `SELECT s.inicio_solicitado AS inicio, COALESCE(sv.nombre, cu.nombre, 'Actividad') AS actividad, c.nombre AS clienta, s.registro_directo AS directo,
            CASE WHEN s.tipo = 'curso' THEN 180 ELSE 60 END AS dur
     FROM solicitud_actividad s
     JOIN cliente c ON c.id = s.cliente_id
     LEFT JOIN servicio sv ON sv.id = s.servicio_id
     LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id LEFT JOIN curso cu ON cu.id = ses.curso_id
     WHERE s.estado = 'Pendiente de revisión' AND s.inicio_solicitado IS NOT NULL AND s.inicio_solicitado >= $1 AND s.inicio_solicitado < $2
     ORDER BY s.inicio_solicitado`,
    [desde, hasta],
  );
  const pendientes: CasillaCalendario[] = pend.map((x) => ({
    i: new Date(x.inicio).toISOString(), f: new Date(new Date(x.inicio).getTime() + x.dur * 60_000).toISOString(), t: "p",
    e: `${x.actividad} · ${x.clienta} · ${x.directo ? "registrada por Andrea" : "solicitada en la web"}`,
  }));
  return [...ocupados, ...pendientes];
}

export type PendienteAgenda = { id: number; inicio: Date; actividad: string; clienta: string; directo: boolean; fuera_local: boolean };

/** Solicitudes aún sin cotizar con fecha pedida: no bloquean horario (RN-05.7), pero Andrea las ve en la agenda, vengan de la web o de su registro directo. */
export async function pendientesAgenda(desde: Date, hasta: Date): Promise<PendienteAgenda[]> {
  return q<PendienteAgenda>(
    `SELECT s.id, s.inicio_solicitado AS inicio, COALESCE(sv.nombre, cu.nombre, 'Actividad') AS actividad, c.nombre AS clienta, s.registro_directo AS directo, s.fuera_local
     FROM solicitud_actividad s
     JOIN cliente c ON c.id = s.cliente_id
     LEFT JOIN servicio sv ON sv.id = s.servicio_id
     LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id LEFT JOIN curso cu ON cu.id = ses.curso_id
     WHERE s.estado = 'Pendiente de revisión' AND s.inicio_solicitado >= $1 AND s.inicio_solicitado < $2
     ORDER BY s.inicio_solicitado`,
    [desde, hasta],
  );
}
