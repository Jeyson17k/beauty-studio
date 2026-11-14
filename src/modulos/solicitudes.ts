// MOD-04 Solicitudes y cotización (CU-03, CU-04, CU-11, CU-12, CU-23, CU-24, CU-28; RF-06 a RF-10, RF-16, RF-17, RF-32).
import type { PoolClient } from "pg";
import { q, q1, tx } from "@/lib/db";
import { ReglaError } from "@/lib/errores";
import { guardarArchivo } from "@/lib/almacenamiento";
import { cuposDisponibles, liberar, moverIntervalo, recalcularSesion } from "./agenda";
import { auditar, notificar } from "./seguridad";
import { identificar } from "./clientas";
import { SOL } from "./estados";

export type DatosServicio = {
  clienteId: string; servicioId: number; inicio: Date; descripcion?: string; fueraLocal: boolean; direccion?: string; referencia?: string; fotos?: File[];
};

function validarFuturo(d: Date) {
  if (Number.isNaN(d.getTime())) throw new ReglaError("Elige una fecha y hora válidas.");
  if (d.getTime() < Date.now() + 30 * 60_000) throw new ReglaError("Elige una fecha y hora futuras", "RN-05.1");
}

/** CU-03: solicitud de servicio de belleza. Queda en Pendiente de revisión y no bloquea horario (RN-07.8, RN-05.7). */
export async function registrarSolicitudServicio(d: DatosServicio, opciones: { directo?: boolean; uid?: number } = {}) {
  validarFuturo(d.inicio);
  if (d.fueraLocal && !(d.direccion && d.direccion.trim().length >= 5)) throw new ReglaError("Escribe la dirección para la atención a domicilio", "RN-07.6");
  if ((d.descripcion ?? "").length > 300) throw new ReglaError("La descripción admite hasta 300 caracteres.");
  const fotos = (d.fotos ?? []).filter((f) => f && f.size > 0);
  if (fotos.length > 5) throw new ReglaError("Puedes adjuntar hasta 5 fotografías.");
  const claves: string[] = [];
  for (const f of fotos) claves.push(await guardarArchivo(f, "fotos"));
  return tx(async (c) => {
    const sv = await q1<{ nombre: string; activo: boolean }>("SELECT nombre, activo FROM servicio WHERE id = $1", [d.servicioId], c);
    if (!sv?.activo) throw new ReglaError("El servicio no está disponible.");
    const s = await q1<{ id: number }>(
      `INSERT INTO solicitud_actividad (cliente_id, tipo, servicio_id, inicio_solicitado, descripcion, fuera_local, direccion, referencia, estado, registro_directo)
       VALUES ($1,'servicio',$2,$3,$4,$5,$6,$7,'Pendiente de revisión',$8) RETURNING id`,
      [d.clienteId, d.servicioId, d.inicio, d.descripcion?.trim() || null, d.fueraLocal, d.fueraLocal ? d.direccion!.trim().slice(0, 250) : null,
       d.fueraLocal ? d.referencia?.trim().slice(0, 150) || null : null, !!opciones.directo],
      c,
    );
    for (const k of claves) await q("INSERT INTO foto_solicitud (solicitud_id, archivo_url) VALUES ($1,$2)", [s!.id, k], c);
    if (!opciones.directo) await notificar(c, "Solicitud nueva", `Nueva solicitud de ${sv.nombre} (#${s!.id}).`, "solicitud_actividad", s!.id);
    await auditar(c, opciones.uid ?? null, opciones.directo ? "Registro directo de solicitud" : "Registrar solicitud web", "solicitud_actividad", s!.id, sv.nombre);
    return s!.id;
  });
}

