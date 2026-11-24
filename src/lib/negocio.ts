// Datos del negocio que se muestran en la página pública (nombre, ciudad, dirección, WhatsApp).
// Se editan desde el panel en Configuración; aquí solo se leen, con valores neutros si todavía no existen.
import { leerConfig } from "./config";

export type DatosNegocio = {
  nombre: string;
  ciudad: string;
  direccion: string;
  whatsapp: string;
  iniciales: string;
};

const NOMBRE_POR_DEFECTO = "Beauty Studio";

/** Dos letras para el logo: iniciales de las dos primeras palabras del nombre. */
export function inicialesDe(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter(Boolean);
  const letras = palabras.length >= 2 ? palabras[0][0] + palabras[1][0] : (palabras[0] ?? "B").slice(0, 2);
  return letras.toUpperCase();
}

export async function datosNegocio(): Promise<DatosNegocio> {
  try {
    const c = await leerConfig();
    const nombre = c.nombre_negocio.trim() || NOMBRE_POR_DEFECTO;
    return { nombre, ciudad: c.ciudad_negocio.trim(), direccion: c.direccion_negocio.trim(), whatsapp: c.whatsapp_negocio.trim(), iniciales: inicialesDe(nombre) };
  } catch {
    // Sin base de datos (por ejemplo durante la compilación): se muestran los valores neutros.
    return { nombre: NOMBRE_POR_DEFECTO, ciudad: "", direccion: "", whatsapp: "", iniciales: inicialesDe(NOMBRE_POR_DEFECTO) };
  }
}
