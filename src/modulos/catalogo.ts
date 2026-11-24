// MOD-02 Servicios y cursos (CU-02, CU-25, CU-26): catálogo público, sesiones y cupos.
import { q, q1, tx, pool } from "@/lib/db";
import { ReglaError } from "@/lib/errores";
import { abrirSesion, cuposDisponibles, liberar, recalcularSesion } from "./agenda";
import { auditar } from "./seguridad";
import { SESION, SOL } from "./estados";

export type Servicio = { id: number; nombre: string; descripcion: string; precio_base: number | null; imagen_url: string | null; activo: boolean };
export type Curso = { id: number; nombre: string; descripcion: string; modalidad: "individual" | "grupal"; duracion_min: number; precio_base: number | null; activo: boolean };
export type Sesion = { id: number; curso_id: number; curso: string; inicio: Date; fin: Date; capacidad: number; estado: string; libres: number };

export const serviciosActivos = () => q<Servicio>("SELECT * FROM servicio WHERE activo ORDER BY id");
export const todosLosServicios = () => q<Servicio>("SELECT * FROM servicio ORDER BY activo DESC, nombre");
export const servicio = (id: number) => q1<Servicio>("SELECT * FROM servicio WHERE id = $1", [id]);

export const cursosActivos = () => q<Curso>("SELECT * FROM curso WHERE activo ORDER BY modalidad, nombre");
export const todosLosCursos = () => q<Curso>("SELECT * FROM curso ORDER BY activo DESC, nombre");
export const curso = (id: number) => q1<Curso>("SELECT * FROM curso WHERE id = $1", [id]);

/** Sesiones grupales con cupos para la vista pública (RN-08.3). */
export async function sesionesAbiertas(cursoId?: number): Promise<Sesion[]> {
  const filas = await q<Omit<Sesion, "libres">>(
    `SELECT s.id, s.curso_id, cu.nombre AS curso, s.inicio, s.fin, s.capacidad, s.estado
     FROM sesion_curso s JOIN curso cu ON cu.id = s.curso_id
     WHERE cu.modalidad = 'grupal' AND cu.activo AND s.estado IN ('Abierta','Llena') AND s.inicio > now()
       AND ($1::int IS NULL OR s.curso_id = $1) ORDER BY s.inicio`,
    [cursoId ?? null],
  );
  return Promise.all(filas.map(async (f) => ({ ...f, libres: await cuposDisponibles(pool, f.id) })));
}

/** Sesiones de cursos grupales para el panel (CU-26), con cupos apartados y confirmados (RN-29.8). */
export async function sesionesPanel() {
  return q<Sesion & { apartados: number; confirmados: number }>(
    `SELECT s.id, s.curso_id, cu.nombre AS curso, s.inicio, s.fin, s.capacidad, s.estado,
       (SELECT count(*)::int FROM solicitud_actividad a WHERE a.sesion_id = s.id AND a.estado IN ('Cotización en envío','Pendiente de pago','Plazo vencido pendiente de revisión')) AS apartados,
       (SELECT count(*)::int FROM solicitud_actividad a WHERE a.sesion_id = s.id AND a.estado IN ('Confirmada','Realizada','No asistida','Cerrada')) AS confirmados,
       0 AS libres
     FROM sesion_curso s JOIN curso cu ON cu.id = s.curso_id
     WHERE cu.modalidad = 'grupal' ORDER BY s.inicio DESC LIMIT 60`,
  );
}

export async function guardarServicio(uid: number, d: { id?: number; nombre: string; descripcion: string; precio_base: number | null; imagen_url: string | null; activo: boolean }) {
  return tx(async (c) => {
    if (d.id) {
      await q("UPDATE servicio SET nombre=$2, descripcion=$3, precio_base=$4, imagen_url=$5, activo=$6 WHERE id=$1", [d.id, d.nombre, d.descripcion, d.precio_base, d.imagen_url, d.activo], c);
      await auditar(c, uid, "Modificar servicio", "servicio", d.id, d.nombre);
      return d.id;
    }
    const r = await q1<{ id: number }>("INSERT INTO servicio (nombre, descripcion, precio_base, imagen_url, activo) VALUES ($1,$2,$3,$4,$5) RETURNING id", [d.nombre, d.descripcion, d.precio_base, d.imagen_url, d.activo], c);
    await auditar(c, uid, "Registrar servicio", "servicio", r!.id, d.nombre);
    return r!.id;
  });
}

