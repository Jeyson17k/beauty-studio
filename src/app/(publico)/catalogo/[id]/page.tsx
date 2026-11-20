import Link from "next/link";
import { notFound } from "next/navigation";
import { producto } from "@/modulos/inventario";
import { moneda } from "@/lib/tiempo";
import { FotoProducto } from "@/componentes/FotoProducto";
import { accionAgregarCarrito } from "../../acciones";

export const dynamic = "force-dynamic";

// P15 Detalle de producto (CU-07)
export default async function DetalleProducto({ params }: { params: Promise<{ id: string }> }) {
  const p = await producto(Number((await params).id));
  if (!p || !p.activo || !p.visible_publico) notFound();
  const agotado = p.disponible <= 0;
  return (
    <div className="contenedor grid gap-8 py-8 md:grid-cols-2 md:py-14">
      <div className="overflow-hidden rounded-3xl border border-linea-200 bg-white">
        <FotoProducto url={p.foto_url} nombre={p.nombre} className="h-72 w-full md:h-[440px]" />
      </div>
      <div>
        <Link href="/catalogo" className="text-sm font-semibold text-oro-700 hover:underline">
          ← Catálogo
        </Link>
        <p className="mt-3 text-xs uppercase tracking-wider text-gris-600">{p.categoria}</p>
        <h1 className="titulo-grande text-3xl md:text-4xl">{p.nombre}</h1>
        <span aria-hidden className="oro-degradado mt-3 block h-1 w-16 rounded-full" />
        <p className="mt-4 font-titulo text-3xl font-semibold text-oro-700">{moneda(p.precio_venta)}</p>
        {p.descripcion && <p className="mt-3 text-[15px]">{p.descripcion}</p>}
        {agotado ? (
          <p className="mt-5 rounded-xl bg-error-100 px-4 py-3 text-sm text-error-700">Agotado por ahora. Consulta a Andrea por WhatsApp.</p>
        ) : (
          <form action={accionAgregarCarrito} className="mt-6 space-y-3">
            <input type="hidden" name="producto_id" value={p.id} />
            <label className="block w-24">
              <span className="etiqueta-campo">Cantidad</span>
              <input type="number" name="cantidad" min={1} max={99} step={1} required defaultValue={1} className="campo" />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button name="ir" value="seguir" className="btn-primario flex-1">
                Agregar y seguir comprando
              </button>
              <button name="ir" value="ver" className="btn-borde flex-1">
                Agregar y ver carrito
              </button>
            </div>
          </form>
        )}
        <p className="mt-3 text-xs text-gris-600">Agregar al carrito no aparta el producto. Andrea confirma la disponibilidad al recibir tu pedido.</p>
      </div>
    </div>
  );
}
