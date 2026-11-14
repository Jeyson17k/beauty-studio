import Link from "next/link";
import { notFound } from "next/navigation";
import { curso, sesionesAbiertas } from "@/modulos/catalogo";
import { fecha, hora, moneda } from "@/lib/tiempo";
import { Etiqueta, Vacio, Volver } from "@/componentes/ui";

export const dynamic = "force-dynamic";

// P05 Detalle de curso y sesiones (cupos disponibles, RN-08.9)
export default async function DetalleCurso({ params }: { params: Promise<{ id: string }> }) {
  const c = await curso(Number((await params).id));
  if (!c || !c.activo) notFound();
  const sesiones = c.modalidad === "grupal" ? await sesionesAbiertas(c.id) : [];
  return (
    <div className="px-5 py-6">
      <Volver href="/cursos">Cursos</Volver>
      <h1 className="mt-2 text-2xl font-bold">{c.nombre}</h1>
      <div className="mt-2 flex gap-2">
        <Etiqueta texto={c.modalidad === "grupal" ? "Clase grupal" : "Clase individual"} tono="info" />
        <Etiqueta texto="3 horas" tono="n" />
      </div>
      <p className="mt-3 text-[15px]">{c.descripcion}</p>
      {c.precio_base ? <p className="mt-2 text-sm font-semibold text-oro-700">Desde {moneda(c.precio_base)}</p> : <p className="mt-2 text-sm font-semibold text-oro-700">Precio según cotización</p>}

      {c.modalidad === "individual" ? (
        <Link href={`/solicitar/curso?curso=${c.id}`} className="btn-primario mt-6 w-full">
          Solicitar clase individual
        </Link>
      ) : (
        <section className="mt-6">
          <h2 className="titulo-seccion">Sesiones programadas</h2>
          <div className="mt-3 space-y-2">
            {sesiones.length === 0 && <Vacio>Andrea todavía no ha abierto sesiones de este curso.</Vacio>}
            {sesiones.map((s) => (
              <div key={s.id} className="tarjeta flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-semibold ">{fecha(s.inicio)}</p>
                  <p className="text-sm text-gris-600">
                    {hora(s.inicio)} a {hora(s.fin)} · {s.libres > 0 ? `${s.libres} cupo(s) libre(s)` : "Sin cupos"}
                  </p>
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
  );
}
