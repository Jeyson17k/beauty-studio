// Protege el panel y los archivos privados (RN-02.4) y renueva la sesión del historial mientras se usa (RN-18.9).
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

const clave = () => new TextEncoder().encode(process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "solo-para-desarrollo-cambiar-en-env-local-000000"));

async function valido(token?: string) {
  if (!token) return null;
  try {
    return (await jwtVerify(token, clave())).payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if ((pathname.startsWith("/panel") && !pathname.startsWith("/panel/login")) || pathname.startsWith("/api/archivos")) {
    if (!(await valido(req.cookies.get("bs_admin")?.value))) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      const url = req.nextUrl.clone();
      url.pathname = "/panel/login";
      url.search = `?siguiente=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/historial/mi")) {
    const datos = await valido(req.cookies.get("bs_hist")?.value);
    if (datos) {
      const minutos = 15;
      const res = NextResponse.next();
      const token = await new SignJWT({ cid: datos.cid, whatsapp: datos.whatsapp })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${minutos}m`)
        .sign(clave());
      res.cookies.set("bs_hist", token, { httpOnly: true, sameSite: "strict", path: "/", maxAge: minutos * 60, secure: req.nextUrl.protocol === "https:" });
      return res;
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/panel/:path*", "/api/archivos/:path*", "/historial/mi"] };
