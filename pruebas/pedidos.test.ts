// Pruebas de catálogo, carrito, pedidos, inventario, ventas, gastos y reportes (RF-20 a RF-30).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { q, q1, pool } from "@/lib/db";
import { cambiarCarrito, cambiarEntrega, cancelarPedido, confirmarYReservar, crearPedido, pedidoPorNegocio, registrarPagoPedido, vencerReservasPedidos, verCarrito } from "@/modulos/pedidos";
import { catalogoPublico, guardarProducto, registrarAjuste, registrarEntrada, registrarGasto, registrarVentaDirecta } from "@/modulos/inventario";
import { reporte } from "@/modulos/reportes";
import { clienta, reiniciarBase, UID } from "./utilidades";

let base: number; // producto con 10 unidades a costo 100
let poco: number; // producto con 2 unidades
const hoy = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
const stock = async (id: number) => (await q1<{ stock_actual: number; stock_reservado: number }>("SELECT stock_actual, stock_reservado FROM producto WHERE id = $1", [id]))!;

beforeAll(async () => {
  await reiniciarBase();
  await q("INSERT INTO categoria_producto (nombre) VALUES ('Maquillaje')");
  await q("INSERT INTO categoria_gasto (nombre) VALUES ('Costo de servicios y cursos'), ('Transporte')");
  base = await guardarProducto(UID, { categoria_id: 1, nombre: "Base líquida", descripcion: "Mate", foto_url: null, precio_venta: 650, stock_minimo: 2, visible_publico: true, activo: true });
  poco = await guardarProducto(UID, { categoria_id: 1, nombre: "Labial", descripcion: null, foto_url: null, precio_venta: 300, stock_minimo: 1, visible_publico: true, activo: true });
  await registrarEntrada(UID, base, 10, 100, "Compra inicial");
  await registrarEntrada(UID, poco, 2, 120, "Compra inicial");
});
afterAll(() => pool.end());

describe("Catálogo, carrito y pedido (RF-20 a RF-23)", () => {
  it("PF-35 · el catálogo muestra solo productos activos y no expone existencias (RN-20.1, RN-20.3)", async () => {
    await guardarProducto(UID, { categoria_id: 1, nombre: "Oculto", descripcion: null, foto_url: null, precio_venta: 10, stock_minimo: 0, visible_publico: false, activo: true });
    const lista = await catalogoPublico();
    expect(lista.map((p) => p.nombre)).not.toContain("Oculto");
    expect(Object.keys(lista[0])).not.toContain("stock_actual");
    expect((await catalogoPublico({ texto: "labi" })).map((p) => p.nombre)).toEqual(["Labial"]);
  });

  it("PF-36 · el carrito no reserva existencias y el pedido queda pendiente sin apartar inventario (RN-21.4, RN-22.7)", async () => {
    const c = await clienta();
    await cambiarCarrito(c.id, base, 2, true);
    await cambiarCarrito(c.id, base, 1, true);
    const car = await verCarrito(c.id);
    expect(car.items[0].cantidad).toBe(3);
    expect(car.total).toBe(1950);
    expect(await stock(base)).toEqual({ stock_actual: 10, stock_reservado: 0 });
    await expect(crearPedido(c.id, { entrega: "delivery" })).rejects.toThrow(/RN-22.3/);
    const id = await crearPedido(c.id, { entrega: "retiro" });
    const p = await q1<{ estado: string; subtotal_productos: number }>("SELECT estado, subtotal_productos FROM pedido WHERE id = $1", [id]);
    expect(p).toEqual({ estado: "Pendiente de confirmación", subtotal_productos: 1950 });
    expect((await verCarrito(c.id)).items).toHaveLength(0);
    expect(await stock(base)).toEqual({ stock_actual: 10, stock_reservado: 0 });
  });
});

