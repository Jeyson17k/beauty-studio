// Webhook de Meta WhatsApp Cloud API: verificación (GET) y avisos de estado de los mensajes (POST).
// Solo se procesan los «statuses» (enviado, entregado, leído, fallido). Los mensajes entrantes de las clientas
// se ignoran: la integración no recibe ni responde mensajes (RN-33.2).
import { NextRequest, NextResponse } from "next/server";
import { firmaValida } from "@/modulos/whatsapp/cliente";
import { procesarAviso } from "@/modulos/whatsapp/servicio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN && p.get("hub.challenge")) {
    return new NextResponse(p.get("hub.challenge"), { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Prohibido", { status: 403 });
}

type Estado = { id: string; status: string; timestamp: string; errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[] };

export async function POST(req: NextRequest) {
  const crudo = await req.text();
  if (!firmaValida(crudo, req.headers.get("x-hub-signature-256"))) return new NextResponse("Firma no válida", { status: 401 });
  let cuerpo: { entry?: { changes?: { value?: { statuses?: Estado[] } }[] }[] };
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return new NextResponse("JSON no válido", { status: 400 });
  }
  const resultados: string[] = [];
  for (const entrada of cuerpo.entry ?? [])
    for (const cambio of entrada.changes ?? [])
      for (const st of cambio.value?.statuses ?? []) {
        const err = st.errors?.[0];
        try {
          resultados.push(
            await procesarAviso({
              idExterno: st.id,
              estado: st.status,
              ocurrido: new Date(Number(st.timestamp) * 1000),
              idEvento: `${st.id}:${st.status}`, // un aviso repetido trae el mismo id y estado (RN-11.8)
              errorCodigo: err?.code ? String(err.code) : undefined,
              errorDetalle: err ? err.error_data?.details || err.message || err.title : undefined,
            }),
          );
        } catch (e) {
          console.error("[webhook]", e);
          resultados.push("error");
        }
      }
  // Se responde 200 siempre que la firma sea válida para que Meta no reintente avisos ya registrados.
  return NextResponse.json({ recibido: resultados.length, resultados });
}
