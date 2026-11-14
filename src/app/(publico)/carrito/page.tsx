import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionClienta } from "@/lib/sesion";
import { verCarrito } from "@/modulos/pedidos";
import { moneda } from "@/lib/tiempo";
import { Formulario } from "@/componentes/Formulario";
import { CamposLugar } from "@/componentes/CamposPublicos";
import { Vacio } from "@/componentes/ui";
import { FotoProducto } from "@/componentes/FotoProducto";
import { accionCambiarCantidad, accionCrearPedido } from "../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Carrito" };

// P16 Carrito y P17 Resumen del pedido (CU-08, CU-09; RF-21, RF-22)
export default async function Carrito() {
  const s = await sesionClienta();
  if (!s) redirect("/identificarse?siguiente=/carrito");
  const { items, total } = await verCarrito(s.cid);
  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-bold">Mi carrito</h1>
      {items.length === 0 ? (
        <div className="mt-5 space-y-3">
          <Vacio>Tu carrito está vacío.</Vacio>
          <Link href="/catalogo" className="btn-primario w-full">
            Ver productos
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
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
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between text-lg font-bold">
            <span>Total de productos</span>
            <span>{moneda(total)}</span>
          </p>
          <div className="tarjeta mt-5 p-4">
            <h2 className="font-bold">Entrega</h2>
            <p className="ayuda">El pago y el costo del delivery se acuerdan con Andrea por WhatsApp; aquí no se paga nada.</p>
            <Formulario accion={accionCrearPedido} boton="Preparar pedido para WhatsApp" botonAncho className="mt-3 space-y-3">
              <CamposLugar etiquetas={["Retiro en el local", "Delivery"]} />
            </Formulario>
          </div>
        </>
      )}
    </div>
  );
}
