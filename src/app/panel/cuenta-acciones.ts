"use server";
// Contraseña y correo de Andrea con códigos de un solo uso enviados por correo (ver modulos/cuenta.ts).
import { revalidatePath } from "next/cache";
import { aResultado, ReglaError } from "@/lib/errores";
import { q1 } from "@/lib/db";
import { sesionAdmin } from "@/lib/sesion";
import {
  consumirCodigo, enviarCodigo, fijarPassword, fijarUsuario, gastarClaveEmergencia, generarClaveEmergencia, guardarCorreo, verificarClaveEmergencia, normalizarCorreo, ocultarCorreo, recordarUsuario, usuarioPorId, validarPasswordNueva, validarUsuarioNuevo,
  verificarPasswordActual, VIGENCIA_MIN,
} from "@/modulos/cuenta";
import { enviarCorreo, modoCorreo } from "@/lib/correo";
import type { EstadoForm } from "@/componentes/Formulario";

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const pausa = () => new Promise((r) => setTimeout(r, 500)); // frena intentos repetidos

async function uid() {
  const s = await sesionAdmin();
  if (!s) throw new ReglaError("Tu sesión terminó. Vuelve a iniciar sesión.");
  return s.uid;
}

function mensajeEnvio(destino: string, r: { simulado: boolean; codigo?: string }) {
  return r.simulado
    ? `Modo de prueba: no se envió un correo real. Tu código es ${r.codigo}. (Cuando el sistema use correo real, llegará a ${ocultarCorreo(destino)}.)`
    : `Te enviamos un código de 6 dígitos a ${ocultarCorreo(destino)}. Vale ${VIGENCIA_MIN} minutos.`;
}

// ---------- Recuperar la contraseña desde el inicio de sesión (sin sesión) ----------
export async function accionPedirRecuperacion(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const correo = normalizarCorreo(txt(fd, "correo"));
    const u = await q1<{ id: number }>("SELECT id FROM usuario_admin WHERE lower(correo) = $1 AND activo", [correo]);
    if (!u) {
      await pausa(); // no se revela si el correo existe
      return { ok: true, mensaje: "Si ese correo está registrado, te enviamos un código de 6 dígitos. Vale 10 minutos." };
    }
    return { ok: true, mensaje: mensajeEnvio(correo, await enviarCodigo(u.id, "recuperar", correo)) };
  } catch (e) {
    return aResultado(e);
  }
}

export async function accionRestablecerPassword(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const correo = normalizarCorreo(txt(fd, "correo"));
    validarPasswordNueva(String(fd.get("nueva") ?? ""), String(fd.get("repetir") ?? ""));
    const u = await q1<{ id: number }>("SELECT id FROM usuario_admin WHERE lower(correo) = $1 AND activo", [correo]);
    if (!u) {
      await pausa();
      throw new ReglaError("El código no es válido. Pide uno nuevo.");
    }
    try {
      await consumirCodigo(u.id, "recuperar", txt(fd, "codigo"));
    } catch (e) {
      await pausa();
      throw e;
    }
    await fijarPassword(u.id, String(fd.get("nueva")), "recuperar");
    return { ok: true, mensaje: "Contraseña actualizada. Ya puedes iniciar sesión con la nueva." };
  } catch (e) {
    return aResultado(e);
  }
}

// ---------- Cambiar la contraseña desde Configuración (con sesión) ----------
export async function accionPedirCodigoCambio(): Promise<EstadoForm> {
  try {
    const id = await uid();
    const u = await usuarioPorId(id);
    if (!u?.correo) throw new ReglaError("Primero registra tu correo de recuperación (arriba).");
    return { ok: true, mensaje: mensajeEnvio(u.correo, await enviarCodigo(id, "cambiar", u.correo)) };
  } catch (e) {
    return aResultado(e);
  }
}

export async function accionCambiarPasswordConCodigo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const id = await uid();
    validarPasswordNueva(String(fd.get("nueva") ?? ""), String(fd.get("repetir") ?? ""));
    try {
      await consumirCodigo(id, "cambiar", txt(fd, "codigo"));
    } catch (e) {
      await pausa();
      throw e;
    }
    await fijarPassword(id, String(fd.get("nueva")), "cambiar");
    revalidatePath("/panel/configuracion");
    return { ok: true, mensaje: "Contraseña actualizada." };
  } catch (e) {
    return aResultado(e);
  }
}

// ---------- Registrar o cambiar el correo (con sesión) ----------
export async function accionPedirCodigoCorreo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const id = await uid();
    const correo = normalizarCorreo(txt(fd, "correo"));
    try {
      await verificarPasswordActual(id, String(fd.get("password") ?? ""));
    } catch (e) {
      await pausa();
      throw e;
    }
    const otro = await q1("SELECT 1 FROM usuario_admin WHERE lower(correo) = $1 AND id <> $2", [correo, id]);
    if (otro) throw new ReglaError("Ese correo ya está registrado en otra cuenta.");
    return { ok: true, mensaje: mensajeEnvio(correo, await enviarCodigo(id, "correo", correo)) };
  } catch (e) {
    return aResultado(e);
  }
}

export async function accionConfirmarCorreo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const id = await uid();
    let destino: string;
    try {
      destino = (await consumirCodigo(id, "correo", txt(fd, "codigo"))).destino;
    } catch (e) {
      await pausa();
      throw e;
    }
    await guardarCorreo(id, destino);
    revalidatePath("/panel/configuracion");
    return { ok: true, mensaje: `Listo. Tu correo de recuperación es ${ocultarCorreo(destino)}.` };
  } catch (e) {
    return aResultado(e);
  }
}

