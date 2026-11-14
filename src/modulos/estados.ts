// Estados de los diagramas de estados del tercer corte (E1 a E7). Los textos coinciden con las restricciones CHECK de la base.
export const SOL = {
  PENDIENTE_REVISION: "Pendiente de revisión",
  COTIZACION_ENVIO: "Cotización en envío",
  PENDIENTE_PAGO: "Pendiente de pago",
  PLAZO_VENCIDO: "Plazo vencido pendiente de revisión",
  CONFIRMADA: "Confirmada",
  REALIZADA: "Realizada",
  NO_ASISTIDA: "No asistida",
  CERRADA: "Cerrada",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
  EXPIRADA: "Expirada",
} as const;
export type EstadoSolicitud = (typeof SOL)[keyof typeof SOL];

/** Estados en los que la solicitud ocupa un intervalo o un cupo (RN-05.7, RN-08.9). */
export const SOL_CON_RESERVA: string[] = [SOL.COTIZACION_ENVIO, SOL.PENDIENTE_PAGO, SOL.PLAZO_VENCIDO, SOL.CONFIRMADA, SOL.REALIZADA, SOL.NO_ASISTIDA, SOL.CERRADA];
export const SOL_ABIERTAS: string[] = [SOL.PENDIENTE_REVISION, SOL.COTIZACION_ENVIO, SOL.PENDIENTE_PAGO, SOL.PLAZO_VENCIDO, SOL.CONFIRMADA];
export const SOL_FINALES: string[] = [SOL.CERRADA, SOL.RECHAZADA, SOL.CANCELADA, SOL.EXPIRADA, SOL.NO_ASISTIDA];

export const AGENDA = { PROVISIONAL: "Provisional", CONFIRMADA: "Confirmada", LIBERADA: "Liberada" } as const;
export const MSG = { EN_COLA: "En cola", ENVIADO: "Enviado", ENTREGADO: "Entregado", LEIDO: "Leído", FALLIDO: "Fallido" } as const;
export const COD = { SOLICITADO: "Solicitado", ENVIADO: "Enviado", VALIDADO: "Validado", VENCIDO: "Vencido", BLOQUEADO: "Bloqueado", FALLIDO: "Fallido" } as const;
export const SESION = { PROGRAMADA: "Programada", ABIERTA: "Abierta", LLENA: "Llena", REALIZADA: "Realizada", CANCELADA: "Cancelada" } as const;

/** Orden de avance del mensaje: un aviso no hace retroceder el estado (RN-33.3). */
export const ORDEN_MSG: Record<string, number> = { "En cola": 0, Enviado: 1, Entregado: 2, "Leído": 3 };

/** Color de la etiqueta de estado en la interfaz. */
export function tonoEstado(estado: string): "info" | "warn" | "err" | "ok" | "n" {
  switch (estado) {
    case SOL.PENDIENTE_REVISION: case MSG.EN_COLA: case SESION.PROGRAMADA: return "info";
    case SOL.COTIZACION_ENVIO: case SOL.PENDIENTE_PAGO: case SOL.PLAZO_VENCIDO: case AGENDA.PROVISIONAL: case SESION.LLENA: return "warn";
    case SOL.RECHAZADA: case SOL.CANCELADA: case SOL.EXPIRADA: case SOL.NO_ASISTIDA: case MSG.FALLIDO: case COD.BLOQUEADO: return "err";
    case SOL.CONFIRMADA: case SOL.REALIZADA: case SOL.CERRADA: case MSG.ENVIADO: case MSG.ENTREGADO: case MSG.LEIDO: case SESION.ABIERTA: case AGENDA.CONFIRMADA: return "ok";
    default: return "n";
  }
}
