import Link from "next/link";
import { ocupacionPublica } from "@/modulos/agenda";
import { diaLocal, desdeLocal, fecha, hora } from "@/lib/tiempo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Disponibilidad" };

// P06 Disponibilidad: muestra solo los intervalos ocupados, sin datos personales (RN-05.6).
// Las solicitudes pendientes de revisión no bloquean horarios (RN-05.7).
export default async function Disponibilidad({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const sp = await searchParams;
  const hoy = diaLocal(new Date());
  const inicioDia = desdeLocal(`${/^\d{4}-\d{2}-\d{2}$/.test(sp.desde ?? "") && sp.desde! >= hoy ? sp.desde : hoy}T00:00`);
  const dias = Array.from({ length: 7 }, (_, i) => new Date(inicioDia.getTime() + i * 86_400_000));
  const ocupados = await ocupacionPublica(dias[0], new Date(dias[6].getTime() + 86_400_000));
  const siguiente = diaLocal(new Date(inicioDia.getTime() + 7 * 86_400_000));
  const anterior = diaLocal(new Date(inicioDia.getTime() - 7 * 86_400_000));
  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-bold">Disponibilidad</h1>
      <p className="mt-1 text-sm text-gris-600">Estos horarios ya están apartados o confirmados. Cualquier otra hora puede solicitarse; Andrea la confirma en la cotización.</p>
      <div className="mt-4 flex justify-between text-sm font-semibold text-oro-700">
        {diaLocal(inicioDia) > hoy ? <Link href={`/disponibilidad?desde=${anterior}`}>← Semana anterior</Link> : <span />}
        <Link href={`/disponibilidad?desde=${siguiente}`}>Semana siguiente →</Link>
      </div>
      <div className="mt-3 space-y-2">
        {dias.map((d) => {
          const del = ocupados.filter((o) => diaLocal(o.inicio) === diaLocal(d) || (new Date(o.inicio) < d && new Date(o.fin) > d));
          return (
            <div key={d.toISOString()} className="tarjeta p-3">
              <p className="font-semibold ">{fecha(d)}</p>
              {del.length === 0 ? (
                <p className="text-sm text-ok-700">Sin horarios ocupados</p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {del.map((o, i) => (
                    <li key={i} className="rounded-full bg-error-100 px-2.5 py-0.5 text-xs font-semibold text-error-700">
                      Ocupado {hora(o.inicio)} – {hora(o.fin)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <Link href="/solicitar/servicio" className="btn-primario mt-6 w-full">
        Solicitar una fecha
      </Link>
    </div>
  );
}
