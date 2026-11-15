// Cuenta de Andrea: correo de recuperación y códigos de un solo uso enviados por correo.
// Sirve para (1) recuperar la contraseña desde el inicio de sesión, (2) cambiarla desde Configuración y
// (3) registrar o cambiar el correo (el código llega al correo nuevo para comprobar que es de ella).
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool, q, q1, tx } from "@/lib/db";
import { ReglaError } from "@/lib/errores";
import { enviarCorreo, modoCorreo } from "@/lib/correo";
import { auditar } from "@/modulos/seguridad";

export type Proposito = "recuperar" | "cambiar" | "correo" | "usuario" | "recordar";

export const VIGENCIA_MIN = 10;
export const MAX_INTENTOS = 5;
export const MAX_POR_HORA = 5;
export const MIN_PASSWORD = 10;

const huella = (codigo: string) => crypto.createHmac("sha256", process.env.SESSION_SECRET || "solo-desarrollo").update(codigo).digest("hex");
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizarCorreo(c: string): string {
  const v = (c || "").trim().toLowerCase();
  if (v.length > 120 || !CORREO_RE.test(v)) throw new ReglaError("Escribe un correo válido, por ejemplo nombre@gmail.com.");
  return v;
}

/** Muestra el correo parcialmente: an***@gmail.com */
export function ocultarCorreo(c: string): string {
  const [u, d] = c.split("@");
  return `${u.slice(0, 2)}${"*".repeat(Math.max(3, u.length - 2))}@${d}`;
}

export const usuarioPorId = (id: number) =>
  q1<{ id: number; usuario: string; correo: string | null; hash_password: string }>("SELECT id, usuario, correo, hash_password FROM usuario_admin WHERE id = $1 AND activo", [id]);

const TEXTOS: Record<Proposito, { asunto: string; intro: string }> = {
  recuperar: { asunto: "Código para recuperar tu contraseña · Beauty Studio", intro: "Usa este código para crear una contraseña nueva en el panel de Beauty Studio." },
  cambiar: { asunto: "Código para cambiar tu contraseña · Beauty Studio", intro: "Usa este código para confirmar el cambio de tu contraseña en el panel de Beauty Studio." },
  correo: { asunto: "Código para confirmar tu correo · Beauty Studio", intro: "Usa este código para confirmar este correo como el correo de recuperación de tu panel de Beauty Studio." },
  usuario: { asunto: "Código para cambiar tu usuario · Beauty Studio", intro: "Usa este código para confirmar el cambio de tu nombre de usuario en el panel de Beauty Studio." },
  recordar: { asunto: "Tu usuario · Beauty Studio", intro: "" },
};

/**
 * Crea un código de 6 dígitos y lo envía a `destino`. Cada código vale 10 minutos y se puede usar una sola vez;
 * pedir uno nuevo anula los anteriores. Máximo 5 códigos por hora.
 * Devuelve el código solo en modo simulado (para probar sin correo real).
 */
export async function enviarCodigo(usuarioId: number, proposito: Proposito, destino: string): Promise<{ simulado: boolean; codigo?: string }> {
  const codigo = await tx(async (c) => {
    const rec = await q1<{ n: number }>("SELECT count(*)::int AS n FROM codigo_cuenta WHERE usuario_id = $1 AND solicitado_en > now() - interval '1 hour'", [usuarioId], c);
    if ((rec?.n ?? 0) >= MAX_POR_HORA) throw new ReglaError("Pediste demasiados códigos. Inténtalo de nuevo dentro de una hora.");
    await q("UPDATE codigo_cuenta SET usado_en = now() WHERE usuario_id = $1 AND usado_en IS NULL", [usuarioId], c);
    const cod = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await q(
      "INSERT INTO codigo_cuenta (usuario_id, proposito, destino, codigo_hash, expira_en) VALUES ($1,$2,$3,$4, now() + make_interval(mins => $5))",
      [usuarioId, proposito, destino, huella(cod), VIGENCIA_MIN],
      c,
    );
    return cod;
  });
  const t = TEXTOS[proposito];
  const r = await enviarCorreo({
    para: destino,
    asunto: t.asunto,
    texto: `Hola, Andrea.\n\n${t.intro}\n\nTu código es: ${codigo}\n\nVale ${VIGENCIA_MIN} minutos y solo se puede usar una vez. Si tú no lo pediste, ignora este mensaje: no se cambia nada.\n\nBeauty Studio`,
  });
  if (!r.ok) {
    await q("UPDATE codigo_cuenta SET usado_en = now() WHERE usuario_id = $1 AND usado_en IS NULL", [usuarioId]);
    throw new ReglaError("No pudimos enviar el correo. Revisa la configuración del correo e inténtalo de nuevo.");
  }
  return r.simulado && modoCorreo() === "simulado" ? { simulado: true, codigo } : { simulado: false };
}

