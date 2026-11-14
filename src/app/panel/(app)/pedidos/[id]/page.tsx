import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { detallePedido, pedido } from "@/modulos/pedidos";
import { fechaHora, moneda } from "@/lib/tiempo";
import { mostrarWhatsApp } from "@/lib/telefono";
import { Formulario } from "@/componentes/Formulario";
import { Dato, EncabezadoPanel, Etiqueta, Volver } from "@/componentes/ui";
import { accionCancelarPedido, accionConfirmarPedido, accionEntregaPedido, accionPagoPedido } from "../../../acciones";

export const dynamic = "force-dynamic";

// A18 Detalle de pedido (CU-30, CU-31; RF-24, RF-25)
export default async function DetallePedido({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const p = await pedido(id);
  if (!p) notFound();
  const [items, reservas, pagos] = await Promise.all([
    detallePedido(id),
    q<{ producto: string; cantidad: number; estado: string; expira_en: Date | null }>(
      "SELECT pr.nombre AS producto, r.cantidad, r.estado, r.expira_en FROM reserva_inventario r JOIN producto pr ON pr.id = r.producto_id WHERE r.pedido_id = $1",
      [id],
    ),
    q<{ monto: number; registrado_en: Date }>("SELECT monto, registrado_en FROM pago WHERE pedido_id = $1", [id]),
  ]);
  const pasos = p.tipo_entrega === "delivery" ? ["En preparación", "En delivery"] : ["En preparación", "Listo para retirar"];
  return (
    <>
      <EncabezadoPanel titulo={`Pedido #${p.id}`}>
        <Etiqueta texto={p.estado} tono={p.estado === "Reservado" ? "warn" : p.estado === "Cerrado" ? "ok" : "info"} />
      </EncabezadoPanel>
      <div className="grid gap-5 p-5 lg:p-8 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Volver href="/panel/pedidos">Pedidos</Volver>
          <section className="tarjeta p-5">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Dato etiqueta="Clienta">
                {p.clienta}
                <a href={`https://wa.me/${p.whatsapp.replace("+", "")}`} target="_blank" className="block text-sm font-semibold text-oro-700">
                  {mostrarWhatsApp(p.whatsapp)} ↗
                </a>
              </Dato>
              <Dato etiqueta="Entrega">{p.tipo_entrega === "delivery" ? `Delivery: ${p.direccion}${p.referencia ? ` (${p.referencia})` : ""}` : "Retiro en el local"}</Dato>
              <Dato etiqueta="Pago / entrega">
                {p.estado_pago} · {p.estado_entrega}
              </Dato>
            </dl>
            <table className="tabla mt-4">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                  <th>Disponible hoy</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.producto_id}>
                    <td>{i.nombre}</td>
                    <td>{i.cantidad}</td>
                    <td>{moneda(i.precio_unitario)}</td>
                    <td>{moneda(i.subtotal)}</td>
                    <td className={p.estado === "Pendiente de confirmación" && i.disponible < i.cantidad ? "font-semibold text-error-700" : ""}>{i.disponible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-right text-sm">
              Productos {moneda(p.subtotal_productos)} · Entrega {p.costo_entrega === null ? "por confirmar" : moneda(p.costo_entrega)} · <strong>Total {moneda(p.total_final ?? p.subtotal_productos)}</strong>
            </p>
          </section>

          {p.estado === "Pendiente de confirmación" && (
            <section className="tarjeta p-5">
              <h2 className="font-bold">Confirmar y reservar</h2>
              <p className="text-sm text-gris-600">Verifica la disponibilidad, aparta las unidades por 48 horas sin descontarlas del stock físico.</p>
              <Formulario accion={accionConfirmarPedido} boton="Confirmar y reservar" claseBoton="btn-oro" className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="pedido_id" value={p.id} />
                {p.tipo_entrega === "delivery" && (
                  <label>
                    <span className="etiqueta-campo">Costo del delivery (C$)</span>
                    <input name="costo_entrega" required inputMode="decimal" className="campo" />
                  </label>
                )}
              </Formulario>
            </section>
          )}

          {p.estado === "Reservado" && (
            <section className="tarjeta p-5">
              <h2 className="font-bold">Pago y entrega</h2>
              {p.estado_pago === "Pendiente" ? (
                <>
                  <p className="text-sm text-gris-600">La reserva vence el {fechaHora(p.reservado_hasta)} si no registras el pago verificado.</p>
                  <Formulario accion={accionPagoPedido} boton={`Registrar pago de ${moneda(p.total_final)}`} claseBoton="btn-oro" confirmar="¿Verificaste el pago completo?" className="mt-3">
                    <input type="hidden" name="pedido_id" value={p.id} />
                  </Formulario>
                </>
              ) : (
                <p className="text-sm text-ok-700">Pago registrado. El pedido conserva sus unidades hasta la entrega.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {pasos.map((e) => (
                  <Formulario key={e} accion={accionEntregaPedido} boton={e} claseBoton="btn-borde">
                    <input type="hidden" name="pedido_id" value={p.id} />
                    <input type="hidden" name="entrega" value={e} />
                  </Formulario>
                ))}
                {p.estado_pago === "Pagado" && (
                  <Formulario accion={accionEntregaPedido} boton="Entregado: cerrar pedido" claseBoton="btn-primario" confirmar="Se registrará la venta y la salida de inventario. ¿Continuar?">
                    <input type="hidden" name="pedido_id" value={p.id} />
                    <input type="hidden" name="entrega" value="Entregado" />
                  </Formulario>
                )}
              </div>
            </section>
          )}

          {["Pendiente de confirmación", "Reservado"].includes(p.estado) && (
            <section className="tarjeta p-5">
              <h2 className="font-bold">Cancelar pedido</h2>
              <Formulario accion={accionCancelarPedido} boton="Cancelar pedido" claseBoton="btn-peligro" confirmar="Se liberarán las unidades reservadas. ¿Continuar?" className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="pedido_id" value={p.id} />
                <label className="min-w-64 flex-1">
                  <span className="etiqueta-campo">Motivo</span>
                  <input name="motivo" required className="campo" />
                </label>
              </Formulario>
            </section>
          )}
        </div>
        <div className="space-y-5">
          <section className="tarjeta p-5">
            <h2 className="font-bold">Reservas de inventario</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {reservas.length === 0 && <li className="text-gris-600">Sin reservas.</li>}
              {reservas.map((r, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    {r.producto} ×{r.cantidad}
                  </span>
                  <Etiqueta texto={r.estado} tono={r.estado === "Activa" ? "warn" : r.estado === "Consumida" ? "ok" : "n"} />
                </li>
              ))}
            </ul>
          </section>
          <section className="tarjeta p-5">
            <h2 className="font-bold">Pagos</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {pagos.length === 0 && <li className="text-gris-600">Sin pagos registrados.</li>}
              {pagos.map((x, i) => (
                <li key={i} className="flex justify-between">
                  <span>{fechaHora(x.registrado_en)}</span>
                  <strong>{moneda(x.monto)}</strong>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
