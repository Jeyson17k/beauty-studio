import Link from "next/link";
import { ocupacionPublica } from "@/modulos/agenda";
import { ZONA, diaLocal, desdeLocal, hora } from "@/lib/tiempo";
import { EncabezadoPagina } from "@/componentes/publico";

export const dynamic = "force-dynamic";
export const metadata = { title: "Disponibilidad" };

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-NI", { timeZone: ZONA, ...o }).format(d);

// P06 Disponibilidad: muestra solo los intervalos ocupados, sin datos personales (RN-05.6).
// Las solicitudes pendientes de revisión no bloquean horarios (RN-05.7).
// Teléfono: lista de días. Computadora: semana en 7 columnas. La lógica de la semana no cambia.
export default async function Disponibilidad({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const sp = await searchParams;
  const hoy = diaLocal(new Date());
  const inicioDia = desdeLocal(`${/^\d{4}-\d{2}-\d{2}$/.test(sp.desde ?? "") && sp.desde! >= hoy ? sp.desde : hoy}T00:00`);
  const dias = Array.from({ length: 7 }, (_, i) => new Date(inicioDia.getTime() + i * 86_400_000));
  const ocupados = await ocupacionPublica(dias[0], new Date(dias[6].getTime() + 86_400_000));
  const siguiente = diaLocal(new Date(inicioDia.getTime() + 7 * 86_400_000));
  const anterior = diaLocal(new Date(inicioDia.getTime() - 7 * 86_400_000));
  const rango = `${fmt(dias[0], { day: "numeric", month: "long" })} – ${fmt(dias[6], { day: "numeric", month: "long", year: "numeric" })}`;
  return (
    <div>
      <EncabezadoPagina
        titulo="Disponibilidad"
        subtitulo="Estos horarios ya están apartados o confirmados. Cualquier otra hora puede solicitarse; Andrea la confirma en la cotización."
      />
      <div className="contenedor py-8 md:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-titulo text-lg font-semibold uppercase tracking-wide">{rango}</p>
          <div className="flex gap-2 text-sm font-semibold">
            {diaLocal(inicioDia) > hoy && (
              <Link href={`/disponibilidad?desde=${anterior}`} className="btn-borde px-4 py-2">
                ← Semana anterior
              </Link>
            )}
            <Link href={`/disponibilidad?desde=${siguiente}`} className="btn-primario px-4 py-2">
              Semana siguiente →
            </Link>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gris-600">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-error-100 ring-1 ring-error-700/40" /> Ocupado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-ok-100 ring-1 ring-ok-700/40" /> Sin horarios ocupados
          </span>
        </div>

        <div className="mt-5 grid gap-2 lg:grid-cols-7 lg:gap-3">
          {dias.map((d) => {
            const del = ocupados.filter((o) => diaLocal(o.inicio) === diaLocal(d) || (new Date(o.inicio) < d && new Date(o.fin) > d));
            const esHoy = diaLocal(d) === hoy;
            return (
              <div key={d.toISOString()} className={`tarjeta flex gap-3 p-3 lg:min-h-56 lg:flex-col lg:gap-2 ${esHoy ? "ring-2 ring-oro-300" : ""}`}>
                <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-negro-950 py-2 text-center leading-none text-white lg:w-full lg:flex-row lg:justify-between lg:px-3">
                  <span className="text-[11px] uppercase tracking-wider text-oro-300">{fmt(d, { weekday: "short" })}</span>
                  <span className="mt-1 font-titulo text-2xl font-bold lg:mt-0">{fmt(d, { day: "numeric" })}</span>
                  <span className="mt-1 text-[10px] uppercase text-white/60 lg:hidden">{fmt(d, { month: "short" })}</span>
                </div>
                <div className="flex-1">
                  {esHoy && <p className="text-[11px] font-semibold uppercase tracking-wide text-oro-700">Hoy</p>}
                  {del.length === 0 ? (
                    <p className="text-sm text-ok-700">Sin horarios ocupados</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5 lg:flex-col">
                      {del.map((o, i) => (
                        <li key={i} className="rounded-full bg-error-100 px-2.5 py-1 text-xs font-semibold text-error-700 lg:rounded-lg">
                          <span className="lg:block lg:text-[10px] lg:uppercase lg:tracking-wider">Ocupado</span> {hora(o.inicio)} – {hora(o.fin)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl bg-negro-950 p-6 text-center text-white md:flex-row md:justify-between md:text-left">
          <div>
            <p className="font-titulo text-xl font-semibold uppercase tracking-wide">¿Ya elegiste tu fecha?</p>
            <p className="text-sm text-white/70">Tu horario se aparta cuando recibes la cotización y se confirma con el anticipo del 10 %.</p>
          </div>
          <Link href="/solicitar/servicio" className="btn oro-degradado w-full px-7 py-3 text-sm uppercase tracking-wider text-negro-950 md:w-auto">
            Solicitar una fecha
          </Link>
        </div>
      </div>
    </div>
  );
}