/** Comprueba el código sin gastarlo demasiado: 5 intentos fallidos lo bloquean; un acierto lo marca como usado. */
export async function consumirCodigo(usuarioId: number, proposito: Proposito, codigo: string): Promise<{ destino: string }> {
  const limpio = (codigo || "").replace(/\D/g, "");
  if (limpio.length !== 6) throw new ReglaError("Escribe el código de 6 dígitos.");
  const r = await tx(async (c) => {
    const cod = await q1<{ id: number; destino: string; codigo_hash: string; intentos: number; expira_en: Date }>(
      `SELECT id, destino, codigo_hash, intentos, expira_en FROM codigo_cuenta
       WHERE usuario_id = $1 AND proposito = $2 AND usado_en IS NULL ORDER BY solicitado_en DESC LIMIT 1 FOR UPDATE`,
      [usuarioId, proposito],
      c,
    );
    if (!cod) return { error: "Ese código ya no sirve. Pide uno nuevo." };
    if (new Date(cod.expira_en) < new Date()) {
      await q("UPDATE codigo_cuenta SET usado_en = now() WHERE id = $1", [cod.id], c);
      return { error: "El código venció. Pide uno nuevo." };
    }
    const a = Buffer.from(cod.codigo_hash, "hex");
    const b = Buffer.from(huella(limpio), "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      const intentos = cod.intentos + 1;
      const bloqueado = intentos >= MAX_INTENTOS;
      await q("UPDATE codigo_cuenta SET intentos = $2, usado_en = CASE WHEN $3 THEN now() END WHERE id = $1", [cod.id, intentos, bloqueado], c);
      return { error: bloqueado ? "Fallaste demasiadas veces. Pide un código nuevo." : `Código incorrecto. Te quedan ${MAX_INTENTOS - intentos} intento(s).` };
    }
    await q("UPDATE codigo_cuenta SET usado_en = now() WHERE id = $1", [cod.id], c);
    return { destino: cod.destino };
  });
  if ("error" in r) throw new ReglaError(r.error!);
  return { destino: r.destino! };
}

export function validarPasswordNueva(nueva: string, repetir: string) {
  if (nueva.length < MIN_PASSWORD) throw new ReglaError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  if (nueva !== repetir) throw new ReglaError("Las contraseñas no coinciden.");
}

/** Fija la contraseña nueva (después de validar el código) y deja constancia en la auditoría. */
export async function fijarPassword(usuarioId: number, nueva: string, origen: "recuperar" | "cambiar") {
  await q("UPDATE usuario_admin SET hash_password = $1 WHERE id = $2", [await bcrypt.hash(nueva, 10), usuarioId]);
  await auditar(pool, usuarioId, origen === "recuperar" ? "Recuperar contraseña por correo" : "Cambiar contraseña por correo", "usuario_admin", usuarioId);
}

export async function guardarCorreo(usuarioId: number, correo: string) {
  const otro = await q1("SELECT 1 FROM usuario_admin WHERE lower(correo) = $1 AND id <> $2", [correo, usuarioId]);
  if (otro) throw new ReglaError("Ese correo ya está registrado en otra cuenta.");
  await q("UPDATE usuario_admin SET correo = $1 WHERE id = $2", [correo, usuarioId]);
  await auditar(pool, usuarioId, "Registrar correo de recuperación", "usuario_admin", usuarioId);
}

export async function verificarPasswordActual(usuarioId: number, password: string) {
  const u = await usuarioPorId(usuarioId);
  if (!u || !(await bcrypt.compare(password, u.hash_password))) throw new ReglaError("La contraseña actual no es correcta.");
}

// ---------- Nombre de usuario ----------
export const USUARIO_RE = /^[a-z0-9._-]{4,30}$/;

export function normalizarUsuario(u: string): string {
  const v = (u || "").trim().toLowerCase();
  if (!USUARIO_RE.test(v)) throw new ReglaError("El usuario debe tener de 4 a 30 caracteres: letras sin tilde, números, punto, guion o guion bajo.");
  return v;
}

/** Comprueba que el usuario nuevo sea distinto del actual y no lo use otra cuenta. */
export async function validarUsuarioNuevo(usuarioId: number, nuevo: string): Promise<string> {
  const v = normalizarUsuario(nuevo);
  const actual = await usuarioPorId(usuarioId);
  if (actual?.usuario === v) throw new ReglaError("Ese ya es tu usuario actual.");
  if (await q1("SELECT 1 FROM usuario_admin WHERE lower(usuario) = $1 AND id <> $2", [v, usuarioId])) throw new ReglaError("Ese usuario ya está en uso. Elige otro.");
  return v;
}

