// Validaciones comunes de los datos que escriben las clientas y la administradora (RNF-04).
// Todas lanzan ReglaError con un mensaje claro, que el formulario muestra sin perder lo escrito.
import { ReglaError } from "./errores";

const LETRA = /\p{L}/u;

/** Nombre de persona: solo letras, espacios, apóstrofo, guion y punto; al menos nombre y apellido. */
export function nombrePersona(valor: string, campo = "tu nombre"): string {
  const n = (valor || "").replace(/\s+/g, " ").trim();
  if (n.length < 3 || n.length > 100) throw new ReglaError(`Escribe ${campo} completo (3 a 100 caracteres).`);
  if (/\d/.test(n)) throw new ReglaError(`El nombre no puede llevar números. Escribe ${campo} con letras.`);
  if (!/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(n)) throw new ReglaError("El nombre solo puede llevar letras, espacios, guiones o apóstrofos.");
  const palabras = n.split(" ").filter((p) => (p.match(/\p{L}/gu) ?? []).length >= 2);
  if (palabras.length < 2) throw new ReglaError("Escribe tu nombre y apellido.");
  return n;
}

/** Texto libre que debe decir algo: con al menos una letra y dentro de los límites. */
export function textoConLetras(valor: string, campo: string, min: number, max: number): string {
  const t = (valor || "").replace(/\s+/g, " ").trim();
  if (t.length < min) throw new ReglaError(`Escribe ${campo} (mínimo ${min} caracteres).`);
  if (t.length > max) throw new ReglaError(`${mayus(campo)} admite hasta ${max} caracteres.`);
  if (!LETRA.test(t)) throw new ReglaError(`${mayus(campo)} debe llevar palabras, no solo números o símbolos.`);
  return t;
}

/** Texto opcional: vacío se acepta; si se escribe, se valida igual que textoConLetras. */
export function textoOpcional(valor: string, campo: string, max: number): string {
  const t = (valor || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length > max) throw new ReglaError(`${mayus(campo)} admite hasta ${max} caracteres.`);
  if (!LETRA.test(t)) throw new ReglaError(`${mayus(campo)} debe llevar palabras, no solo números o símbolos.`);
  return t;
}

/** Monto en córdobas: número mayor que cero (o igual, si se permite), con hasta dos decimales y un tope razonable. */
export function monto(valor: number, campo: string, opciones: { max?: number; permitirCero?: boolean } = {}): number {
  const max = opciones.max ?? 1_000_000;
  if (!Number.isFinite(valor)) throw new ReglaError(`Escribe ${campo} con números (por ejemplo 1300 o 1300.50).`);
  if (opciones.permitirCero ? valor < 0 : valor <= 0) throw new ReglaError(`${mayus(campo)} debe ser ${opciones.permitirCero ? "cero o mayor" : "mayor que cero"}.`);
  if (valor > max) throw new ReglaError(`${mayus(campo)} no puede pasar de C$ ${max.toLocaleString("es-NI")}.`);
  if (Math.round(valor * 100) !== Math.round(valor * 100 * 1000) / 1000) throw new ReglaError(`${mayus(campo)} admite hasta dos decimales.`);
  return Math.round(valor * 100) / 100;
}

/** Número entero dentro de un rango. */
export function entero(valor: number, campo: string, min: number, max: number): number {
  if (!Number.isInteger(valor)) throw new ReglaError(`${mayus(campo)} debe ser un número entero.`);
  if (valor < min || valor > max) throw new ReglaError(`${mayus(campo)} debe estar entre ${min} y ${max}.`);
  return valor;
}

/** Lee un número de un campo de texto: acepta «1,300.50» y «1300»; vacío o con letras da NaN. */
export function leerNumero(texto: string): number {
  const v = (texto || "").replace(/,/g, "").trim();
  if (v === "" || !/^-?\d+(\.\d+)?$/.test(v)) return NaN;
  return Number(v);
}

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
