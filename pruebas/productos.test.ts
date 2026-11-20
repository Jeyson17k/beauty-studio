// Pruebas de eliminar productos y de seguir agregando productos al carrito.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { q, q1, pool } from "@/lib/db";
import { cambiarCarrito, cantidadCarrito, cancelarPedido, crearPedido, verCarrito } from "@/modulos/pedidos";
import { catalogoPublico, eliminarProducto, guardarProducto, productos, registrarEntrada, registrarVentaDirecta } from "@/modulos/inventario";
import { clienta, reiniciarBase, UID } from "./utilidades";

const nuevo = (nombre: string, precio = 100) =>
  guardarProducto(UID, { categoria_id: 1, nombre, descripcion: null, foto_url: null, precio_venta: precio, stock_minimo: 1, visible_publico: true, activo: true });

beforeAll(async () => {
  await reiniciarBase();
  await q("INSERT INTO categoria_producto (nombre) VALUES ('Maquillaje')");
});
afterAll(() => pool.end());

describe("Eliminar productos", () => {
  it("PF-EP1 · un producto sin ventas ni pedidos se borra del todo: del inventario, del catálogo y de los carritos", async () => {
    const id = await nuevo("Producto de prueba");
    await registrarEntrada(UID, id, 3, 50, "Compra");
    const c = await clienta();
    await cambiarCarrito(c.id, id, 1, true);
    await eliminarProducto(UID, id);
    expect((await productos()).some((p) => p.id === id)).toBe(false);
    expect((await catalogoPublico()).some((p) => p.id === id)).toBe(false);
    expect((await verCarrito(c.id)).items).toHaveLength(0);
    expect(await q1("SELECT id FROM producto WHERE id = $1", [id])).toBeNull();
    expect(await q1("SELECT id FROM movimiento_inventario WHERE producto_id = $1", [id])).toBeNull();
  });

  it("PF-EP2 · un producto con ventas se retira pero conserva su historial para los reportes", async () => {
    const id = await nuevo("Producto vendido", 200);
    await registrarEntrada(UID, id, 5, 80, "Compra");
    await registrarVentaDirecta(UID, [{ productoId: id, cantidad: 1 }]);
    await eliminarProducto(UID, id);
    expect((await productos()).some((p) => p.id === id)).toBe(false);
    expect((await catalogoPublico()).some((p) => p.id === id)).toBe(false);
    expect(await q1("SELECT id FROM detalle_venta WHERE producto_id = $1", [id])).not.toBeNull();
    expect((await q1<{ eliminado_en: Date | null }>("SELECT eliminado_en FROM producto WHERE id = $1", [id]))!.eliminado_en).not.toBeNull();
  });

  it("PF-EP3 · no se elimina un producto con pedidos pendientes; al cancelarlos sí", async () => {
    const id = await nuevo("Producto con pedido");
    await registrarEntrada(UID, id, 5, 80, "Compra");
    const c = await clienta();
    await cambiarCarrito(c.id, id, 2, true);
    const pedido = await crearPedido(c.id, { entrega: "retiro" });
    await expect(eliminarProducto(UID, id)).rejects.toThrow(/pedido\(s\) pendiente/);
    expect((await productos()).some((p) => p.id === id)).toBe(true);
    await cancelarPedido(UID, pedido, "La clienta ya no lo quiere");
    await eliminarProducto(UID, id);
    expect((await productos()).some((p) => p.id === id)).toBe(false);
  });
});

describe("Carrito con varios productos", () => {
  it("PF-CA1 · la clienta puede seguir agregando productos distintos y todos van en el mismo pedido", async () => {
    const a = await nuevo("Producto A", 100);
    const b = await nuevo("Producto B", 250);
    const c = await clienta();
    await cambiarCarrito(c.id, a, 2, true);
    await cambiarCarrito(c.id, b, 1, true);
    await cambiarCarrito(c.id, a, 1, true);
    const car = await verCarrito(c.id);
    expect(car.items.map((i) => [i.nombre, i.cantidad])).toEqual([["Producto A", 3], ["Producto B", 1]]);
    expect(car.total).toBe(550);
    expect(await cantidadCarrito(c.id)).toBe(4);
    const id = await crearPedido(c.id, { entrega: "retiro" });
    expect((await q<{ n: number }>("SELECT count(*)::int AS n FROM detalle_pedido WHERE pedido_id = $1", [id]))[0].n).toBe(2);
  });
});