export async function guardarCurso(uid: number, d: { id?: number; nombre: string; descripcion: string; modalidad: "individual" | "grupal"; precio_base: number | null; activo: boolean }) {
  return tx(async (c) => {
    if (d.id) {
      await q("UPDATE curso SET nombre=$2, descripcion=$3, modalidad=$4, precio_base=$5, activo=$6 WHERE id=$1", [d.id, d.nombre, d.descripcion, d.modalidad, d.precio_base, d.activo], c);
      await auditar(c, uid, "Modificar curso", "curso", d.id, d.nombre);
      return d.id;
    }
    // Cada clase es una sesión de tres horas (RN-04.4).
    const r = await q1<{ id: number }>("INSERT INTO curso (nombre, descripcion, modalidad, duracion_min, precio_base, activo) VALUES ($1,$2,$3,180,$4,$5) RETURNING id", [d.nombre, d.descripcion, d.modalidad, d.precio_base, d.activo], c);
    await auditar(c, uid, "Registrar curso", "curso", r!.id, d.nombre);
    return r!.id;
  });
}

/** Programa una sesión grupal de tres horas (RN-04.4, RN-04.6). Puede habilitarse de inmediato. */
export async function programarSesion(uid: number, cursoId: number, inicio: Date, capacidad: number, habilitar: boolean) {
  if (inicio < new Date()) throw new ReglaError("No se pueden programar sesiones en el pasado", "RN-05.1");
  if (!Number.isInteger(capacidad) || capacidad < 2 || capacidad > 50) throw new ReglaError("La capacidad de una sesión grupal va de 2 a 50 participantes.");
  return tx(async (c) => {
    const cu = await q1<Curso>("SELECT * FROM curso WHERE id = $1", [cursoId], c);
    if (!cu || cu.modalidad !== "grupal") throw new ReglaError("Elige un curso grupal.");
    const fin = new Date(inicio.getTime() + cu.duracion_min * 60_000);
    const s = await q1<{ id: number }>("INSERT INTO sesion_curso (curso_id, inicio, fin, capacidad, estado) VALUES ($1,$2,$3,$4,'Programada') RETURNING id", [cursoId, inicio, fin, capacidad], c);
    if (habilitar) await abrirSesion(c, s!.id);
    await auditar(c, uid, "Programar sesión grupal", "sesion_curso", s!.id, `${cu.nombre}, capacidad ${capacidad}`);
    return s!.id;
  });
}

export async function habilitarSesion(uid: number, sesionId: number) {
  return tx(async (c) => {
    await abrirSesion(c, sesionId);
    await auditar(c, uid, "Habilitar inscripciones", "sesion_curso", sesionId);
  });
}

/** Cancela una sesión grupal: libera su intervalo y cancela las inscripciones abiertas (RN-04.10). */
export async function cancelarSesion(uid: number, sesionId: number, motivo: string) {
  return tx(async (c) => {
    const s = await q1<{ estado: string }>("SELECT estado FROM sesion_curso WHERE id = $1 FOR UPDATE", [sesionId], c);
    if (!s) throw new ReglaError("La sesión no existe.");
    if ([SESION.REALIZADA, SESION.CANCELADA].includes(s.estado as never)) throw new ReglaError("La sesión ya está cerrada.");
    const inscritas = await q<{ id: number }>(
      "SELECT id FROM solicitud_actividad WHERE sesion_id = $1 AND estado = ANY($2) FOR UPDATE",
      [sesionId, [SOL.PENDIENTE_REVISION, SOL.COTIZACION_ENVIO, SOL.PENDIENTE_PAGO, SOL.PLAZO_VENCIDO, SOL.CONFIRMADA]],
      c,
    );
    for (const i of inscritas) {
      await q(
        "UPDATE solicitud_actividad SET estado = 'Cancelada', motivo_cierre = $2, origen_cancelacion = 'negocio', actualizado_en = now() WHERE id = $1",
        [i.id, `Sesión cancelada: ${motivo}`.slice(0, 150)],
        c,
      );
    }
    await q("UPDATE sesion_curso SET estado = 'Cancelada' WHERE id = $1", [sesionId], c);
    await q("UPDATE actividad_agenda SET estado = 'Liberada' WHERE sesion_id = $1 AND estado <> 'Liberada'", [sesionId], c);
    for (const i of inscritas) await liberar(c, i.id);
    await auditar(c, uid, "Cancelar sesión grupal", "sesion_curso", sesionId, motivo);
    return inscritas.length;
  });
}

export async function marcarSesionRealizada(uid: number, sesionId: number) {
  return tx(async (c) => {
    const s = await q1<{ inicio: Date; estado: string }>("SELECT inicio, estado FROM sesion_curso WHERE id = $1 FOR UPDATE", [sesionId], c);
    if (!s) throw new ReglaError("La sesión no existe.");
    if (new Date(s.inicio) > new Date()) throw new ReglaError("La sesión todavía no ha ocurrido", "RN-31.2");
    await q("UPDATE sesion_curso SET estado = 'Realizada' WHERE id = $1", [sesionId], c);
    await recalcularSesion(c, sesionId);
    await auditar(c, uid, "Marcar sesión realizada", "sesion_curso", sesionId);
  });
}
