import Link from "next/link";
import { cursosActivos, sesionesAbiertas } from "@/modulos/catalogo";
import { fechaHora, moneda } from "@/lib/tiempo";
import { Etiqueta } from "@/componentes/ui";
import { EncabezadoPagina } from "@/componentes/publico";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cursos" };

// P04 Cursos
export default async function Cursos() {
  const [cursos, sesiones] = await Promise.all([cursosActivos(), sesionesAbiertas()]);
  return (
    <div>
      <EncabezadoPagina
        titulo="Cursos de maquillaje"
        subtitulo="Cada clase es una sesión de 3 horas. En las clases grupales cada participante se inscribe y paga por separado."
      />
      <div className="contenedor grid gap-5 py-8 md:grid-cols-2 md:py-12">
        {cursos.map((c, i) => {
          const proximas = sesiones.filter((s) => s.curso_id === c.id);
          return (
            <Link key={c.id} href={`/cursos/${c.id}`} className="group tarjeta flex gap-4 p-5 transition hover:-translate-y-1 hover:shadow-lg">
              <span className="hexagono oro-degradado grid h-12 w-14 shrink-0 place-items-center font-titulo text-xl font-bold text-negro-950">{i + 1}</span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-titulo text-xl font-semibold uppercase tracking-wide">{c.nombre}</p>
                  <Etiqueta texto={c.modalidad === "grupal" ? "Grupal" : "Individual"} tono={c.modalidad === "grupal" ? "info" : "n"} />
                </div>
                <p className="mt-1 text-sm text-gris-600">{c.descripcion}</p>
                {c.precio_base ? <p className="mt-2 text-sm font-semibold text-oro-700">Desde {moneda(c.precio_base)}</p> : null}
                {c.modalidad === "grupal" && (
                  <p className="mt-2 rounded-lg bg-crema-100 px-3 py-2 text-xs text-texto-900">
                    {proximas.length ? `Próxima sesión: ${fechaHora(proximas[0].inicio)} · ${proximas[0].libres} cupo(s)` : "Sin sesiones abiertas por ahora."}
                  </p>
                )}
                <p className="mt-3 text-sm font-semibold text-oro-700 group-hover:underline">Ver detalle →</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