/** CU-04: clase individual (fecha y hora propias) o inscripción a una sesión grupal (RN-08.3). No aparta cupo todavía (RN-08.6). */
export async function registrarSolicitudCurso(
  d: { clienteId: string; cursoId: number; inicio?: Date; sesionId?: number; descripcion?: string },
  opciones: { directo?: boolean; uid?: number } = {},
) {
  return tx(async (c) => {
    const cu = await q1<{ nombre: string; modalidad: string; duracion_min: number; activo: boolean }>("SELECT nombre, modalidad, duracion_min, activo FROM curso WHERE id = $1", [d.cursoId], c);
    if (!cu?.activo) throw new ReglaError("El curso no está disponible", "RN-08.2");
    let sesionId: number;
    if (cu.modalidad === "individual") {
      if (!d.inicio) throw new ReglaError("Elige fecha y hora para la clase individual.");
      validarFuturo(d.inicio);
      const fin = new Date(d.inicio.getTime() + cu.duracion_min * 60_000);
      // Sesión individual de capacidad 1 (RN-04.6); su intervalo se aparta al enviar la cotización.
      const s = await q1<{ id: number }>("INSERT INTO sesion_curso (curso_id, inicio, fin, capacidad, estado) VALUES ($1,$2,$3,1,'Programada') RETURNING id", [d.cursoId, d.inicio, fin], c);
      sesionId = s!.id;
    } else {
      if (!d.sesionId) throw new ReglaError("Elige una sesión programada.");
      const s = await q1<{ curso_id: number; estado: string; inicio: Date }>("SELECT curso_id, estado, inicio FROM sesion_curso WHERE id = $1", [d.sesionId], c);
      if (!s || s.curso_id !== d.cursoId) throw new ReglaError("La sesión no corresponde al curso.");
      if (s.estado !== "Abierta" || new Date(s.inicio) < new Date()) throw new ReglaError("La sesión no recibe inscripciones", "RN-08.3");
      if ((await cuposDisponibles(c, d.sesionId)) <= 0) throw new ReglaError("La sesión ya no tiene cupos", "RN-08.8");
      const dup = await q1(
        "SELECT 1 FROM solicitud_actividad WHERE cliente_id = $1 AND sesion_id = $2 AND estado NOT IN ('Rechazada','Cancelada','Expirada')",
        [d.clienteId, d.sesionId],
        c,
      );
      if (dup) throw new ReglaError("Ya tienes una inscripción en esta sesión", "RN-08.7");
      sesionId = d.sesionId;
    }
    const sol = await q1<{ id: number }>(
      `INSERT INTO solicitud_actividad (cliente_id, tipo, sesion_id, inicio_solicitado, descripcion, fuera_local, estado, registro_directo)
       VALUES ($1,'curso',$2,NULL,$3,false,'Pendiente de revisión',$4) RETURNING id`,
      [d.clienteId, sesionId, d.descripcion?.trim().slice(0, 300) || null, !!opciones.directo],
      c,
    );
    if (!opciones.directo) await notificar(c, "Solicitud nueva", `Nueva solicitud del curso ${cu.nombre} (#${sol!.id}).`, "solicitud_actividad", sol!.id);
    await auditar(c, opciones.uid ?? null, opciones.directo ? "Registro directo de inscripción" : "Registrar solicitud de curso", "solicitud_actividad", sol!.id, cu.nombre);
    return sol!.id;
  });
}

/** CU-12: cotización. Andrea fija el precio; el sistema calcula 10 % de anticipo y el saldo (RN-10.3). No aparta ni inicia plazo (RN-10.4). */
export async function guardarCotizacion(uid: number, solicitudId: number, precio: number, duracionMin: number, trasladoMin: number | null) {
  if (!(precio > 0) || precio > 1_000_000) throw new ReglaError("Escribe un precio total válido.");
  const precioR = Math.round(precio * 100) / 100;
  const anticipo = Math.round(precioR * 10) / 100;
  return tx(async (c) => {
    const s = await q1<{ estado: string; tipo: string; fuera_local: boolean }>("SELECT estado, tipo, fuera_local FROM solicitud_actividad WHERE id = $1 FOR UPDATE", [solicitudId], c);
    if (!s) throw new ReglaError("La solicitud no existe.");
    if (s.estado !== SOL.PENDIENTE_REVISION) throw new ReglaError("La cotización solo se modifica mientras la solicitud está pendiente de revisión.");
    let duracion = duracionMin;
    let traslado = trasladoMin;
    if (s.tipo === "curso") {
      duracion = 180; // sesiones de tres horas (RN-10.7)
      traslado = null;
    } else {
      if (!Number.isInteger(duracion) || duracion < 15 || duracion > 720) throw new ReglaError("Define la duración en minutos (15 a 720)", "RN-10.6");
      if (s.fuera_local) {
        if (traslado === null || !Number.isInteger(traslado) || traslado < 0 || traslado > 240) throw new ReglaError("Define el tiempo de traslado para el servicio a domicilio", "RN-05.12");
      } else traslado = null;
    }
    await q("UPDATE cotizacion SET vigente = false WHERE solicitud_id = $1 AND vigente", [solicitudId], c);
    const r = await q1<{ id: number }>(
      "INSERT INTO cotizacion (solicitud_id, precio_total, anticipo, saldo, duracion_min, traslado_min, vigente) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id",
      [solicitudId, precioR, anticipo, Math.round((precioR - anticipo) * 100) / 100, duracion, traslado],
      c,
    );
    await auditar(c, uid, "Registrar cotización", "solicitud_actividad", solicitudId, `total ${precioR}, anticipo ${anticipo}`);
    return r!.id;
  });
}

