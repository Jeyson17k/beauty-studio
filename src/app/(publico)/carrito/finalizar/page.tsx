import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionClienta } from "@/lib/sesion";
import { verCarrito } from "@/modulos/pedidos";
import { moneda } from "@/lib/tiempo";
import { mostrarWhatsApp } from "@/lib/telefono";
import { Formulario } from "@/componentes/Formulario";
import { CamposLugar } from "@/componentes/CamposPublicos";
import { EncabezadoPagina } from "@/componentes/publico";
import { accionCrearPedido, accionOlvidarme } from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finalizar pedido" };

// Finalizar pedido (CU-09, RF-22): confirma los datos de la clienta y la entrega, y envía el pedido al panel del negocio.
export default async function FinalizarPedido() {
  const s = await sesionClienta();
  if (!s) redirect("/identificarse?siguiente=/carrito/finalizar");
  const { items, total } = await verCarrito(s.cid);
  if (items.length === 0) redirect("/carrito");
  return (
    <div>
      <EncabezadoPagina titulo="Finalizar pedido" volver={{ href: "/carrito", texto: "Volver al carrito" }} />
      <div className="contenedor grid gap-6 py-8 md:py-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <section className="tarjeta p-5">
          <h2 className="font-bold">Tu pedido</h2>
          <ul className="mt-3 divide-y divide-linea-200 text-sm">
            {items.map((i) => (
              <li key={i.producto_id} className="flex justify-between gap-3 py-2">
                <span>
                  {i.nombre} ×{i.cantidad}
                </span>
                <strong>{moneda(i.subtotal)}</strong>
              </li>
            ))}
            <li className="flex justify-between py-2 text-base font-bold">
              <span>Total de la compra</span>
              <span>{moneda(total)}</span>
            </li>
          </ul>
        </section>
        <section className="tarjeta p-5">
          <h2 className="font-bold">Tus datos</h2>
          <dl className="mt-3 space-y-2 rounded-xl bg-crema-100 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gris-600">Nombre</dt>
              <dd className="font-semibold">{s.nombre}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gris-600">WhatsApp</dt>
              <dd className="font-semibold">{mostrarWhatsApp(s.whatsapp)}</dd>
            </div>
          </dl>
          <form action={accionOlvidarme} className="mt-1">
            <button className="text-xs font-semibold text-oro-700 hover:underline">No soy yo / cambiar mis datos</button>
          </form>
          <Formulario accion={accionCrearPedido} boton="Enviar pedido" botonAncho className="mt-4 space-y-3">
            <CamposLugar etiquetas={["Retiro en el local", "Delivery"]} />
          </Formulario>
          <p className="ayuda mt-3">
            El negocio recibe tu pedido en su panel y te escribe por WhatsApp para confirmar la disponibilidad, el costo del delivery y la forma de pago. Enviarlo no aparta los productos ni cobra nada.
          </p>
          <Link href="/catalogo" className="mt-3 inline-block text-sm font-semibold text-oro-700 hover:underline">
            ← Seguir viendo el catálogo
          </Link>
        </section>
      </div>
    </div>
  );
}