describe("Reserva, pago, entrega y cierre (RF-24, RF-25)", () => {
  async function pedidoDe(producto: number, cantidad: number, entrega: "retiro" | "delivery" = "retiro") {
    const c = await clienta();
    await cambiarCarrito(c.id, producto, cantidad, true);
    return crearPedido(c.id, { entrega, direccion: entrega === "delivery" ? "Reparto Fátima, casa 5" : undefined });
  }

  it("PF-37 · confirmar reserva sin descontar el físico y no permite reservar más de lo disponible (RN-24.1 a RN-24.4)", async () => {
    const a = await pedidoDe(poco, 2);
    const b = await pedidoDe(poco, 1);
    await confirmarYReservar(UID, a, null);
    expect(await stock(poco)).toEqual({ stock_actual: 2, stock_reservado: 2 });
    await expect(confirmarYReservar(UID, b, null)).rejects.toThrow(/No hay suficientes unidades/);
    const r = await q1<{ estado: string; reservado_hasta: Date }>("SELECT estado, reservado_hasta FROM pedido WHERE id = $1", [a]);
    expect(r!.estado).toBe("Reservado");
    expect(Math.round((new Date(r!.reservado_hasta).getTime() - Date.now()) / 3600_000)).toBe(48);
    await cancelarPedido(UID, a, "Prueba");
    expect(await stock(poco)).toEqual({ stock_actual: 2, stock_reservado: 0 });
  });

  it("PF-38 · una reserva vencida sin pago expira y libera; una pagada no expira (RN-24.8, RN-24.9)", async () => {
    const a = await pedidoDe(base, 1);
    const b = await pedidoDe(base, 1);
    await confirmarYReservar(UID, a, null);
    await confirmarYReservar(UID, b, null);
    await registrarPagoPedido(UID, b);
    await q("UPDATE pedido SET reservado_hasta = now() - interval '1 minute' WHERE id IN ($1, $2)", [a, b]);
    await vencerReservasPedidos();
    expect((await q1<{ estado: string }>("SELECT estado FROM pedido WHERE id = $1", [a]))!.estado).toBe("Expirado");
    expect((await q1<{ estado: string }>("SELECT estado FROM pedido WHERE id = $1", [b]))!.estado).toBe("Reservado");
    expect((await stock(base)).stock_reservado).toBe(1);
  });

  it("PF-39 · entregar exige pago; al cerrar registra una sola venta y una sola salida con su costo (RN-25.3, RN-25.4, RN-25.7, RN-26.6)", async () => {
    const id = await pedidoDe(base, 2, "delivery");
    await expect(confirmarYReservar(UID, id, null)).rejects.toThrow(/RN-24.6/);
    await confirmarYReservar(UID, id, 80);
    await expect(cambiarEntrega(UID, id, "Entregado")).rejects.toThrow(/RN-25.3/);
    await cambiarEntrega(UID, id, "En delivery");
    await registrarPagoPedido(UID, id);
    const antes = await stock(base);
    const r = await cambiarEntrega(UID, id, "Entregado");
    expect(r.cerrado).toBe(true);
    const despues = await stock(base);
    expect(despues.stock_actual).toBe(antes.stock_actual - 2);
    expect(despues.stock_reservado).toBe(antes.stock_reservado - 2);
    const v = await q<{ total: number }>("SELECT total FROM venta WHERE pedido_id = $1", [id]);
    expect(v).toEqual([{ total: 1300 }]);
    const m = await q<{ cantidad: number; costo_unitario: number }>("SELECT cantidad, costo_unitario FROM movimiento_inventario WHERE pedido_id = $1 AND tipo = 'Venta'", [id]);
    expect(m).toEqual([{ cantidad: -2, costo_unitario: 100 }]);
    const pagos = await q("SELECT 1 FROM pago WHERE pedido_id = $1", [id]);
    expect(pagos).toHaveLength(1); // el pago no se duplica al cerrar (RN-25.6)
    await expect(cambiarEntrega(UID, id, "Entregado")).rejects.toThrow();
  });
});

