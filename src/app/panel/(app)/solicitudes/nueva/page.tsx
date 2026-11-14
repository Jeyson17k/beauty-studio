import { Formulario } from "@/componentes/Formulario";
import { CamposRegistroDirecto } from "@/componentes/RegistroDirecto";
import { EncabezadoPanel, Volver } from "@/componentes/ui";
import { cursosActivos, serviciosActivos, sesionesAbiertas } from "@/modulos/catalogo";
import { fechaHora, minimoLocal } from "@/lib/tiempo";
import { accionRegistroDirecto } from "../../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registro directo" };

// A11 Registro directo (CU-24, RF-17): sigue las mismas reglas de anticipo, plazo y confirmación (RN-17.5).
export default async function RegistroDirecto() {
  const [servicios, cursos, sesiones] = await Promise.all([serviciosActivos(), cursosActivos(), sesionesAbiertas()]);
  return (
    <>
      <EncabezadoPanel titulo="Registro directo" />
      <div className="max-w-2xl space-y-4 p-5 lg:p-8">
        <Volver href="/panel/solicitudes">Centro de solicitudes</Volver>
        <div className="tarjeta p-5">
          <p className="mb-4 text-sm text-gris-600">
            Para clientas que te escribieron por WhatsApp o en persona. Después de registrar, cotiza y envía la cotización como en cualquier solicitud.
          </p>
          <Formulario accion={accionRegistroDirecto} boton="Registrar solicitud">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="etiqueta-campo">Nombre completo de la clienta</span>
                <input name="nombre" required className="campo" />
              </label>
              <label>
                <span className="etiqueta-campo">WhatsApp</span>
                <input name="whatsapp" required inputMode="tel" className="campo" placeholder="8888 8888" />
              </label>
            </div>
            <label className="flex items-start gap-3 rounded-xl bg-crema-100 p-3 text-sm">
              <input type="checkbox" name="acepta" className="mt-1 h-4 w-4 accent-[#7a5c24]" />
              <span>La clienta aceptó recibir por WhatsApp la cotización y el aviso de confirmación (RN-17.8).</span>
            </label>
            <CamposRegistroDirecto
              servicios={servicios}
              cursos={cursos}
              sesiones={sesiones.filter((s) => s.libres > 0).map((s) => ({ id: s.id, curso_id: s.curso_id, texto: `${fechaHora(s.inicio)} · ${s.libres} cupo(s)` }))}
              minimo={minimoLocal()}
            />
          </Formulario>
        </div>
      </div>
    </>
  );
}
