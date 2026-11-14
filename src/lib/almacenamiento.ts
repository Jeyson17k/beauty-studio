// Almacenamiento de archivos (fotos de referencia y comprobantes).
// En el diseño (D1) es un almacenamiento de objetos compatible con S3. En el entorno de prueba se usa
// una carpeta local con la misma interfaz, fuera de /public, para que los archivos no queden expuestos.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { ReglaError } from "./errores";

const RAIZ = path.resolve(process.env.STORAGE_DIR || "./almacenamiento");
const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" };
export const MAX_BYTES = 8 * 1024 * 1024;

export async function guardarArchivo(archivo: File, carpeta: "fotos" | "comprobantes"): Promise<string> {
  const ext = TIPOS[archivo.type];
  if (!ext) throw new ReglaError("Formato no admitido. Usa una imagen JPG, PNG, WEBP o HEIC" + (carpeta === "comprobantes" ? ", o un PDF." : "."));
  if (archivo.size > MAX_BYTES) throw new ReglaError("El archivo supera los 8 MB.");
  const nombre = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.${ext}`;
  const dir = path.join(RAIZ, carpeta);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, nombre), Buffer.from(await archivo.arrayBuffer()));
  return `${carpeta}/${nombre}`;
}

export async function leerArchivo(clave: string): Promise<{ datos: Buffer; tipo: string } | null> {
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
