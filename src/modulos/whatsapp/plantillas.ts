// Plantillas de WhatsApp (borrador del 30 de octubre de 2026; pendientes de aprobación por la administradora y por Meta).
// El texto armado aquí se usa en el modo simulado, en la vista previa del panel y en el envío manual (RN-11.7).
import { fechaLarga, montoTexto } from "@/lib/tiempo";

export type TipoMensaje = "Cotización" | "Aviso de confirmación" | "Código de verificación" | "Confirmación de pedido" | "Prueba";

export type Plantilla = {
  tipo: TipoMensaje;
  nombre: string;
  parametros: string[];
  texto: string;
  codigo?: string; // solo en la plantilla de autenticación (botón «copiar código»)
  idioma?: string; // para plantillas con un idioma distinto al de las tres principales (p. ej. hello_world en en_US)
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
      `Hola ${p[0]}, te escribimos de Beauty Studio. Esta es tu cotización de ${p[1]} para el ${p[2]}: total C$ ${p[3]}. ` +
      `Para apartar tu fecha, transfiere el anticipo de C$ ${p[4]} dentro de las próximas 24 horas a ${p[5]} y envía el comprobante por este chat. ` +
      `El saldo se paga el día de la atención. Gracias por elegirnos.`,
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
      `Lugar: ${p[5]}. Si necesitas cambiar la fecha, escríbenos por este chat. ¡Te esperamos!`,
  };
}

/**
 * Aviso al confirmar un pedido de productos (RF-24). Hay dos textos porque Meta no permite que una plantilla cambie de redacción:
 * retiro en el local (con fecha límite para pagar y retirar) y delivery (con costo de envío y sin plazo, porque la administradora lo entrega).
 */
export function plantillaPedidoRetiro(d: { nombre: string; pedidoId: number; total: number; limite: Date; lugar: string }): Plantilla {
  const p = [d.nombre.split(" ")[0], String(d.pedidoId), montoTexto(d.total), fechaLarga(d.limite), d.lugar].map(limpio);
  return {
    tipo: "Confirmación de pedido",
    nombre: process.env.WHATSAPP_PLANTILLA_PEDIDO_RETIRO || "pedido_confirmado_retiro_v1",
    parametros: p,
    texto:
      `Hola ${p[0]}, tu pedido #${p[1]} de Beauty Studio está confirmado. Total a pagar: C$ ${p[2]}. Tus productos quedan apartados hasta el ${p[3].replace(/\.$/, "")}. ` +
      `Para conservarlos, realiza el pago y retíralos en ${p[4]} antes de esa fecha. Cualquier duda, escríbenos por este chat.`,
  };
}

export function plantillaPedidoDelivery(d: { nombre: string; pedidoId: number; productos: number; envio: number; total: number; direccion: string }): Plantilla {
  const p = [d.nombre.split(" ")[0], String(d.pedidoId), montoTexto(d.productos), montoTexto(d.envio), montoTexto(d.total), d.direccion].map(limpio);
  return {
    tipo: "Confirmación de pedido",
    nombre: process.env.WHATSAPP_PLANTILLA_PEDIDO_DELIVERY || "pedido_confirmado_delivery_v1",
    parametros: p,
    texto:
      `Hola ${p[0]}, tu pedido #${p[1]} de Beauty Studio está confirmado. Productos: C$ ${p[2]}; delivery: C$ ${p[3]}; total: C$ ${p[4]}. ` +
      `Te lo llevaré a ${p[5]} y coordinamos el pago por este chat. Gracias por tu compra.`,
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

/**
 * Mensaje de prueba del panel: comprueba que el envío llega al número configurado. No se guarda en la lista de mensajes.
 * En modo «cloud» se usa «hello_world» (en_US), la única plantilla que Meta deja aprobada en toda cuenta nueva, para poder
 * probar la conexión antes de que se aprueben las tres plantillas del proyecto.
 */
export function plantillaPrueba(): Plantilla {
  return {
    tipo: "Prueba",
    nombre: process.env.WHATSAPP_PLANTILLA_PRUEBA || "hello_world",
    parametros: [],
    idioma: process.env.WHATSAPP_PLANTILLA_PRUEBA_IDIOMA || "en_US",
    texto: "¡Hola! Este es un mensaje de prueba de Beauty Studio. Si lo estás leyendo, el envío de WhatsApp funciona correctamente.",
  };
}
