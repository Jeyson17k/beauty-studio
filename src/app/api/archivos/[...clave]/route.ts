// Archivos privados (fotos de referencia y comprobantes). Solo para la administradora (protegido en middleware).
import { NextRequest, NextResponse } from "next/server";
import { leerArchivo } from "@/lib/almacenamiento";
import { sesionAdmin } from "@/lib/sesion";

export async function GET(_: NextRequest, { params }: { params: Promise<{ clave: string[] }> }) {
  if (!(await sesionAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const archivo = await leerArchivo((await params).clave.join("/"));
  if (!archivo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return new NextResponse(new Uint8Array(archivo.datos), { headers: { "Content-Type": archivo.tipo, "Cache-Control": "private, max-age=3600" } });
}
