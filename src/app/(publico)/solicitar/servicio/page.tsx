import Link from "next/link";
import { Formulario } from "@/componentes/Formulario";
import { CamposIdentificacion, CamposLugar } from "@/componentes/CamposPublicos";
import { serviciosActivos } from "@/modulos/catalogo";
import { sesionClienta } from "@/lib/sesion";
import { minimoLocal } from "@/lib/tiempo";
import { accionSolicitarServicio } from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitar servicio" };

// P08 Solicitar servicio (CU-03). La clienta no fija precio, anticipo ni duración (RN-07.9).
export default async function SolicitarServicio({ searchParams }: { searchParams: Promise<{ servicio?: string }> }) {
  const [{ servicio }, servicios, clienta] = await Promise.all([searchParams, serviciosActivos(), sesionClienta()]);
  return (
    <div className="px-5 py-6">
      {/* RF-06: selección del tipo de solicitud */}
      <div className="grid grid-cols-2 gap-2 rounded-full bg-crema-300 p-1 text-center text-sm font-semibold">
        <span className="rounded-full bg-negro-900 py-2 text-white">Servicios de belleza</span>
        <Link href="/solicitar/curso" className="rounded-full py-2 text-texto-900">
          Cursos
        </Link>
      </div>
      <h1 className="mt-5 text-2xl font-bold">Solicitar servicio</h1>
      <p className="mt-1 text-sm text-gris-600">Tu solicitud queda pendiente de revisión. Andrea te enviará la cotización por WhatsApp.</p>
      <div className="tarjeta mt-5 p-4">
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
          <label className="block">
            <span className="etiqueta-campo">Fecha y hora</span>
            <input type="datetime-local" name="inicio" required min={minimoLocal()} className="campo" />
            <span className="ayuda">
              Puedes ver los horarios ocupados en <Link href="/disponibilidad" className="font-semibold text-oro-700">Disponibilidad</Link>.
            </span>
          </label>
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
    </div>
  );
}
