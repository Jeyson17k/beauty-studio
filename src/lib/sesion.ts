// Sesiones firmadas (JWT HS256 con jose) en cookies httpOnly.
// - bs_admin: sesión de Andrea en el panel (RN-02.4).
// - bs_perfil: Andrea viendo la página como clienta. No da ningún acceso al panel: para volver se pide la contraseña.
// - bs_clienta: nombre y WhatsApp de la clienta durante la visita (RN-01.3, RN-01.5). No da acceso al historial.
// - bs_hist: sesión de solo lectura del historial tras validar el código (RN-18.9).
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const clave = () => new TextEncoder().encode(process.env.SESSION_SECRET || "solo-para-desarrollo-cambiar-en-env-local-000000");
const segura = process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https");

export type SesionAdmin = { uid: number; usuario: string; rol: string };
export type SesionPerfil = SesionAdmin;
export type SesionClienta = { cid: string; nombre: string; whatsapp: string };
export type SesionHistorial = { cid: string; whatsapp: string };

async function firmar(datos: Record<string, unknown>, duracion: string) {
  return new SignJWT(datos).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(duracion).sign(clave());
}

export async function verificarToken<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    return payload as unknown as T;
  } catch {
    return null;
  }
}

export async function abrirSesionAdmin(s: SesionAdmin) {
  (await cookies()).set("bs_admin", await firmar(s, "8h"), { httpOnly: true, sameSite: "lax", secure: segura, path: "/", maxAge: 8 * 3600 });
}
export async function cerrarSesionAdmin() {
  (await cookies()).delete("bs_admin");
}
export async function sesionAdmin(): Promise<SesionAdmin | null> {
  return verificarToken<SesionAdmin>((await cookies()).get("bs_admin")?.value);
}

export async function abrirPerfilClienta(s: SesionPerfil) {
  (await cookies()).set("bs_perfil", await firmar(s, "12h"), { httpOnly: true, sameSite: "lax", secure: segura, path: "/", maxAge: 12 * 3600 });
}
export async function sesionPerfilClienta(): Promise<SesionPerfil | null> {
  return verificarToken<SesionPerfil>((await cookies()).get("bs_perfil")?.value);
}
export async function cerrarPerfilClienta() {
  (await cookies()).delete("bs_perfil");
}

export async function guardarClienta(s: SesionClienta) {
  // Cookie de sesión del navegador: se reutiliza en la misma visita (RN-01.5).
  (await cookies()).set("bs_clienta", await firmar(s, "1d"), { httpOnly: true, sameSite: "lax", secure: segura, path: "/" });
}
export async function sesionClienta(): Promise<SesionClienta | null> {
  return verificarToken<SesionClienta>((await cookies()).get("bs_clienta")?.value);
}
export async function olvidarClienta() {
  (await cookies()).delete("bs_clienta");
}

export async function abrirHistorial(s: SesionHistorial, minutos: number) {
  (await cookies()).set("bs_hist", await firmar(s, `${minutos}m`), { httpOnly: true, sameSite: "strict", secure: segura, path: "/", maxAge: minutos * 60 });
}
export async function sesionHistorial(): Promise<SesionHistorial | null> {
  return verificarToken<SesionHistorial>((await cookies()).get("bs_hist")?.value);
}
export async function cerrarHistorial() {
  (await cookies()).delete("bs_hist");
}