describe("Inventario, ventas, gastos y reportes (RF-26 a RF-30)", () => {
  it("PF-40 · los ajustes exigen motivo y no dejan el físico debajo de lo reservado (RN-26.2, RN-26.3)", async () => {
    const c = await clienta();
    await cambiarCarrito(c.id, poco, 2, true);
    const id = await crearPedido(c.id, { entrega: "retiro" });
    await confirmarYReservar(UID, id, null);
    await expect(registrarAjuste(UID, poco, -1, "Daño", "")).rejects.toThrow(/motivo/);
    await expect(registrarAjuste(UID, poco, -1, "Daño", "Se quebró")).rejects.toThrow(/RN-26.3/);
    await registrarAjuste(UID, poco, 3, "Corrección", "Conteo físico");
    expect(await stock(poco)).toEqual({ stock_actual: 5, stock_reservado: 2 });
    await cancelarPedido(UID, id, "Fin de prueba");
  });

  it("PF-41 · la venta directa descuenta existencias y no usa unidades reservadas (RN-27.2, RN-27.3)", async () => {
    const c = await clienta();
    await cambiarCarrito(c.id, poco, 4, true);
    const id = await crearPedido(c.id, { entrega: "retiro" });
    await confirmarYReservar(UID, id, null); // reservado 4 de 5
    await expect(registrarVentaDirecta(UID, [{ productoId: poco, cantidad: 2 }])).rejects.toThrow(/RN-27.3/);
    const r = await registrarVentaDirecta(UID, [{ productoId: poco, cantidad: 1 }]);
    expect(r.total).toBe(300);
    expect(await stock(poco)).toEqual({ stock_actual: 4, stock_reservado: 4 });
    await cancelarPedido(UID, id, "Fin de prueba");
  });

  it("PF-42 · el reporte separa ingresos, costos de productos vendidos y gastos y calcula el resultado (RN-30.2, RN-30.6, RN-30.7, RN-28.5)", async () => {
    await registrarGasto(UID, { categoriaId: 1, concepto: "Pestañas para novias", monto: 200, fecha: hoy });
    await registrarGasto(UID, { categoriaId: 2, concepto: "Taxi", monto: 100, fecha: hoy });
    await expect(registrarGasto(UID, { categoriaId: 2, concepto: "x", monto: 10, fecha: hoy })).rejects.toThrow(/concepto/);
    const r = await reporte({ desde: hoy, hasta: hoy });
    expect(r.ventas_pedidos).toBe(1300);
    expect(r.ventas_local).toBe(300);
    expect(r.costo_productos).toBe(2 * 100 + 1 * 120);
    expect(r.costo_servicios).toBe(200);
    expect(r.gastos_operativos).toBe(100);
    expect(r.resultado).toBe(1300 + 300 - 320 - 200 - 100);
    expect(r.masVendidos[0]).toMatchObject({ nombre: "Base líquida", unidades: 2 });
  });

  it("PF-54 · El negocio registra un pedido a nombre de una clienta: queda pendiente, sin apartar inventario y con auditoría", async () => {
    const antes = await stock(base);
    const id = await pedidoPorNegocio(UID, {
      nombre: "Clienta Sin Web", whatsapp: "8855 1234", acepta: true, entrega: "retiro",
      lineas: [{ productoId: base, cantidad: 2 }, { productoId: poco, cantidad: 0 }],
    });
    const p = (await q1<{ estado: string; subtotal_productos: number; cliente_id: string }>("SELECT estado, subtotal_productos, cliente_id FROM pedido WHERE id = $1", [id]))!;
    expect(p.estado).toBe("Pendiente de confirmación");
    expect(p.subtotal_productos).toBe(1300);
    expect(await stock(base)).toEqual(antes);
    expect((await q("SELECT 1 FROM detalle_pedido WHERE pedido_id = $1", [id])).length).toBe(1);
    expect((await q1<{ n: number }>("SELECT count(*)::int AS n FROM auditoria WHERE accion = 'Registrar pedido a nombre de una clienta' AND entidad_id = $1", [id]))!.n).toBe(1);
    await expect(pedidoPorNegocio(UID, { nombre: "Clienta Sin Web", whatsapp: "8855 1234", acepta: true, entrega: "retiro", lineas: [{ productoId: base, cantidad: 0 }] })).rejects.toThrow(/al menos un producto/);
    await expect(pedidoPorNegocio(UID, { nombre: "Clienta Sin Web", whatsapp: "8855 1234", acepta: true, entrega: "delivery", lineas: [{ productoId: base, cantidad: 1 }] })).rejects.toThrow(/dirección/);
  });
});
