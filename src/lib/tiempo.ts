// Fechas y moneda. Nicaragua usa UTC−6 todo el año (sin horario de verano).
export const ZONA = "America/Managua";
const OFFSET = "-06:00";

/** Convierte el valor de un <input type="datetime-local"> (hora de Nicaragua) a Date. */
export function desdeLocal(valor: string): Date {
  const v = valor.length === 16 ? `${valor}:00` : valor;
  const d = new Date(`${v}${OFFSET}`);
  if (Number.isNaN(d.getTime())) throw new Error("Fecha no válida");
  return d;
}

/** Date → "YYYY-MM-DDTHH:mm" en hora de Nicaragua (para inputs). */
export function aLocal(d: Date | string): string {
  const x = new Date(d);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(x);
  const g = (t: string) => p.find((z) => z.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

export function fecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const t = new Intl.DateTimeFormat("es-NI", { timeZone: ZONA, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function hora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-NI", { timeZone: ZONA, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d));
}

export function fechaHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return `${fecha(d)}, ${hora(d)}`;
}

/** Texto largo para mensajes: «sábado 8 de noviembre a las 9:00 a. m.» */
export function fechaLarga(d: Date | string): string {
  const x = new Date(d);
  const f = new Intl.DateTimeFormat("es-NI", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" }).format(x);
  return `${f} a las ${hora(x)}`;
}

/** Día (YYYY-MM-DD) en Nicaragua. */
export function diaLocal(d: Date | string): string {
  return aLocal(d).slice(0, 10);
}

export function moneda(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return `C$ ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Cantidad sin símbolo para las plantillas: 1,300 o 1,300.50 */
export function montoTexto(n: number): string {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export const minutos = (m: number) => m * 60_000;

/** Valor mínimo de un datetime-local: dentro de una hora (RN-05.1). */
export const minimoLocal = (minutosAdelante = 60) => aLocal(new Date(Date.now() + minutosAdelante * 60_000));