/** CU-23: rechazar (desde revisión) o cancelar (con reserva). Se conserva el registro y los pagos (RN-16.1 a RN-16.6). */
export async function rechazarOCancelar(uid: number, solicitudId: number, motivo: string, origen: "clienta" | "andrea") {
  const m = (motivo || "").trim();
  if (m.length < 3) throw new ReglaError("Escribe el motivo", "RN-16.1");
  return tx(async (c) => {
    const s = await q1<{ estado: string }>("SELECT estado FROM solicitud_actividad WHERE id = $1 FOR UPDATE", [solicitudId], c);
    if (!s) throw new ReglaError("La solicitud no existe.");
    let nuevo: string;
    if (s.estado === SOL.PENDIENTE_REVISION) nuevo = SOL.RECHAZADA;
    else if ([SOL.PENDIENTE_PAGO, SOL.PLAZO_VENCIDO, SOL.CONFIRMADA].includes(s.estado as never)) nuevo = SOL.CANCELADA;
    else if (s.estado === SOL.COTIZACION_ENVIO) throw new ReglaError("Espera el resultado del envío de la cotización antes de cancelar.");
    else throw new ReglaError(`No se puede cancelar una solicitud en estado «${s.estado}».`);
    await q(
      "UPDATE solicitud_actividad SET estado = $2, motivo_cierre = $3, origen_cancelacion = $4, actualizado_en = now() WHERE id = $1",
      [solicitudId, nuevo, m.slice(0, 150), nuevo === SOL.CANCELADA ? origen : null],
      c,
    );
    await liberar(c, solicitudId);
    await auditar(c, uid, nuevo === SOL.RECHAZADA ? "Rechazar solicitud" : `Cancelar solicitud (${origen})`, "solicitud_actividad", solicitudId, m);
    return nuevo;
  });
}

/** CU-24: registro directo de Andrea (RF-17). Sigue las mismas reglas de anticipo, plazo y confirmación (RN-17.5). */
export async function registroDirecto(
  uid: number,
  d: { nombre: string; whatsapp: string; acepta: boolean; tipo: "servicio" | "curso"; servicioId?: number; cursoId?: number; sesionId?: number; inicio?: Date; descripcion?: string; fueraLocal?: boolean; direccion?: string; referencia?: string },
) {
  const cli = await identificar(d.nombre, d.whatsapp, d.acepta);
  if (d.tipo === "servicio") {
    if (!d.servicioId || !d.inicio) throw new ReglaError("Elige el servicio, la fecha y la hora.");
    return registrarSolicitudServicio({ clienteId: cli.id, servicioId: d.servicioId, inicio: d.inicio, descripcion: d.descripcion, fueraLocal: !!d.fueraLocal, direccion: d.direccion, referencia: d.referencia }, { directo: true, uid });
  }
  if (!d.cursoId) throw new ReglaError("Elige el curso.");
  return registrarSolicitudCurso({ clienteId: cli.id, cursoId: d.cursoId, inicio: d.inicio, sesionId: d.sesionId, descripcion: d.descripcion }, { directo: true, uid });
}

