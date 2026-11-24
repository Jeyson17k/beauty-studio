import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionClienta } from "@/lib/sesion";
import { verCarrito } from "@/modulos/pedidos";
import { moneda } from "@/lib/tiempo";
import { Vacio } from "@/componentes/ui";
import { FotoProducto } from "@/componentes/FotoProducto";
import { EncabezadoPagina } from "@/componentes/publico";
import { accionCambiarCantidad } from "../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Carrito" };

// P16 Carrito y P17 Resumen del pedido (CU-08, CU-09; RF-21, RF-22)
export default async function Carrito() {
  const s = await sesionClienta();
  if (!s) redirect("/identificarse?siguiente=/carrito");
  const { items, total } = await verCarrito(s.cid);
  return (
    <div>
      <EncabezadoPagina titulo="Mi carrito" volver={{ href: "/catalogo", texto: "Seguir viendo productos" }} />
      <div className="contenedor py-8 md:py-12">
      {items.length === 0 ? (
        <div className="mx-auto max-w-md space-y-3">
          <Vacio>Tu carrito está vacío.</Vacio>
          <Link href="/catalogo" className="btn-primario w-full">
            Ver productos
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div>
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.producto_id} className="tarjeta flex items-center gap-3 p-3">
                <FotoProducto url={i.foto_url} nombre={i.nombre} className="h-14 w-14 rounded-lg" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{i.nombre}</p>
                  <p className="text-xs text-gris-600">
                    {moneda(i.precio_venta)} c/u · subtotal <strong>{moneda(i.subtotal)}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {[
                    ["−", i.cantidad - 1],
                    ["+", i.cantidad + 1],
                  ].map(([t, v]) => (
                    <form key={String(t)} action={accionCambiarCantidad}>
                      <input type="hidden" name="producto_id" value={i.producto_id} />
                      <input type="hidden" name="cantidad" value={v} />
                      <button className="grid h-8 w-8 place-items-center rounded-full border border-linea-200 bg-white font-bold" aria-label={t === "+" ? "Aumentar" : "Reducir"}>
                        {t}
                      </button>
                    </form>
                  ))}
                  <span className="w-6 text-center text-sm font-semibold">{i.cantidad}</span>
                  <form action={accionCambiarCantidad}>
                    <input type="hidden" name="producto_id" value={i.producto_id} />
                    <input type="hidden" name="cantidad" value={0} />
                    <button className="ml-1 text-xs font-semibold text-error-700 hover:underline">Quitar</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-2xl bg-negro-950 px-5 py-4 text-white">
            <p className="flex justify-between text-sm text-white/70">
              <span>Total de productos</span>
              <span>{items.reduce((n, i) => n + i.cantidad, 0)}</span>
            </p>
            <p className="mt-2 flex justify-between text-lg font-bold">
              <span>Total de la compra</span>
              <span className="text-oro-300">{moneda(total)}</span>
            </p>
          </div>
          </div>
          <div className="tarjeta space-y-3 p-5 lg:sticky lg:top-24">
            <h2 className="font-bold">¿Qué quieres hacer?</h2>
            <Link href="/catalogo" className="btn-borde w-full">
              Seguir viendo el catálogo
            </Link>
            <Link href="/carrito/finalizar" className="btn-primario w-full">
              Finalizar pedido
            </Link>
            <p className="ayuda">Aquí no se paga nada. El pago y el delivery se acuerdan con el negocio después de recibir tu pedido.</p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
