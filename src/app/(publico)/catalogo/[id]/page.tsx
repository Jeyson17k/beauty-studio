import { notFound } from "next/navigation";
import { producto } from "@/modulos/inventario";
import { moneda } from "@/lib/tiempo";
import { Volver } from "@/componentes/ui";
import { FotoProducto } from "@/componentes/FotoProducto";
import { accionAgregarCarrito } from "../../acciones";

export const dynamic = "force-dynamic";

// P15 Detalle de producto (CU-07)
export default async function DetalleProducto({ params }: { params: Promise<{ id: string }> }) {
  const p = await producto(Number((await params).id));
  if (!p || !p.activo || !p.visible_publico) notFound();
  const agotado = p.disponible <= 0;
  return (
    <div>
      <FotoProducto url={p.foto_url} nombre={p.nombre} className="h-72 w-full" />
      <div className="px-5 py-5">
        <Volver href="/catalogo">Catálogo</Volver>
        <p className="mt-3 text-sm text-gris-600">{p.categoria}</p>
        <h1 className="text-2xl font-bold">{p.nombre}</h1>
        <p className="mt-2 text-xl font-bold text-oro-700">{moneda(p.precio_venta)}</p>
        {p.descripcion && <p className="mt-3 text-[15px]">{p.descripcion}</p>}
        {agotado ? (
          <p className="mt-5 rounded-xl bg-error-100 px-4 py-3 text-sm text-error-700">Agotado por ahora. Consulta a Andrea por WhatsApp.</p>
        ) : (
          <form action={accionAgregarCarrito} className="mt-6 flex items-end gap-3">
            <input type="hidden" name="producto_id" value={p.id} />
            <label className="w-24">
              <span className="etiqueta-campo">Cantidad</span>
              <input type="number" name="cantidad" min={1} max={99} defaultValue={1} className="campo" />
            </label>
            <button className="btn-primario flex-1">Agregar al carrito</button>
          </form>
        )}
        <p className="mt-3 text-xs text-gris-600">Agregar al carrito no aparta el producto. Andrea confirma la disponibilidad al recibir tu pedido.</p>
      </div>
    </div>
  );
}