/** CU-28: reprogramación autorizada por Andrea (RF-32). Conserva el anticipo y la fecha original. */
export async function reprogramar(uid: number, solicitudId: number, motivo: string, nuevo: { inicio?: Date; sesionId?: number }) {
  return tx(async (c) => {
    const s = await q1<{ estado: string; tipo: string; sesion_id: number | null; inicio_solicitado: Date | null; modalidad: string | null; ses_inicio: Date | null }>(
      `SELECT s.estado, s.tipo, s.sesion_id, s.inicio_solicitado, cu.modalidad, ses.inicio AS ses_inicio
       FROM solicitud_actividad s LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id LEFT JOIN curso cu ON cu.id = ses.curso_id
       WHERE s.id = $1 FOR UPDATE OF s`,
      [solicitudId],
      c,
    );
    if (!s) throw new ReglaError("La solicitud no existe.");
    if (s.estado !== SOL.CONFIRMADA) throw new ReglaError("Solo se reprograman citas o inscripciones confirmadas", "RF-32");
    const original = new Date(s.inicio_solicitado ?? s.ses_inicio!);
    let inicioNuevo: Date;
    if (s.modalidad === "grupal") {
      if (!nuevo.sesionId || nuevo.sesionId === s.sesion_id) throw new ReglaError("Elige otra sesión del curso.");
      const ses = await q1<{ inicio: Date; estado: string; curso_id: number }>("SELECT inicio, estado, curso_id FROM sesion_curso WHERE id = $1 FOR UPDATE", [nuevo.sesionId], c);
      if (!ses || ses.estado !== "Abierta") throw new ReglaError("La sesión elegida no recibe inscripciones.");
      if ((await cuposDisponibles(c, nuevo.sesionId)) <= 0) throw new ReglaError("La sesión elegida no tiene cupos", "RN-32.2");
      await q("UPDATE solicitud_actividad SET sesion_id = $2, actualizado_en = now() WHERE id = $1", [solicitudId, nuevo.sesionId], c);
      await recalcularSesion(c, nuevo.sesionId);
      await recalcularSesion(c, s.sesion_id!);
      inicioNuevo = new Date(ses.inicio);
    } else {
      if (!nuevo.inicio) throw new ReglaError("Elige la nueva fecha y hora.");
      validarFuturo(nuevo.inicio);
      const { nuevoFin } = await moverIntervalo(c, solicitudId, nuevo.inicio); // asegura el nuevo antes de liberar el anterior (RN-32.4)
      if (s.tipo === "servicio") await q("UPDATE solicitud_actividad SET inicio_solicitado = $2, actualizado_en = now() WHERE id = $1", [solicitudId, nuevo.inicio], c);
      else await q("UPDATE sesion_curso SET inicio = $2, fin = $3 WHERE id = $1", [s.sesion_id, nuevo.inicio, nuevoFin], c);
      inicioNuevo = nuevo.inicio;
    }
    await q(
      "INSERT INTO reprogramacion (solicitud_id, inicio_original, inicio_nuevo, motivo, estado, resuelta_en) VALUES ($1,$2,$3,$4,'Aceptada',now())",
      [solicitudId, original, inicioNuevo, motivo?.trim().slice(0, 150) || null],
      c,
    );
    await auditar(c, uid, "Reprogramar", "solicitud_actividad", solicitudId, `${original.toISOString()} → ${inicioNuevo.toISOString()}`);
  });
}

/** RN-32.6: Andrea rechaza la nueva fecha; la reserva original sigue vigente. */
export async function rechazarReprogramacion(uid: number, solicitudId: number, fechaPedida: Date, motivo: string) {
  return tx(async (c: PoolClient) => {
    const s = await q1<{ estado: string; inicio: Date }>(
      "SELECT s.estado, COALESCE(s.inicio_solicitado, ses.inicio) AS inicio FROM solicitud_actividad s LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id WHERE s.id = $1",
      [solicitudId],
      c,
    );
    if (!s || s.estado !== SOL.CONFIRMADA) throw new ReglaError("Solo aplica a solicitudes confirmadas.");
    await q(
      "INSERT INTO reprogramacion (solicitud_id, inicio_original, inicio_nuevo, motivo, estado, resuelta_en) VALUES ($1,$2,$3,$4,'Rechazada',now())",
      [solicitudId, s.inicio, fechaPedida, motivo?.trim().slice(0, 150) || null],
      c,
    );
    await auditar(c, uid, "Rechazar reprogramación", "solicitud_actividad", solicitudId, motivo);
  });
}

// ---------- Consultas del panel ----------

export type FilaSolicitud = {
  id: number; tipo: string; estado: string; actividad: string; clienta: string; whatsapp: string; inicio: Date | null; creado_en: Date;
  plazo_pago_hasta: Date | null; registro_directo: boolean; fuera_local: boolean; precio_total: number | null; ultimo_mensaje: string | null; modalidad: string | null;
};

const BASE = `
  SELECT s.id, s.tipo, s.estado, COALESCE(sv.nombre, cu.nombre) AS actividad, c.nombre AS clienta, c.whatsapp,
         COALESCE(s.inicio_solicitado, ses.inicio) AS inicio, s.creado_en, s.plazo_pago_hasta, s.registro_directo, s.fuera_local,
         co.precio_total, cu.modalidad,
         (SELECT m.estado FROM mensaje_whatsapp m WHERE m.solicitud_id = s.id ORDER BY m.creado_en DESC LIMIT 1) AS ultimo_mensaje
  FROM solicitud_actividad s JOIN cliente c ON c.id = s.cliente_id
  LEFT JOIN servicio sv ON sv.id = s.servicio_id
  LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id LEFT JOIN curso cu ON cu.id = ses.curso_id
  LEFT JOIN cotizacion co ON co.solicitud_id = s.id AND co.vigente`;

