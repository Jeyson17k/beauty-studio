import Link from "next/link";
import { AutoRefrescar } from "@/componentes/AutoRefrescar";
import { Formulario } from "@/componentes/Formulario";
import { Aviso, EncabezadoPanel } from "@/componentes/ui";
import { ZONA } from "@/lib/tiempo";
import { mostrarWhatsApp } from "@/lib/telefono";
import { bandejaSimulada, modoWhatsApp, numeroPrueba } from "@/modulos/whatsapp/cliente";
import { accionMensajePrueba } from "../../whatsapp-acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teléfono de prueba" };

const hora = (d: Date) => new Intl.DateTimeFormat("es-NI", { timeZone: ZONA, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
const dia = (d: Date) => new Intl.DateTimeFormat("es-NI", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" }).format(d);

// Simulación del WhatsApp que recibe el número de prueba: todo lo que el sistema envía aparece aquí como en un teléfono.
export default function TelefonoPrueba() {
  const destino = numeroPrueba();
  const simulado = modoWhatsApp() === "simulado";
  const mensajes = bandejaSimulada()
    .filter((m) => !destino || m.destino === destino)
    .slice(0, 40)
    .reverse();
  let diaActual = "";
  return (
    <>
      <AutoRefrescar segundos={3} />
      <EncabezadoPanel titulo="Teléfono de prueba (WhatsApp)">
        <Link href="/panel/mensajes" className="btn-borde px-3 py-1.5 text-xs">
          Ver lista de mensajes
        </Link>
      </EncabezadoPanel>
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,380px)_1fr] lg:p-8">
        {/* Teléfono */}
        <div className="mx-auto w-full max-w-[380px]">
          <div className="rounded-[2.6rem] bg-negro-950 p-3 shadow-2xl ring-1 ring-black/30">
            <div className="relative overflow-hidden rounded-[2rem] bg-[#efeae2]">
              <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-negro-950" />
              <div className="flex items-center gap-3 bg-[#075e54] px-4 pb-3 pt-9 text-white">
                <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-oro-300 bg-negro-900 text-xs font-bold text-oro-300">AP</span>
                <div className="leading-tight">
                  <p className="text-[15px] font-semibold">Beauty Studio · Andrea Paola</p>
                  <p className="text-xs text-white/75">cuenta de empresa</p>
                </div>
              </div>
              <div className="h-[520px] space-y-2 overflow-y-auto px-3 py-4" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,.05) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
                {mensajes.length === 0 && (
                  <p className="mx-auto mt-24 max-w-[220px] rounded-xl bg-white/80 px-3 py-2 text-center text-xs text-gris-600">
                    Aún no ha llegado ningún mensaje. Presiona «Enviar mensaje de prueba» o envía una cotización desde una solicitud.
                  </p>
                )}
                {mensajes.map((m) => {
                  const d = dia(m.en);
                  const nuevoDia = d !== diaActual;
                  diaActual = d;
                  return (
                    <div key={m.idExterno}>
                      {nuevoDia && <p className="mx-auto mb-2 w-fit rounded-lg bg-[#fff3c5] px-2.5 py-0.5 text-[11px] text-gris-600 first-letter:uppercase">{d}</p>}
                      <div className="max-w-[88%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[14px] leading-snug shadow-sm">
                        <p className="whitespace-pre-wrap">{m.texto}</p>
                        <p className="mt-1 text-right text-[11px] text-gris-600">{hora(m.en)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 bg-[#f0f0f0] px-3 py-2.5 text-xs text-gris-600">
                <span className="flex-1 rounded-full bg-white px-4 py-2">Solo recibe mensajes: la clienta no puede responder aquí (RN-33.2)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Datos y prueba */}
        <div className="space-y-4">
          <section className="tarjeta p-5">
            <h2 className="font-bold">Número de prueba</h2>
            <p className="mt-1 font-titulo text-3xl font-semibold tracking-wide">{destino ? mostrarWhatsApp(destino) : "Sin definir"}</p>
            <p className="mt-2 text-sm text-gris-600">
              {destino ? (
                <>
                  Mientras este número esté definido, <strong>todos</strong> los mensajes del sistema (cotizaciones, avisos de confirmación y códigos de verificación) se envían aquí, sin importar el
                  número de la clienta. Así se prueba sin escribirle a nadie.
                </>
              ) : (
                "Define WHATSAPP_NUMERO_PRUEBA en .env.local (por ejemplo 57266176) para enviar todo a un solo número de prueba."
              )}
            </p>
            <div className="mt-4">
              <Formulario accion={accionMensajePrueba} boton="Enviar mensaje de prueba" claseBoton="btn-primario" />
            </div>
          </section>
          {simulado ? (
            <Aviso tono="warn">
              Modo simulado: el mensaje <strong>no sale a Meta</strong>; se muestra en este teléfono. El estado «enviado» se simula a los 2 segundos. Para que llegue al WhatsApp real del
              número, usa <code>WHATSAPP_MODE=cloud</code> con el token y el identificador del número de prueba de Meta (ver la guía de conexión de WhatsApp).
            </Aviso>
          ) : (
            <Aviso tono="info">Modo Cloud API: los mensajes salen por Meta hacia el WhatsApp real de {destino ? mostrarWhatsApp(destino) : "la clienta"}. Este teléfono solo se usa en modo simulado.</Aviso>
          )}
          <section className="tarjeta p-5 text-sm">
            <h2 className="font-bold">Cómo probarlo de punta a punta</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-gris-600">
              <li>Registra una solicitud (por la página o con «Registrar por una clienta»).</li>
              <li>Abre la solicitud, registra la cotización y presiona «Enviar cotización».</li>
              <li>La cotización llega a este teléfono y la cita pasa a <strong>En proceso</strong> en el calendario (24 horas para el anticipo).</li>
              <li>Registra el comprobante y valida el pago: llega el aviso de confirmación y la cita queda confirmada.</li>
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
