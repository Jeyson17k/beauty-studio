import Link from "next/link";
import { cursosActivos, sesionesAbiertas } from "@/modulos/catalogo";
import { fechaHora, moneda } from "@/lib/tiempo";
import { Etiqueta } from "@/componentes/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cursos" };

// P04 Cursos
export default async function Cursos() {
  const [cursos, sesiones] = await Promise.all([cursosActivos(), sesionesAbiertas()]);
  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-bold">Cursos de maquillaje</h1>
      <p className="mt-1 text-sm text-gris-600">Cada clase es una sesión de 3 horas. En las clases grupales cada participante se inscribe y paga por separado.</p>
      <div className="mt-5 space-y-3">
        {cursos.map((c) => {
          const proximas = sesiones.filter((s) => s.curso_id === c.id);
          return (
            <Link key={c.id} href={`/cursos/${c.id}`} className="tarjeta block p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{c.nombre}</p>
                <Etiqueta texto={c.modalidad === "grupal" ? "Grupal" : "Individual"} tono={c.modalidad === "grupal" ? "info" : "n"} />
              </div>
              <p className="mt-1 text-sm text-gris-600">{c.descripcion}</p>
              {c.precio_base ? <p className="mt-1 text-xs font-semibold text-oro-700">Desde {moneda(c.precio_base)}</p> : null}
              {c.modalidad === "grupal" && (
                <p className="mt-2 text-xs text-texto-900">
                  {proximas.length ? `Próxima sesión: ${fechaHora(proximas[0].inicio)} · ${proximas[0].libres} cupo(s)` : "Sin sesiones abiertas por ahora."}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