export async function listarSolicitudes(f: { estado?: string; tipo?: string; texto?: string } = {}) {
  return q<FilaSolicitud>(
    `${BASE} WHERE ($1::text IS NULL OR s.estado = $1) AND ($2::text IS NULL OR s.tipo = $2)
       AND ($3::text IS NULL OR c.nombre ILIKE '%' || $3 || '%' OR c.whatsapp LIKE '%' || $3 || '%' OR s.id::text = $3)
     ORDER BY CASE s.estado WHEN 'Plazo vencido pendiente de revisión' THEN 0 WHEN 'Pendiente de revisión' THEN 1 WHEN 'Cotización en envío' THEN 2 WHEN 'Pendiente de pago' THEN 3 ELSE 4 END,
              s.creado_en DESC LIMIT 200`,
    [f.estado || null, f.tipo || null, f.texto?.trim() || null],
  );
}

export async function solicitudesPorEstado(estados: string[], limite = 20) {
  return q<FilaSolicitud>(`${BASE} WHERE s.estado = ANY($1) ORDER BY s.creado_en DESC LIMIT $2`, [estados, limite]);
}

export async function detalleSolicitud(id: number) {
  const s = await q1<FilaSolicitud & {
    cliente_id: string; acepta_whatsapp: boolean; acepta_whatsapp_en: Date | null; descripcion: string | null; direccion: string | null; referencia: string | null;
    motivo_cierre: string | null; origen_cancelacion: string | null; revisada_en: Date | null; sesion_id: number | null; servicio_id: number | null; curso_id: number | null;
    anticipo: number | null; saldo: number | null; duracion_min: number | null; traslado_min: number | null; cotizacion_id: number | null; actualizado_en: Date;
  }>(
    `SELECT s.id, s.tipo, s.estado, COALESCE(sv.nombre, cu.nombre) AS actividad, c.nombre AS clienta, c.whatsapp, c.id AS cliente_id, c.acepta_whatsapp, c.acepta_whatsapp_en,
            COALESCE(s.inicio_solicitado, ses.inicio) AS inicio, s.creado_en, s.actualizado_en, s.plazo_pago_hasta, s.registro_directo, s.fuera_local, s.descripcion, s.direccion, s.referencia,
            s.motivo_cierre, s.origen_cancelacion, s.revisada_en, s.sesion_id, s.servicio_id, ses.curso_id, cu.modalidad,
            co.id AS cotizacion_id, co.precio_total, co.anticipo, co.saldo, co.duracion_min, co.traslado_min, NULL AS ultimo_mensaje
     FROM solicitud_actividad s JOIN cliente c ON c.id = s.cliente_id
     LEFT JOIN servicio sv ON sv.id = s.servicio_id
     LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id LEFT JOIN curso cu ON cu.id = ses.curso_id
     LEFT JOIN cotizacion co ON co.solicitud_id = s.id AND co.vigente
     WHERE s.id = $1`,
    [id],
  );
  if (!s) return null;
  const [fotos, agenda, comprobantes, pagos, reprogramaciones, cotizaciones] = await Promise.all([
    q<{ id: number; archivo_url: string }>("SELECT id, archivo_url FROM foto_solicitud WHERE solicitud_id = $1 ORDER BY id", [id]),
    q<{ id: number; inicio: Date; fin: Date; estado: string }>("SELECT id, inicio, fin, estado FROM actividad_agenda WHERE solicitud_id = $1 ORDER BY id DESC", [id]),
    q<{ id: number; archivo_url: string; monto: number; pagado_en: Date; cargado_en: Date; validado_en: Date | null; estado: string }>(
      "SELECT id, archivo_url, monto, pagado_en, cargado_en, validado_en, estado FROM comprobante_pago WHERE solicitud_id = $1 ORDER BY cargado_en DESC",
      [id],
    ),
    q<{ id: number; tipo: string; monto: number; registrado_en: Date; comprobante_id: number | null }>("SELECT id, tipo, monto, registrado_en, comprobante_id FROM pago WHERE solicitud_id = $1 ORDER BY registrado_en", [id]),
    q<{ id: number; inicio_original: Date; inicio_nuevo: Date; motivo: string | null; estado: string; resuelta_en: Date | null }>(
      "SELECT id, inicio_original, inicio_nuevo, motivo, estado, resuelta_en FROM reprogramacion WHERE solicitud_id = $1 ORDER BY id DESC",
      [id],
    ),
    q<{ id: number; precio_total: number; anticipo: number; vigente: boolean; creado_en: Date }>("SELECT id, precio_total, anticipo, vigente, creado_en FROM cotizacion WHERE solicitud_id = $1 ORDER BY id DESC", [id]),
  ]);
  return { ...s, fotos, agenda, comprobantes, pagos, reprogramaciones, cotizaciones };
}
