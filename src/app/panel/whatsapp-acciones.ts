"use server";
// Mensaje de prueba de WhatsApp desde el panel (ver /panel/whatsapp-prueba).
import { revalidatePath } from "next/cache";
import { aResultado } from "@/lib/errores";
import { sesionAdmin } from "@/lib/sesion";
import { mostrarWhatsApp } from "@/lib/telefono";
import { enviarPlantilla, modoWhatsApp, numeroPrueba } from "@/modulos/whatsapp/cliente";
import { plantillaPrueba } from "@/modulos/whatsapp/plantillas";
import type { EstadoForm } from "@/componentes/Formulario";

export async function accionMensajePrueba(): Promise<EstadoForm> {
  try {
    if (!(await sesionAdmin())) return { ok: false, mensaje: "Tu sesión terminó. Vuelve a iniciar sesión." };
    const destino = numeroPrueba();
    if (!destino) return { ok: false, mensaje: "No hay número de prueba. Define WHATSAPP_NUMERO_PRUEBA en el archivo .env.local." };
    await enviarPlantilla(destino, plantillaPrueba());
    revalidatePath("/panel/whatsapp-prueba");
    return { ok: true, mensaje: modoWhatsApp() === "simulado" ? `Mensaje enviado al teléfono simulado de ${mostrarWhatsApp(destino)}.` : `Mensaje enviado a ${mostrarWhatsApp(destino)} por la API de WhatsApp.` };
  } catch (e) {
    return aResultado(e);
  }
}
