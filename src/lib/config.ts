// Parámetros editables (tabla configuracion). Valores iniciales del Corte 1.
import { q, Db, pool } from "./db";

export const CONFIG_INICIAL = {
  plazo_pago_horas: { valor: "24", descripcion: "Plazo para pagar el anticipo desde que WhatsApp informa el envío (RN-11.5)" },
  espera_envio_min: { valor: "15", descripcion: "Espera máxima del aviso «enviado» antes de marcar el envío como fallido (RN-11.6)" },
  codigo_vigencia_min: { valor: "10", descripcion: "Vigencia del código de verificación (RN-18.8)" },
  codigo_intentos: { valor: "3", descripcion: "Intentos permitidos por código (RN-18.8)" },
  codigo_max_hora: { valor: "5", descripcion: "Solicitudes de código por número cada hora (RN-18.8)" },
  historial_inactividad_min: { valor: "15", descripcion: "Cierre por inactividad de la sesión de historial (RN-18.9)" },
  reserva_pedido_horas: { valor: "48", descripcion: "Vigencia de la reserva de productos de un pedido (RN-24.7)" },
  recordatorio_horas: { valor: "24", descripcion: "Anticipación de los recordatorios del panel (RF-19)" },
  datos_pago: { valor: "la cuenta que Andrea indique por este chat", descripcion: "Texto de la variable {{6}} de la plantilla de cotización" },
  whatsapp_negocio: { valor: "+50586190898", descripcion: "WhatsApp del negocio al que la clienta envía su pedido (RF-23)" },
  lugar_local: { valor: "mi salón en Los Cedros, León", descripcion: "Lugar de atención en el aviso de confirmación" },
} as const;

export type ClaveConfig = keyof typeof CONFIG_INICIAL;

export async function leerConfig(db: Db = pool): Promise<Record<ClaveConfig, string>> {
  const filas = await q<{ clave: string; valor: string }>("SELECT clave, valor FROM configuracion", [], db);
  const out = Object.fromEntries(Object.entries(CONFIG_INICIAL).map(([k, v]) => [k, v.valor])) as Record<ClaveConfig, string>;
  for (const f of filas) if (f.clave in out) out[f.clave as ClaveConfig] = f.valor;
  return out;
}

export async function configNum(clave: ClaveConfig, db: Db = pool): Promise<number> {
  const c = await leerConfig(db);
  return Number(c[clave]);
}
