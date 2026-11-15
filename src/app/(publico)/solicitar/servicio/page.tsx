import Link from "next/link";
import { Formulario } from "@/componentes/Formulario";
import { CamposIdentificacion, CamposLugar } from "@/componentes/CamposPublicos";
import { serviciosActivos } from "@/modulos/catalogo";
import { datosCalendario } from "@/modulos/agenda";
import { SelectorCalendario } from "@/componentes/SelectorCalendario";
import { sesionClienta } from "@/lib/sesion";
import { minimoLocal } from "@/lib/tiempo";
import { accionSolicitarServicio } from "../../acciones";
import { EncabezadoPagina, PildorasNumeradas } from "@/componentes/publico";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitar servicio" };

// P08 Solicitar servicio (CU-03). La clienta no fija precio, anticipo ni duración (RN-07.9).
export default async function SolicitarServicio({ searchParams }: { searchParams: Promise<{ servicio?: string }> }) {
  const [{ servicio }, servicios, clienta, casillas] = await Promise.all([searchParams, serviciosActivos(), sesionClienta(), datosCalendario(false)]);
  return (
    <div>
      <EncabezadoPagina titulo="Solicitar servicio" subtitulo="Tu solicitud queda pendiente de revisión. Andrea te enviará la cotización por WhatsApp.">
        {/* RF-06: selección del tipo de solicitud */}
        <div className="mt-5 grid max-w-sm grid-cols-2 gap-1 rounded-full bg-white/10 p-1 text-center text-sm font-semibold">
          <span className="oro-degradado rounded-full py-2 text-negro-950">Servicios de belleza</span>
          <Link href="/solicitar/curso" className="rounded-full py-2 text-white/80 hover:text-oro-200">
            Cursos
          </Link>
        </div>
      </EncabezadoPagina>
      <div className="contenedor grid gap-6 py-8 md:py-12 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      <div className="tarjeta p-5 md:p-7">
        <Formulario accion={accionSolicitarServicio} boton="Enviar solicitud" botonAncho>
          {!clienta && <CamposIdentificacion />}
          <label className="block">
            <span className="etiqueta-campo">Servicio</span>
            <select name="servicio_id" required defaultValue={servicio ?? ""} className="campo">
              <option value="" disabled>
                Elige un servicio
              </option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="etiqueta-campo">Fecha y hora</span>
            <SelectorCalendario casillas={casillas} minimo={minimoLocal()} />
            <span className="ayuda">
              Los horarios ocupados aparecen bloqueados. Mira la semana completa en <Link href="/disponibilidad" className="font-semibold text-oro-700">Disponibilidad</Link>.
            </span>
          </div>
          <CamposLugar />
          <label className="block">
            <span className="etiqueta-campo">Descripción (opcional)</span>
            <textarea name="descripcion" maxLength={300} rows={3} className="campo" placeholder="Cuéntale a Andrea el estilo que buscas o el tipo de evento." />
          </label>
          <label className="block">
            <span className="etiqueta-campo">Fotos de referencia (opcional, hasta 5)</span>
            <input type="file" name="fotos" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="campo file:mr-3 file:rounded-full file:border-0 file:bg-crema-300 file:px-3 file:py-1 file:text-sm" />
          </label>
        </Formulario>
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

