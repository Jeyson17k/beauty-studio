// Almacenamiento de archivos (fotos de referencia, comprobantes e imágenes de productos).
// Los archivos se guardan en la tabla archivo_guardado de PostgreSQL, así no dependen de un disco del servidor
// (en los planes gratuitos de alojamiento el disco se borra al reiniciar). Para leer, si una clave no está en la base
// se busca en la carpeta local STORAGE_DIR, donde las versiones anteriores guardaban los archivos.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { q, q1 } from "./db";
import { ReglaError } from "./errores";

const RAIZ = path.resolve(process.env.STORAGE_DIR || "./almacenamiento");
const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" };
export const MAX_BYTES = 8 * 1024 * 1024;

const TIPOS_PRODUCTO = ["image/jpeg", "image/png", "image/webp"]; // HEIC y PDF no se ven en el catálogo

export async function guardarArchivo(archivo: File, carpeta: "fotos" | "comprobantes" | "productos"): Promise<string> {
  const ext = carpeta === "productos" && !TIPOS_PRODUCTO.includes(archivo.type) ? undefined : TIPOS[archivo.type];
  if (!ext) throw new ReglaError(carpeta === "productos" ? "Formato no admitido. Usa una imagen JPG, PNG o WEBP." : "Formato no admitido. Usa una imagen JPG, PNG, WEBP o HEIC" + (carpeta === "comprobantes" ? ", o un PDF." : "."));
  if (archivo.size > MAX_BYTES) throw new ReglaError("El archivo supera los 8 MB.");
  const nombre = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.${ext}`;
  const clave = `${carpeta}/${nombre}`;
  await q("INSERT INTO archivo_guardado (clave, tipo, datos) VALUES ($1, $2, $3)", [clave, archivo.type, Buffer.from(await archivo.arrayBuffer())]);
  return clave;
}

export async function leerArchivo(clave: string): Promise<{ datos: Buffer; tipo: string } | null> {
  const guardado = await q1<{ datos: Buffer; tipo: string }>("SELECT datos, tipo FROM archivo_guardado WHERE clave = $1", [clave]);
  if (guardado) return { datos: guardado.datos, tipo: guardado.tipo };
  const limpio = path.normalize(clave).replace(/^(\.\.[/\\])+/, "");
  const ruta = path.join(RAIZ, limpio);
  if (!ruta.startsWith(RAIZ)) return null;
  try {
    const datos = await fs.readFile(ruta);
    const ext = path.extname(ruta).slice(1);
    const tipo = Object.entries(TIPOS).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
    return { datos, tipo };
  } catch {
    return null;
  }
}
