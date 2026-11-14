// Error de regla de negocio: su mensaje se muestra tal cual a la usuaria.
export class ReglaError extends Error {
  constructor(message: string, public regla?: string) {
    super(regla ? `${message} (${regla})` : message);
    this.name = "ReglaError";
  }
}

export type Resultado<T = undefined> = { ok: true; datos?: T; mensaje?: string } | { ok: false; error: string };

/** Convierte una excepción en un resultado para los formularios. Los errores técnicos no se muestran en detalle. */
export function aResultado(e: unknown): { ok: false; error: string } {
  if (e instanceof ReglaError) return { ok: false, error: e.message };
  const pg = e as { code?: string; constraint?: string };
  if (pg?.code === "23P01") return { ok: false, error: "El horario se cruza con otra actividad de la agenda (RN-05.8)." };
  if (pg?.code === "23505") return { ok: false, error: "La operación ya se había registrado; no se duplicó (RN-11.8)." };
  if (pg?.code === "23514") return { ok: false, error: "Los datos no cumplen una regla del sistema. Revísalos e inténtalo de nuevo." };
  console.error(e);
  return { ok: false, error: "Ocurrió un error inesperado. Inténtalo de nuevo." };
}
