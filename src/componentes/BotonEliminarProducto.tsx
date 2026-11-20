"use client";
// Botón del inventario: elimina un producto (con confirmación). Si ya tiene ventas o pedidos, se conserva su historial.
import { Formulario } from "./Formulario";
import { accionEliminarProducto } from "@/app/panel/acciones";

export function BotonEliminarProducto({ id, nombre, existencias }: { id: number; nombre: string; existencias: number }) {
  return (
    <Formulario
      accion={accionEliminarProducto}
      boton="Eliminar"
      claseBoton="btn-borde px-3 py-1 text-xs text-error-700"
      confirmar={`¿Eliminar «${nombre}»?${existencias > 0 ? ` Todavía tiene ${existencias} unidad(es) en inventario.` : ""} Dejará de verse en el inventario y en el catálogo, y no se puede deshacer.`}
    >
      <input type="hidden" name="producto_id" value={id} />
    </Formulario>
  );
}
