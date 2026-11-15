import Link from "next/link";
import { notFound } from "next/navigation";
import { curso, sesionesAbiertas } from "@/modulos/catalogo";
import { ZONA, fecha, hora, moneda } from "@/lib/tiempo";
import { Etiqueta, Vacio } from "@/componentes/ui";
import { EncabezadoPagina } from "@/componentes/publico";

export const dynamic = "force-dynamic";

// P05 Detalle de curso y sesiones (cupos disponibles, RN-08.9)
export default async function DetalleCurso({ params }: { params: Promise<{ id: string }> }) {
  const c = await curso(Number((await params).id));
  if (!c || !c.activo) notFound();
  const sesiones = c.modalidad === "grupal" ? await sesionesAbiertas(c.id) : [];
  return (
    <div>
      <EncabezadoPagina titulo={c.nombre} subtitulo={c.descripcion} volver={{ href: "/cursos", texto: "Cursos" }}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Etiqueta texto={c.modalidad === "grupal" ? "Clase grupal" : "Clase individual"} tono="info" />
          <Etiqueta texto="3 horas" tono="n" />
          <span className="font-titulo text-xl font-semibold text-oro-300">{c.precio_base ? `Desde ${moneda(c.precio_base)}` : "Precio según cotización"}</span>
        </div>
      </EncabezadoPagina>
      <div className="contenedor py-8 md:py-12">
        {c.modalidad === "individual" ? (
          <div className="tarjeta max-w-xl p-6">
            <p className="font-titulo text-xl font-semibold uppercase tracking-wide">Clase individual</p>
            <p className="mt-1 text-sm text-gris-600">Eliges la fecha y la hora; Andrea te confirma en la cotización.</p>
            <Link href={`/solicitar/curso?curso=${c.id}`} className="btn-primario mt-5 w-full sm:w-auto">
              Solicitar clase individual
            </Link>
          </div>
        ) : (
          <section>
            <h2 className="titulo-grande text-2xl">Sesiones programadas</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {sesiones.length === 0 && (
                <div className="md:col-span-2">
                  <Vacio>Andrea todavía no ha abierto sesiones de este curso.</Vacio>
                </div>
              )}
              {sesiones.map((s) => (
                <div key={s.id} className="tarjeta flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-negro-950 text-center leading-none text-oro-300">
                      <span className="font-titulo text-xl font-bold">{new Date(s.inicio).toLocaleDateString("es-NI", { day: "2-digit", timeZone: ZONA })}</span>
                      <span className="text-[10px] uppercase">{new Date(s.inicio).toLocaleDateString("es-NI", { month: "short", timeZone: ZONA })}</span>
                    </div>
                    <div>
                      <p className="font-semibold">{fecha(s.inicio)}</p>
                      <p className="text-sm text-gris-600">
                        {hora(s.inicio)} a {hora(s.fin)} · {s.libres > 0 ? `${s.libres} cupo(s) libre(s)` : "Sin cupos"}
                      </p>
                    </div>
                  </div>
                  {s.libres > 0 ? (
                    <Link href={`/solicitar/curso?curso=${c.id}&sesion=${s.id}`} className="btn-primario px-4 py-2 text-xs">
                      Inscribirme
                    </Link>
                  ) : (
                    <Etiqueta texto="Llena" />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