export async function fijarUsuario(usuarioId: number, nuevo: string) {
  const v = await validarUsuarioNuevo(usuarioId, nuevo);
  const antes = await usuarioPorId(usuarioId);
  await q("UPDATE usuario_admin SET usuario = $1 WHERE id = $2", [v, usuarioId]);
  await auditar(pool, usuarioId, "Cambiar nombre de usuario por correo", "usuario_admin", usuarioId, `${antes?.usuario} → ${v}`);
  return v;
}

/**
 * «¿Olvidaste tu usuario?»: envía el usuario al correo registrado. Cuenta contra el límite de 5 envíos por hora
 * (se anota como un código ya usado) para que nadie pueda llenarle el correo a Andrea.
 */
export async function recordarUsuario(usuarioId: number, usuario: string, correo: string) {
  const rec = await q1<{ n: number }>("SELECT count(*)::int AS n FROM codigo_cuenta WHERE usuario_id = $1 AND solicitado_en > now() - interval '1 hour'", [usuarioId]);
  if ((rec?.n ?? 0) >= MAX_POR_HORA) throw new ReglaError("Pediste demasiados envíos. Inténtalo de nuevo dentro de una hora.");
  await q("INSERT INTO codigo_cuenta (usuario_id, proposito, destino, codigo_hash, expira_en, usado_en) VALUES ($1,'recordar',$2,$3, now(), now())", [usuarioId, correo, huella(crypto.randomUUID())]);
  const r = await enviarCorreo({
    para: correo,
    asunto: TEXTOS.recordar.asunto,
    texto: `Hola, Andrea.\n\nPediste recordar tu usuario del panel de Beauty Studio.\n\nTu usuario es: ${usuario}\n\nSi tú no lo pediste, ignora este mensaje.\n\nBeauty Studio`,
  });
  if (!r.ok) throw new ReglaError("No pudimos enviar el correo. Revisa la configuración del correo e inténtalo de nuevo.");
  return { simulado: r.simulado && modoCorreo() === "simulado", usuario };
}

// ---------- Clave de emergencia (si Andrea pierde el acceso a su correo) ----------
// Una clave larga que se muestra una sola vez; solo se guarda su huella. Sirve para registrar un correo nuevo desde
// el inicio de sesión cuando ya no tiene el correo ni la contraseña. Se gasta al usarla y hay que generar otra.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O, I, 0, 1 para que no se confundan al copiarla

export const limpiarClave = (c: string) => (c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function crearClaveEmergencia(): string {
  const c = Array.from({ length: 16 }, () => ALFABETO[crypto.randomInt(0, ALFABETO.length)]).join("");
  return c.match(/.{4}/g)!.join("-");
}

/** Genera una clave nueva (anula la anterior) y la devuelve en claro, esta única vez. */
export async function generarClaveEmergencia(usuarioId: number): Promise<string> {
  const clave = crearClaveEmergencia();
  await q("UPDATE usuario_admin SET clave_emergencia_hash = $1 WHERE id = $2", [huella("CE:" + limpiarClave(clave)), usuarioId]);
  await auditar(pool, usuarioId, "Generar clave de emergencia", "usuario_admin", usuarioId);
  return clave;
}

/** Devuelve el id del usuario si usuario + clave de emergencia son correctos; si no, error genérico. */
export async function verificarClaveEmergencia(usuario: string, clave: string): Promise<number> {
  const u = await q1<{ id: number; clave_emergencia_hash: string | null }>(
    "SELECT id, clave_emergencia_hash FROM usuario_admin WHERE lower(usuario) = $1 AND activo",
    [(usuario || "").trim().toLowerCase()],
  );
  const esperado = u?.clave_emergencia_hash ? Buffer.from(u.clave_emergencia_hash, "hex") : null;
  const dado = Buffer.from(huella("CE:" + limpiarClave(clave)), "hex");
  if (!u || !esperado || esperado.length !== dado.length || !crypto.timingSafeEqual(esperado, dado)) {
    throw new ReglaError("El usuario o la clave de emergencia no son correctos.");
  }
  return u.id;
}

/** Tras usarla, la clave se anula: hay que generar otra desde Configuración. */
export async function gastarClaveEmergencia(usuarioId: number) {
  await q("UPDATE usuario_admin SET clave_emergencia_hash = NULL WHERE id = $1", [usuarioId]);
  await auditar(pool, usuarioId, "Cambiar correo con clave de emergencia", "usuario_admin", usuarioId);
}

export const tieneClaveEmergencia = async (usuarioId: number) =>
  !!(await q1<{ c: string | null }>("SELECT clave_emergencia_hash AS c FROM usuario_admin WHERE id = $1 AND clave_emergencia_hash IS NOT NULL", [usuarioId]));
