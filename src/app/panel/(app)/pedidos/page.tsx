import Link from "next/link";
import { listarPedidos } from "@/modulos/pedidos";
import { fechaHora, moneda } from "@/lib/tiempo";
import { EncabezadoPanel, Etiqueta, Vacio } from "@/componentes/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos" };

// A17 Pedidos (CU-30, RF-24, RF-25): estado general, pago y entrega por separado (RN-25.1).
export default async function Pedidos({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const sp = await searchParams;
  const filas = await listarPedidos(sp.estado);
  return (
    <>
      <EncabezadoPanel titulo="Pedidos">
        <Link href="/panel/pedidos/nuevo" className="btn-primario">
          + Pedido por una clienta
        </Link>
      </EncabezadoPanel>
      <div className="space-y-4 p-5 lg:p-8">
        <div className="flex flex-wrap gap-2 text-sm">
          {["", "Pendiente de confirmación", "Reservado", "Cerrado", "Cancelado", "Expirado"].map((e) => (
            <Link key={e} href={e ? `/panel/pedidos?estado=${e}` : "/panel/pedidos"} className={`rounded-full border px-3 py-1 ${(sp.estado ?? "") === e ? "border-oro-700 bg-crema-300" : "border-linea-200 bg-white"}`}>
              {e || "Todos"}
            </Link>
          ))}
        </div>
        <div className="tarjeta overflow-x-auto">
          {filas.length === 0 ? (
            <div className="p-4">
              <Vacio>No hay pedidos.</Vacio>
            </div>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Clienta</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Pago</th>
                  <th>Entrega</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.id}</td>
                    <td>
                      {p.clienta}
                      <span className="block text-xs text-gris-600">{fechaHora(p.creado_en)}</span>
                    </td>
                    <td className="max-w-64 text-xs">{p.productos}</td>
                    <td>{moneda(p.total_final ?? p.subtotal_productos)}</td>
                    <td>
                      <Etiqueta texto={p.estado} tono={p.estado === "Reservado" ? "warn" : p.estado === "Cerrado" ? "ok" : p.estado.startsWith("Pendiente") ? "info" : "err"} />
                      {p.estado === "Reservado" && p.estado_pago === "Pendiente" && <span className="block text-xs text-gris-600">vence {fechaHora(p.reservado_hasta)}</span>}
                    </td>
                    <td>
                      <Etiqueta texto={p.estado_pago} tono={p.estado_pago === "Pagado" ? "ok" : "n"} />
                    </td>
                    <td>
                      <Etiqueta texto={p.estado_entrega} tono={p.estado_entrega === "Entregado" ? "ok" : "n"} />
                      <span className="block text-xs text-gris-600">{p.tipo_entrega === "delivery" ? "Delivery" : "Retiro"}</span>
                    </td>
                    <td>
                      <Link href={`/panel/pedidos/${p.id}`} className="font-semibold text-oro-700">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
