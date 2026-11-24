// Envío de correos (códigos de la cuenta de la administradora).
// - MAIL_MODE=simulado (por defecto): no sale ningún correo; el mensaje queda en la consola del servidor y la
//   pantalla muestra el código para poder probar. Nunca usar este modo en producción.
// - MAIL_MODE=smtp: envía de verdad con SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y MAIL_FROM
//   (por ejemplo, una cuenta de Gmail con «contraseña de aplicación»).
// - MAIL_MODE=resend: envía de verdad por la API de Resend (https://resend.com) con RESEND_API_KEY y MAIL_FROM.
//   Sin dominio propio sirve MAIL_FROM=onboarding@resend.dev y solo entrega al correo con el que se creó la cuenta de Resend.
export type ModoCorreo = "simulado" | "smtp" | "resend";

export const modoCorreo = (): ModoCorreo => {
  const m = (process.env.MAIL_MODE || "simulado").toLowerCase();
  return m === "smtp" ? "smtp" : m === "resend" ? "resend" : "simulado";
};

export type Correo = { para: string; asunto: string; texto: string };

export async function enviarCorreo(c: Correo): Promise<{ ok: boolean; simulado: boolean }> {
  if (modoCorreo() === "simulado") {
    console.log(`\n[correo simulado] Para: ${c.para}\nAsunto: ${c.asunto}\n${c.texto}\n`);
    return { ok: true, simulado: true };
  }
  if (modoCorreo() === "resend") {
    const clave = process.env.RESEND_API_KEY;
    if (!clave) {
      console.error("[correo] Falta RESEND_API_KEY.");
      return { ok: false, simulado: false };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.MAIL_FROM || "Beauty Studio <onboarding@resend.dev>", to: [c.para], subject: c.asunto, text: c.texto }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) console.error("[correo] Resend respondió", res.status, await res.text().catch(() => ""));
      return { ok: res.ok, simulado: false };
    } catch (e) {
      console.error("[correo] No se pudo enviar:", e);
      return { ok: false, simulado: false };
    }
  }
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.error("[correo] Falta configurar SMTP_HOST, SMTP_USER o SMTP_PASS.");
    return { ok: false, simulado: false };
  }
  try {
    const nodemailer = await import("nodemailer");
    const puerto = Number(process.env.SMTP_PORT) || 465;
    const transporte = nodemailer.createTransport({ host, port: puerto, secure: puerto === 465, auth: { user, pass } });
    await transporte.sendMail({ from: process.env.MAIL_FROM || `Beauty Studio <${user}>`, to: c.para, subject: c.asunto, text: c.texto });
    return { ok: true, simulado: false };
  } catch (e) {
    console.error("[correo] No se pudo enviar:", e);
    return { ok: false, simulado: false };
  }
}
