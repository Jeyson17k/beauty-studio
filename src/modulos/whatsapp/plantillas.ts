// Plantillas de WhatsApp (borrador del 30 de octubre de 2026; pendientes de aprobación por Andrea y por Meta).
// El texto armado aquí se usa en el modo simulado, en la vista previa del panel y en el envío manual (RN-11.7).
import { fechaLarga, montoTexto } from "@/lib/tiempo";

export type TipoMensaje = "Cotización" | "Aviso de confirmación" | "Código de verificación" | "Prueba";

export type Plantilla = {
  tipo: TipoMensaje;
  nombre: string;
  parametros: string[];
  texto: string;
  codigo?: string; // solo en la plantilla de autenticación (botón «copiar código»)
};

// Las variables no pueden llevar saltos de línea, tabulaciones ni cuatro espacios seguidos (regla de Meta).
const limpio = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();

export function plantillaCotizacion(d: { nombre: string; actividad: string; inicio: Date; total: number; anticipo: number; datosPago: string }): Plantilla {
  const p = [d.nombre.split(" ")[0], d.actividad.toLowerCase(), fechaLarga(d.inicio), montoTexto(d.total), montoTexto(d.anticipo), d.datosPago].map(limpio);
  return {
    tipo: "Cotización",
    nombre: process.env.WHATSAPP_PLANTILLA_COTIZACION || "cotizacion_servicio_v1",
    parametros: p,
    texto:
      `Hola ${p[0]}, soy Andrea de Beauty Studio. Esta es tu cotización de ${p[1]} para el ${p[2]}: total C$ ${p[3]}. ` +
      `Para apartar tu fecha, transfiere el anticipo de C$ ${p[4]} dentro de las próximas 24 horas a ${p[5]} y envía el comprobante por este chat. ` +
      `El saldo se paga el día de la atención. Gracias por elegirme.`,
  };
}

export function plantillaConfirmacion(d: { nombre: string; actividad: string; inicio: Date; anticipo: number; saldo: number; lugar: string }): Plantilla {
  const p = [d.nombre.split(" ")[0], d.actividad.toLowerCase(), fechaLarga(d.inicio), montoTexto(d.anticipo), montoTexto(d.saldo), d.lugar].map(limpio);
  return {
    tipo: "Aviso de confirmación",
    nombre: process.env.WHATSAPP_PLANTILLA_CONFIRMACION || "confirmacion_cita_v1",
    parametros: p,
    texto:
      `Hola ${p[0]}, tu ${p[1]} quedó confirmado para el ${p[2]}. Recibimos tu anticipo de C$ ${p[3]}; el saldo de C$ ${p[4]} se paga el día de la atención. ` +
      `Lugar: ${p[5]}. Si necesitas cambiar la fecha, escríbeme por este chat. ¡Te espero!`,
  };
}

/** Plantilla de autenticación: Meta genera el texto; aquí solo se reproduce para el modo simulado. */
export function plantillaCodigo(codigo: string, vigenciaMin: number): Plantilla {
  return {
    tipo: "Código de verificación",
    nombre: process.env.WHATSAPP_PLANTILLA_CODIGO || "codigo_verificacion_v1",
    parametros: [codigo],
    codigo,
    texto: `${codigo} es tu código de verificación. Por tu seguridad, no lo compartas. Este código caduca en ${vigenciaMin} minutos.`,
  };
}

/** Mensaje de prueba del panel: comprueba que el envío llega al número configurado. No se guarda en la lista de mensajes. */
export function plantillaPrueba(): Plantilla {
  return {
    tipo: "Prueba",
    nombre: "mensaje_de_prueba",
    parametros: [],
    texto: "¡Hola! Este es un mensaje de prueba de Beauty Studio. Si lo estás leyendo, el envío de WhatsApp funciona correctamente.",
  };
}
