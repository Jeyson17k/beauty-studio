// MOD-10 Seguridad y auditoría: inicio de sesión de Andrea (CU-10), auditoría (RNF-08) y notificaciones del panel.
import bcrypt from "bcryptjs";
import { q, q1, Db, pool } from "@/lib/db";

const HASH_FALSO = bcrypt.hashSync("no-es-una-clave", 10);

export async function validarCredenciales(usuario: string, password: string) {
  const u = await q1<{ id: number; usuario: string; rol: string; hash_password: string; activo: boolean }>(
    "SELECT id, usuario, rol, hash_password, activo FROM usuario_admin WHERE lower(usuario) = lower($1)",
    [usuario.trim()],
  );
  // Se compara siempre para no revelar si el usuario existe.
  const ok = await bcrypt.compare(password, u?.hash_password ?? HASH_FALSO);
  if (!u || !u.activo || !ok) return null;
  return { uid: u.id, usuario: u.usuario, rol: u.rol };
}

export async function cambiarPassword(uid: number, nueva: string) {
  await q("UPDATE usuario_admin SET hash_password = $1 WHERE id = $2", [await bcrypt.hash(nueva, 10), uid]);
}

export async function auditar(db: Db, usuarioId: number | null, accion: string, entidad: string, entidadId: number | null, detalle?: string) {
  await q(
    "INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle) VALUES ($1,$2,$3,$4,$5)",
    [usuarioId, accion.slice(0, 80), entidad.slice(0, 50), entidadId, detalle ? detalle.slice(0, 250) : null],
    db,
  );
}

/** Notifica a todas las administradoras activas (hoy, solo Andrea). */
export async function notificar(db: Db, tipo: string, mensaje: string, entidad?: string, entidadId?: number | null) {
  await q(
    `INSERT INTO notificacion (usuario_id, tipo, mensaje, entidad, entidad_id)
     SELECT id, $1, $2, $3, $4 FROM usuario_admin WHERE activo`,
    [tipo.slice(0, 30), mensaje.slice(0, 300), entidad ?? null, entidadId ?? null],
    db,
  );
}

export async function notificacionesPendientes(uid: number, limite = 30) {
  return q<{ id: number; tipo: string; mensaje: string; entidad: string | null; entidad_id: number | null; creado_en: Date }>(
    "SELECT id, tipo, mensaje, entidad, entidad_id, creado_en FROM notificacion WHERE usuario_id = $1 AND NOT leida ORDER BY creado_en DESC LIMIT $2",
    [uid, limite],
  );
}

export async function marcarLeidas(uid: number, ids?: number[]) {
  if (ids?.length) await q("UPDATE notificacion SET leida = true WHERE usuario_id = $1 AND id = ANY($2)", [uid, ids]);
  else await q("UPDATE notificacion SET leida = true WHERE usuario_id = $1", [uid]);
}

export async function ultimaAuditoria(limite = 50, db: Db = pool) {
  return q<{ id: number; usuario: string | null; accion: string; entidad: string; entidad_id: number | null; detalle: string | null; marca_tiempo: Date }>(
    `SELECT a.id, u.usuario, a.accion, a.entidad, a.entidad_id, a.detalle, a.marca_tiempo
     FROM auditoria a LEFT JOIN usuario_admin u ON u.id = a.usuario_id ORDER BY a.marca_tiempo DESC LIMIT $1`,
    [limite],
    db,
  );
}
