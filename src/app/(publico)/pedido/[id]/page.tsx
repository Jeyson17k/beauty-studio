import { notFound } from "next/navigation";
import { sesionClienta } from "@/lib/sesion";
import { detallePedido, mensajePedido, pedido } from "@/modulos/pedidos";
import { moneda } from "@/lib/tiempo";
import { enlaceWhatsApp } from "@/lib/telefono";
import { Etiqueta } from "@/componentes/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido listo" };

// P18 Pedido listo para WhatsApp (CU-09, RF-23): la clienta hace el envío final desde su WhatsApp (RN-23.3).
export default async function PedidoListo({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await sesionClienta();
  const p = await pedido(id);
  if (!p || !s || p.cliente_id !== s.cid) notFound();
  const [items, msg] = await Promise.all([detallePedido(id), mensajePedido(id)]);
  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-bold">Pedido #{p.id} registrado</h1>
      <div className="mt-2">
        <Etiqueta texto={p.estado} tono="info" />
      </div>
      <ul className="tarjeta mt-4 divide-y divide-linea-200 text-sm">
        {items.map((i) => (
          <li key={i.producto_id} className="flex justify-between p-3">
            <span>
              {i.nombre} ×{i.cantidad}
            </span>
            <strong>{moneda(i.subtotal)}</strong>
          </li>
        ))}
        <li className="flex justify-between p-3 font-bold">
          <span>Total de productos</span>
          <span>{moneda(p.subtotal_productos)}</span>
        </li>
      </ul>
      <p className="mt-3 text-sm">
        Entrega: {p.tipo_entrega === "delivery" ? `delivery a ${p.direccion} (costo por confirmar)` : "retiro en el local"}.
      </p>
      <p className="mt-4 text-[15px]">Envía el pedido a Andrea por WhatsApp. Ella confirmará la disponibilidad, el costo del delivery y la forma de pago.</p>
      {msg && (
        <>
          <p className="mt-3 whitespace-pre-line rounded-xl bg-[#e7f6e7] p-3 text-sm">{msg.texto}</p>
          <a href={enlaceWhatsApp(msg.numero, msg.texto)} target="_blank" className="btn-primario mt-4 w-full">
            Enviar por WhatsApp
          </a>
        </>
      )}
      <p className="mt-3 text-xs text-gris-600">Preparar o enviar el mensaje no aparta los productos.</p>
    </div>
  );
}
