import Link from "next/link";
import { Formulario } from "@/componentes/Formulario";
import { CamposIdentificacion } from "@/componentes/CamposPublicos";
import { cursosActivos, sesionesAbiertas } from "@/modulos/catalogo";
import { sesionClienta } from "@/lib/sesion";
import { fecha, hora, minimoLocal } from "@/lib/tiempo";
import { Vacio } from "@/componentes/ui";
import { datosCalendario } from "@/modulos/agenda";
import { SelectorCalendario } from "@/componentes/SelectorCalendario";
import { accionSolicitarCurso } from "../../acciones";
import { EncabezadoPagina, PildorasNumeradas } from "@/componentes/publico";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitar curso" };

// P09 Solicitar curso o inscripción (CU-04). Al elegir Cursos se deshabilitan los servicios (RN-06.3).
export default async function SolicitarCurso({ searchParams }: { searchParams: Promise<{ curso?: string; sesion?: string }> }) {
  const [sp, cursos, clienta, casillas] = await Promise.all([searchParams, cursosActivos(), sesionClienta(), datosCalendario(false)]);
  const elegido = cursos.find((c) => String(c.id) === sp.curso) ?? null;
  const sesiones = elegido?.modalidad === "grupal" ? (await sesionesAbiertas(elegido.id)).filter((s) => s.libres > 0) : [];
  return (
    <div>
      <EncabezadoPagina titulo="Solicitar curso" subtitulo="Elige el curso. El formulario se adapta a la modalidad: individual o grupal.">
        <div className="mt-5 grid max-w-sm grid-cols-2 gap-1 rounded-full bg-white/10 p-1 text-center text-sm font-semibold">
          <Link href="/solicitar/servicio" className="rounded-full py-2 text-white/80 hover:text-oro-200">
            Servicios de belleza
          </Link>
          <span className="oro-degradado rounded-full py-2 text-negro-950">Cursos</span>
        </div>
      </EncabezadoPagina>
      <div className="contenedor grid gap-6 py-8 md:py-12 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      <div>
      {/* Paso 1: elegir el curso (el formulario se adapta a la modalidad, RN-06.5) */}
      <div className="grid gap-2 sm:grid-cols-2">
        {cursos.map((c) => (
          <Link
            key={c.id}
            href={`/solicitar/curso?curso=${c.id}`}
            className={`rounded-xl border p-4 text-sm transition ${elegido?.id === c.id ? "border-negro-900 bg-negro-900 text-white" : "border-linea-200 bg-white hover:border-oro-700"}`}
          >
            <span className="font-semibold">{c.nombre}</span>
            <span className={`block text-xs ${elegido?.id === c.id ? "text-oro-200" : "text-gris-600"}`}>{c.modalidad === "grupal" ? "Clase grupal: eliges una sesión programada" : "Clase individual: eliges fecha y hora"}</span>
          </Link>
        ))}
      </div>

      {elegido && (
        <div className="tarjeta mt-5 p-5 md:p-7">
          {elegido.modalidad === "grupal" && sesiones.length === 0 ? (
            <Vacio>No hay sesiones con cupos disponibles para este curso.</Vacio>
          ) : (
            <Formulario accion={accionSolicitarCurso} boton={elegido.modalidad === "grupal" ? "Enviar inscripción" : "Enviar solicitud"} botonAncho>
              <input type="hidden" name="curso_id" value={elegido.id} />
              {!clienta && <CamposIdentificacion />}
              {elegido.modalidad === "individual" ? (
                <div>
                  <span className="etiqueta-campo">Fecha y hora de la clase (3 horas)</span>
                  <SelectorCalendario casillas={casillas} minimo={minimoLocal()} duracionMin={180} />
                </div>
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
              <p className="ayuda">Al enviar, te mandamos un código por WhatsApp para confirmar que el número es tuyo.</p>
            </Formulario>
          )}
        </div>
      )}
      </div>
      <PasosLaterales />
      </div>
    </div>
  );
}

function PasosLaterales() {
  return (
    <aside className="hidden rounded-3xl bg-negro-950 p-6 text-white lg:block">
      <p className="font-titulo text-lg font-semibold uppercase tracking-[0.16em] text-oro-300">Así sigue tu solicitud</p>
      <div className="mt-5">
        <PildorasNumeradas
          items={[
            "Andrea revisa tu solicitud.",
            "Te envía la cotización por WhatsApp.",
            "Pagas el anticipo del 10 % en 24 horas.",
            "Andrea verifica el pago y confirma tu cita.",
          ]}
        />
      </div>
      <Link href="/disponibilidad" className="btn mt-6 w-full border border-white/20 text-white hover:border-oro-300">
        Ver horarios ocupados
      </Link>
    </aside>
  );
}

