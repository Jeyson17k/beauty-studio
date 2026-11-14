import { redirect } from "next/navigation";
import { sesionHistorial } from "@/lib/sesion";
import { historial, clientaPorId } from "@/modulos/clientas";
import { fechaHora, moneda } from "@/lib/tiempo";
import { mostrarWhatsApp } from "@/lib/telefono";
import { Etiqueta, Vacio } from "@/componentes/ui";
import { accionCerrarHistorial } from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi historial" };

// P13 Mi historial: solo lectura y solo los registros de ese número (RN-18.2 a RN-18.5, RN-18.9).
export default async function MiHistorial() {
  const s = await sesionHistorial();
  if (!s) redirect("/historial");
  const [cli, filas] = await Promise.all([clientaPorId(s.cid), historial(s.cid)]);
  return (
    <div className="px-5 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mi historial</h1>
          <p className="text-sm text-gris-600">
            {cli?.nombre} · {mostrarWhatsApp(s.whatsapp)}
          </p>
        </div>
        <form action={accionCerrarHistorial}>
          <button className="btn-borde px-3 py-1.5 text-xs">Salir</button>
        </form>
      </div>
      <div className="mt-5 space-y-3">
        {filas.length === 0 && <Vacio>Todavía no tienes solicitudes.</Vacio>}
        {filas.map((f) => (
          <article key={f.id} className="tarjeta p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{f.actividad}</p>
                <p className="text-sm text-gris-600">{fechaHora(f.inicio)}</p>
              </div>
              <Etiqueta texto={f.estado} />
            </div>
            {f.precio_total !== null && (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-gris-600">Total</dt>
                  <dd className="font-semibold">{moneda(f.precio_total)}</dd>
                </div>
                <div>
                  <dt className="text-gris-600">Anticipo</dt>
                  <dd className="font-semibold">{moneda(f.anticipo)}</dd>
                </div>
                <div>
                  <dt className="text-gris-600">Pagado</dt>
                  <dd className="font-semibold">{moneda(f.pagado)}</dd>
                </div>
              </dl>
            )}
            <p className="mt-2 text-xs text-gris-600">
              Solicitud #{f.id} · {f.tipo === "curso" ? "Curso" : f.fuera_local ? "A domicilio" : "En el salón"}
            </p>
          </article>
        ))}
      </div>
      <p className="mt-5 text-xs text-gris-600">Para cambios o dudas escribe a Andrea por WhatsApp. La sesión se cierra sola después de 15 minutos.</p>
    </div>
  );
}
