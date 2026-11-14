import Link from "next/link";
import { agendaAdmin } from "@/modulos/agenda";
import { desdeLocal, diaLocal, fecha, hora } from "@/lib/tiempo";
import { EncabezadoPanel, Etiqueta } from "@/componentes/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda" };

// A14 Agenda (CU-13): calendario unificado de servicios y cursos. Provisional = cotización enviada sin anticipo validado.
export default async function Agenda({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const sp = await searchParams;
  const base = /^\d{4}-\d{2}-\d{2}$/.test(sp.desde ?? "") ? sp.desde! : diaLocal(new Date());
  const inicio = desdeLocal(`${base}T00:00`);
  const dias = Array.from({ length: 7 }, (_, i) => new Date(inicio.getTime() + i * 86_400_000));
  const filas = await agendaAdmin(dias[0], new Date(dias[6].getTime() + 86_400_000));
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
            <span className="h-3 w-3 rounded bg-aviso-700" /> Provisional (esperando anticipo)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-info-700" /> Sesión grupal
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {dias.map((d) => {
            const del = filas.filter((f) => diaLocal(f.inicio) === diaLocal(d));
            return (
              <section key={d.toISOString()} className="tarjeta p-3">
                <h2 className={`text-sm font-bold ${diaLocal(d) === diaLocal(new Date()) ? "text-oro-700" : ""}`}>{fecha(d)}</h2>
                <ul className="mt-2 space-y-2">
                  {del.length === 0 && <li className="text-xs text-gris-600">Libre</li>}
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
                        </p>
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
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
