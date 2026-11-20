// Solo para la demostración (npm run demo): cierra cualquier sesión abierta y lleva al inicio de sesión.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/panel/login", req.url));
  res.cookies.delete("bs_admin");
  res.cookies.delete("bs_perfil");
  return res;
}
