// Cliente de envío de WhatsApp. Dos modos (variable WHATSAPP_MODE):
// - "cloud": Meta WhatsApp Cloud API (Graph API, POST /{phone-number-id}/messages). PENDIENTE DE PROBAR con un número de prueba de Meta.
// - "simulado": no sale a internet. Devuelve un identificador «wamid.SIM…» y el servicio simula el aviso de estado.
// La integración solo envía mensajes; no recibe respuestas de las clientas (RN-33.2).
import crypto from "crypto";
import type { Plantilla } from "./plantillas";

export class ErrorWhatsApp extends Error {
  constructor(public codigo: string, public detalle: string) {
    super(`${codigo}: ${detalle}`);
  }
}

export const modoWhatsApp = (): "cloud" | "simulado" => (process.env.WHATSAPP_MODE === "cloud" ? "cloud" : "simulado");

/** Bandeja del modo simulado (en memoria) para que el equipo vea el texto que habría llegado a la clienta. */
type Simulado = { idExterno: string; para: string; plantilla: string; texto: string; en: Date };
const g = globalThis as unknown as { __bsBandeja?: Simulado[] };
export const bandejaSimulada = (): Simulado[] => (g.__bsBandeja ??= []);

export async function enviarPlantilla(para: string, p: Plantilla): Promise<{ idExterno: string }> {
  if (modoWhatsApp() === "simulado") {
    const idExterno = `wamid.SIM.${crypto.randomUUID()}`;
    bandejaSimulada().unshift({ idExterno, para, plantilla: p.nombre, texto: p.texto, en: new Date() });
    bandejaSimulada().splice(50);
    return { idExterno };
  }

  const version = process.env.WHATSAPP_API_VERSION || "v26.0";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) throw new ErrorWhatsApp("CONFIG", "Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_TOKEN en el servidor");

  const components: unknown[] = [{ type: "body", parameters: p.parametros.map((text) => ({ type: "text", text })) }];
  if (p.codigo) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: p.codigo }] });

  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: para.replace("+", ""),
        type: "template",
        template: { name: p.nombre, language: { code: process.env.WHATSAPP_IDIOMA || "es" }, components },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new ErrorWhatsApp("RED", `No se pudo conectar con la API de WhatsApp: ${(e as Error).message}`.slice(0, 200));
  }
  const cuerpo = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { code?: number; message?: string; error_data?: { details?: string } };
  };
  if (!res.ok || !cuerpo.messages?.[0]?.id) {
    const err = cuerpo.error;
    throw new ErrorWhatsApp(String(err?.code ?? res.status), (err?.error_data?.details || err?.message || "Error desconocido").slice(0, 200));
  }
  return { idExterno: cuerpo.messages[0].id };
}

/** Verifica la firma X-Hub-Signature-256 del webhook (HMAC SHA-256 con el secreto de la aplicación). */
export function firmaValida(cuerpoCrudo: string, firma: string | null): boolean {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto) return modoWhatsApp() === "simulado"; // en modo cloud el secreto es obligatorio
  if (!firma?.startsWith("sha256=")) return false;
  const esperado = crypto.createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest("hex");
  const a = Buffer.from(firma.slice(7), "hex");
  const b = Buffer.from(esperado, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
