import Link from "next/link";
import { agendaAdmin, pendientesAgenda } from "@/modulos/agenda";
import { desdeLocal, diaLocal, fecha, hora } from "@/lib/tiempo";
import { EncabezadoPanel, Etiqueta } from "@/componentes/ui";

export const dynamic = "force-dynamic";

/** Tiempo que le queda a la clienta para pagar el anticipo (24 h desde que WhatsApp informa el envío, RN-11.5). */
function restante(plazo: Date | null): string {
  if (!plazo) return "enviando la cotización…";
  const ms = new Date(plazo).getTime() - Date.now();
  if (ms <= 0) return "plazo vencido, por revisar";
  const min = Math.floor(ms / 60_000);
  return `quedan ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min para el anticipo`;
}
export const metadata = { title: "Agenda" };

// A14 Agenda (CU-13): calendario unificado de servicios y cursos. Provisional = cotización enviada sin anticipo validado.
export default async function Agenda({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const sp = await searchParams;
  const base = /^\d{4}-\d{2}-\d{2}$/.test(sp.desde ?? "") ? sp.desde! : diaLocal(new Date());
  const inicio = desdeLocal(`${base}T00:00`);
  const dias = Array.from({ length: 7 }, (_, i) => new Date(inicio.getTime() + i * 86_400_000));
  const fin = new Date(dias[6].getTime() + 86_400_000);
  const [filas, pendientes] = await Promise.all([agendaAdmin(dias[0], fin), pendientesAgenda(dias[0], fin)]);
  const mover = (n: number) => diaLocal(new Date(inicio.getTime() + n * 86_400_000));
  return (
    <>
      <EncabezadoPanel titulo="Agenda">
        <Link href={`/panel/agenda?desde=${mover(-7)}`} className="btn-borde px-3 py-1.5 text-xs">
          ← Semana anterior
        </Link>
        <Link href="/panel/agenda" className="btn-borde px-3 py-1.5 text-xs">
          Hoy
        </Link>
        <Link href={`/panel/agenda?desde=${mover(7)}`} className="btn-borde px-3 py-1.5 text-xs">
          Semana siguiente →
        </Link>
      </EncabezadoPanel>
      <div className="p-5 lg:p-8">
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-gris-600">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-ok-700" /> Confirmada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-aviso-700" /> En proceso: cotización enviada, 24 h para pagar el anticipo (ya bloquea el horario)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-info-700" /> Sesión grupal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-dashed border-gris-600" /> Solicitud sin cotizar (no bloquea el horario)
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {dias.map((d) => {
            const del = filas.filter((f) => diaLocal(f.inicio) === diaLocal(d));
            const pend = pendientes.filter((f) => diaLocal(f.inicio) === diaLocal(d));
            return (
              <section key={d.toISOString()} className="tarjeta p-3">
                <h2 className={`text-sm font-bold ${diaLocal(d) === diaLocal(new Date()) ? "text-oro-700" : ""}`}>{fecha(d)}</h2>
                <ul className="mt-2 space-y-2">
                  {del.length === 0 && pend.length === 0 && <li className="text-xs text-gris-600">Libre</li>}
                  {del.map((f) => {
                    const color = f.sesion_id ? "border-info-700" : f.estado === "Confirmada" ? "border-ok-700" : "border-aviso-700";
                    const contenido = (
                      <>
                        <p className="text-xs font-semibold">
                          {hora(f.inicio)} – {hora(f.fin)}
                        </p>
                        <p className="text-sm">{f.actividad}</p>
                        <p className="text-xs text-gris-600">
                          {f.sesion_id ? `${f.inscritas ?? 0}/${f.capacidad} inscritas` : `${f.clienta} · ${f.fuera_local ? "domicilio" : "local"}`}
                          {!f.sesion_id && ` · ${f.directo ? "registrada por Andrea" : "desde la web"}`}
                        </p>
                        {!f.sesion_id && f.estado === "Provisional" && (
                          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-aviso-100 px-2 py-0.5 text-[11px] font-semibold text-aviso-700">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-aviso-700" /> En proceso · {restante(f.plazo)}
                          </p>
                        )}
                        {f.estado_solicitud && f.estado_solicitud !== "Confirmada" && (
                          <div className="mt-1">
                            <Etiqueta texto={f.estado_solicitud} />
                          </div>
                        )}
                      </>
                    );
                    return (
                      <li key={f.id} className={`rounded-lg border-l-4 bg-crema-50 px-2.5 py-2 ${color}`}>
                        {f.solicitud_id ? <Link href={`/panel/solicitudes/${f.solicitud_id}`}>{contenido}</Link> : <Link href="/panel/cursos">{contenido}</Link>}
                      </li>
                    );
                  })}
                  {pend.map((f) => (
                    <li key={`p${f.id}`} className="rounded-lg border border-dashed border-gris-600/60 bg-white px-2.5 py-2">
                      <Link href={`/panel/solicitudes/${f.id}`}>
                        <p className="text-xs font-semibold">{hora(f.inicio)} · pedida</p>
                        <p className="text-sm">{f.actividad}</p>
                        <p className="text-xs text-gris-600">
                          {f.clienta} · {f.directo ? "registrada por Andrea" : "desde la web"} · sin cotizar
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
