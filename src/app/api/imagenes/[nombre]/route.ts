// Fotos de productos del catálogo (públicas). Solo sirve la carpeta «productos»; los comprobantes y fotos de referencia siguen privados.
import { NextRequest, NextResponse } from "next/server";
import { leerArchivo } from "@/lib/almacenamiento";

export async function GET(_: NextRequest, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!/^[A-Za-z0-9-]+\.(jpg|png|webp)$/.test(nombre)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const archivo = await leerArchivo(`productos/${nombre}`);
  if (!archivo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return new NextResponse(new Uint8Array(archivo.datos), { headers: { "Content-Type": archivo.tipo, "Cache-Control": "public, max-age=31536000, immutable" } });
}