// ---------- «¿Olvidaste tu usuario?» (sin sesión) ----------
export async function accionRecordarUsuario(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const correo = normalizarCorreo(txt(fd, "correo"));
    const u = await q1<{ id: number; usuario: string }>("SELECT id, usuario FROM usuario_admin WHERE lower(correo) = $1 AND activo", [correo]);
    if (!u) {
      await pausa(); // no se revela si el correo existe
      return { ok: true, mensaje: "Si ese correo está registrado, te enviamos tu usuario." };
    }
    const r = await recordarUsuario(u.id, u.usuario, correo);
    return {
      ok: true,
      mensaje: r.simulado ? `Modo de prueba: no se envió un correo real. Tu usuario es «${r.usuario}».` : `Te enviamos tu usuario a ${ocultarCorreo(correo)}.`,
    };
  } catch (e) {
    return aResultado(e);
  }
}

// ---------- Cambiar el nombre de usuario desde Configuración (con sesión) ----------
export async function accionPedirCodigoUsuario(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const id = await uid();
    const u = await usuarioPorId(id);
    if (!u?.correo) throw new ReglaError("Primero registra tu correo de recuperación (arriba).");
    await validarUsuarioNuevo(id, txt(fd, "usuario_nuevo"));
    return { ok: true, mensaje: mensajeEnvio(u.correo, await enviarCodigo(id, "usuario", u.correo)) };
  } catch (e) {
    return aResultado(e);
  }
}

export async function accionCambiarUsuario(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const id = await uid();
    const nuevo = await validarUsuarioNuevo(id, txt(fd, "usuario_nuevo"));
    try {
      await consumirCodigo(id, "usuario", txt(fd, "codigo"));
    } catch (e) {
      await pausa();
      throw e;
    }
    await fijarUsuario(id, nuevo);
    revalidatePath("/panel/configuracion");
    return { ok: true, mensaje: `Listo. Tu usuario ahora es «${nuevo}». Úsalo la próxima vez que inicies sesión.` };
  } catch (e) {
    return aResultado(e);
  }
}

// ---------- Correo de prueba (con sesión): comprueba que el envío real funciona ----------
export async function accionCorreoPrueba(): Promise<EstadoForm> {
  try {
    const id = await uid();
    const u = await usuarioPorId(id);
    if (!u?.correo) throw new ReglaError("Primero registra tu correo de recuperación.");
    const r = await enviarCorreo({ para: u.correo, asunto: "Correo de prueba · Beauty Studio", texto: "Hola, Andrea.\n\nSi lees esto, el envío de correos de Beauty Studio funciona.\n\nBeauty Studio" });
    if (!r.ok) throw new ReglaError(`No se pudo enviar. Modo de correo: ${modoCorreo()}. Revisa las claves en el archivo .env.local.`);
    return { ok: true, mensaje: r.simulado ? "Modo de prueba: no salió ningún correo real (MAIL_MODE=simulado). Mira la consola del servidor." : `Correo de prueba enviado a ${ocultarCorreo(u.correo)}.` };
  } catch (e) {
    return aResultado(e);
  }
}

// ---------- Clave de emergencia ----------
export async function accionGenerarClaveEmergencia(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const id = await uid();
    try {
      await verificarPasswordActual(id, String(fd.get("password") ?? ""));
    } catch (e) {
      await pausa();
      throw e;
    }
    const clave = await generarClaveEmergencia(id);
    revalidatePath("/panel/configuracion");
    return { ok: true, mensaje: `Tu clave de emergencia es ${clave}. Anótala y guárdala en un lugar seguro: no se vuelve a mostrar. Si generas otra, esta deja de servir.` };
  } catch (e) {
    return aResultado(e);
  }
}

/** Sin sesión: usuario + clave de emergencia + correo nuevo → se envía un código al correo nuevo. */
export async function accionPedirCorreoEmergencia(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const correo = normalizarCorreo(txt(fd, "correo"));
    let id: number;
    try {
      id = await verificarClaveEmergencia(txt(fd, "usuario"), txt(fd, "clave"));
    } catch (e) {
      await pausa();
      throw e;
    }
    const otro = await q1("SELECT 1 FROM usuario_admin WHERE lower(correo) = $1 AND id <> $2", [correo, id]);
    if (otro) throw new ReglaError("Ese correo ya está registrado en otra cuenta.");
    return { ok: true, mensaje: mensajeEnvio(correo, await enviarCodigo(id, "correo", correo)) };
  } catch (e) {
    return aResultado(e);
  }
}

export async function accionConfirmarCorreoEmergencia(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    let id: number;
    try {
      id = await verificarClaveEmergencia(txt(fd, "usuario"), txt(fd, "clave"));
    } catch (e) {
      await pausa();
      throw e;
    }
    let destino: string;
    try {
      destino = (await consumirCodigo(id, "correo", txt(fd, "codigo"))).destino;
    } catch (e) {
      await pausa();
      throw e;
    }
    await guardarCorreo(id, destino);
    await gastarClaveEmergencia(id);
    return { ok: true, mensaje: `Listo. Tu correo de recuperación ahora es ${ocultarCorreo(destino)}. La clave de emergencia ya se usó: genera otra en Configuración.` };
  } catch (e) {
    return aResultado(e);
  }
}
