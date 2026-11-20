import Link from "next/link";
import { notFound } from "next/navigation";
import { sesionClienta } from "@/lib/sesion";
import { detallePedido, pedido } from "@/modulos/pedidos";
import { moneda } from "@/lib/tiempo";
import { mostrarWhatsApp } from "@/lib/telefono";
import { Etiqueta } from "@/componentes/ui";
import { EncabezadoPagina } from "@/componentes/publico";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido enviado" };

// P18 Pedido enviado (CU-09): el pedido queda registrado en el panel de Andrea; ella coordina disponibilidad, entrega y pago por WhatsApp.
export default async function PedidoListo({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await sesionClienta();
  const p = await pedido(id);
  if (!p || !s || p.cliente_id !== s.cid) notFound();
  const items = await detallePedido(id);
  return (
    <div>
      <EncabezadoPagina titulo={`Pedido #${p.id} enviado`}>
        <div className="mt-3">
          <Etiqueta texto={p.estado} tono="info" />
        </div>
      </EncabezadoPagina>
      <div className="contenedor max-w-3xl py-8 md:py-12">
      <ul className="tarjeta divide-y divide-linea-200 text-sm">
        {items.map((i) => (
          <li key={i.producto_id} className="flex justify-between p-3">
            <span>
              {i.nombre} ×{i.cantidad}
            </span>
            <strong>{moneda(i.subtotal)}</strong>
          </li>
        ))}
        <li className="flex justify-between p-3">
          <span>Total de productos</span>
          <span>{items.reduce((n, i) => n + i.cantidad, 0)}</span>
        </li>
        <li className="flex justify-between p-3 font-bold">
          <span>Total de la compra</span>
          <span>{moneda(p.subtotal_productos)}</span>
        </li>
      </ul>
      <p className="mt-3 text-sm">
        Entrega: {p.tipo_entrega === "delivery" ? `delivery a ${p.direccion} (costo por confirmar)` : "retiro en el local"}.
      </p>
      <div className="mt-4 rounded-2xl bg-ok-100 px-4 py-3 text-[15px] text-ok-700">
        <p className="font-semibold">Tu pedido ya llegó al panel de Andrea.</p>
        <p className="mt-1 text-sm">
          Ella revisará la disponibilidad y te escribirá por WhatsApp al {mostrarWhatsApp(s.whatsapp)} para confirmar {p.tipo_entrega === "delivery" ? "el costo del delivery y la forma de pago" : "la forma de pago y cuándo puedes retirarlo"}.
        </p>
      </div>
      <p className="mt-3 text-xs text-gris-600">Enviar el pedido no aparta los productos ni cobra nada. Guarda el número de pedido: #{p.id}.</p>
      <Link href="/catalogo" className="btn-borde mt-4 w-full">
        Seguir viendo productos
      </Link>
      </div>
    </div>
  );
}
