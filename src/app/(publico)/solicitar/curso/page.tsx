import Link from "next/link";
import { Formulario } from "@/componentes/Formulario";
import { CamposIdentificacion } from "@/componentes/CamposPublicos";
import { cursosActivos, sesionesAbiertas } from "@/modulos/catalogo";
import { sesionClienta } from "@/lib/sesion";
import { fecha, hora, minimoLocal } from "@/lib/tiempo";
import { Vacio } from "@/componentes/ui";
import { accionSolicitarCurso } from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitar curso" };

// P09 Solicitar curso o inscripción (CU-04). Al elegir Cursos se deshabilitan los servicios (RN-06.3).
export default async function SolicitarCurso({ searchParams }: { searchParams: Promise<{ curso?: string; sesion?: string }> }) {
  const [sp, cursos, clienta] = await Promise.all([searchParams, cursosActivos(), sesionClienta()]);
  const elegido = cursos.find((c) => String(c.id) === sp.curso) ?? null;
  const sesiones = elegido?.modalidad === "grupal" ? (await sesionesAbiertas(elegido.id)).filter((s) => s.libres > 0) : [];
  return (
    <div className="px-5 py-6">
      <div className="grid grid-cols-2 gap-2 rounded-full bg-crema-300 p-1 text-center text-sm font-semibold">
        <Link href="/solicitar/servicio" className="rounded-full py-2 text-texto-900">
          Servicios de belleza
        </Link>
        <span className="rounded-full bg-negro-900 py-2 text-white">Cursos</span>
      </div>
      <h1 className="mt-5 text-2xl font-bold">Solicitar curso</h1>

      {/* Paso 1: elegir el curso (el formulario se adapta a la modalidad, RN-06.5) */}
      <div className="mt-4 grid gap-2">
        {cursos.map((c) => (
          <Link
            key={c.id}
            href={`/solicitar/curso?curso=${c.id}`}
            className={`rounded-xl border p-3 text-sm ${elegido?.id === c.id ? "border-oro-700 bg-crema-300" : "border-linea-200 bg-white"}`}
          >
            <span className="font-semibold">{c.nombre}</span>
            <span className="block text-xs text-gris-600">{c.modalidad === "grupal" ? "Clase grupal: eliges una sesión programada" : "Clase individual: eliges fecha y hora"}</span>
          </Link>
        ))}
      </div>

      {elegido && (
        <div className="tarjeta mt-5 p-4">
          {elegido.modalidad === "grupal" && sesiones.length === 0 ? (
            <Vacio>No hay sesiones con cupos disponibles para este curso.</Vacio>
          ) : (
            <Formulario accion={accionSolicitarCurso} boton={elegido.modalidad === "grupal" ? "Enviar inscripción" : "Enviar solicitud"} botonAncho>
              <input type="hidden" name="curso_id" value={elegido.id} />
              {!clienta && <CamposIdentificacion />}
              {elegido.modalidad === "individual" ? (
                <label className="block">
                  <span className="etiqueta-campo">Fecha y hora de la clase (3 horas)</span>
                  <input type="datetime-local" name="inicio" required min={minimoLocal()} className="campo" />
                </label>
              ) : (
                <fieldset>
                  <legend className="etiqueta-campo">Sesión</legend>
                  <div className="mt-2 space-y-2">
                    {sesiones.map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-linea-200 bg-white p-3 text-sm has-[:checked]:border-oro-700 has-[:checked]:bg-crema-300">
                        <input type="radio" name="sesion_id" value={s.id} required defaultChecked={String(s.id) === sp.sesion} className="accent-[#7a5c24]" />
                        <span>
                          <span className="font-semibold ">{fecha(s.inicio)}</span> · {hora(s.inicio)} a {hora(s.fin)}
                          <span className="block text-xs text-gris-600">{s.libres} cupo(s) libre(s)</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <label className="block">
                <span className="etiqueta-campo">Comentario (opcional)</span>
                <textarea name="descripcion" maxLength={300} rows={2} className="campo" placeholder="Ej.: es mi primera clase" />
              </label>
              <p className="ayuda">Tu inscripción queda pendiente de revisión y no aparta cupo hasta que Andrea te envíe la cotización.</p>
            </Formulario>
          )}
        </div>
      )}
    </div>
  );
}
