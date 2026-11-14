import { todosLosServicios } from "@/modulos/catalogo";
import { Formulario } from "@/componentes/Formulario";
import { EncabezadoPanel, Etiqueta } from "@/componentes/ui";
import { accionGuardarServicio } from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Servicios" };

function CamposServicio({ s }: { s?: { id: number; nombre: string; descripcion: string; precio_base: number | null; imagen_url: string | null; activo: boolean } }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="etiqueta-campo">Nombre</span>
          <input name="nombre" required maxLength={80} defaultValue={s?.nombre} className="campo" />
        </label>
        <label>
          <span className="etiqueta-campo">Precio de referencia (C$, opcional)</span>
          <input name="precio_base" inputMode="decimal" defaultValue={s?.precio_base ?? ""} className="campo" />
        </label>
        <label className="sm:col-span-2">
          <span className="etiqueta-campo">Descripción</span>
          <input name="descripcion" maxLength={200} defaultValue={s?.descripcion} className="campo" />
        </label>
        <label>
          <span className="etiqueta-campo">Imagen (ruta)</span>
          <input name="imagen_url" maxLength={255} defaultValue={s?.imagen_url ?? ""} className="campo" placeholder="/img/svc_makeup.jpg" />
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" name="activo" defaultChecked={s?.activo ?? true} className="h-4 w-4 accent-[#7a5c24]" /> Visible al público (activo)
        </label>
      </div>
    </>
  );
}

// A15 Servicios (CU-25, RF-03)
export default async function ServiciosPanel() {
  const servicios = await todosLosServicios();
  return (
    <>
      <EncabezadoPanel titulo="Servicios" />
      <div className="grid gap-5 p-5 lg:p-8 xl:grid-cols-2">
        {servicios.map((s) => (
          <details key={s.id} className="tarjeta p-4">
            <summary className="flex cursor-pointer items-center justify-between gap-2">
              <span className="font-semibold">{s.nombre}</span>
              <Etiqueta texto={s.activo ? "Activo" : "Inactivo"} tono={s.activo ? "ok" : "n"} />
            </summary>
            <Formulario accion={accionGuardarServicio} boton="Guardar cambios" claseBoton="btn-borde" className="mt-4 space-y-3">
              <CamposServicio s={s} />
            </Formulario>
          </details>
        ))}
        <section className="tarjeta p-4 xl:col-span-2">
          <h2 className="font-bold">Nuevo servicio</h2>
          <Formulario accion={accionGuardarServicio} boton="Registrar servicio" className="mt-3 space-y-3" reiniciar>
            <CamposServicio />
          </Formulario>
        </section>
      </div>
    </>
  );
}
