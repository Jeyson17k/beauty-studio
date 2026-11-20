// Pruebas del aviso al confirmar un pedido y del plazo de reserva solo para retiro.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { q, q1, pool } from "@/lib/db";
import { cambiarCarrito, confirmarYReservar, crearPedido, plantillaAvisoPedido, vencerReservasPedidos } from "@/modulos/pedidos";
import { guardarProducto, registrarEntrada } from "@/modulos/inventario";
import { clienta, reiniciarBase, UID } from "./utilidades";

let prod: number;

async function pedidoDe(entrega: "retiro" | "delivery", acepta = true) {
  const c = await clienta(acepta);
  await cambiarCarrito(c.id, prod, 2, true);
  return crearPedido(c.id, { entrega, direccion: entrega === "delivery" ? "Reparto Fátima, casa 5" : undefined });
}

beforeAll(async () => {
  await reiniciarBase();
  await q("INSERT INTO categoria_producto (nombre) VALUES ('Maquillaje')");
  prod = await guardarProducto(UID, { categoria_id: 1, nombre: "Base líquida", descripcion: null, foto_url: null, precio_venta: 650, stock_minimo: 1, visible_publico: true, activo: true });
  await registrarEntrada(UID, prod, 50, 100, "Compra");
});
afterAll(() => pool.end());

describe("Confirmación de pedidos", () => {
  it("PF-PC1 · retiro: la reserva dura 48 horas, el aviso lleva el total y la fecha límite y queda ligado al pedido", async () => {
    const id = await pedidoDe("retiro");
    const r = await confirmarYReservar(UID, id, null);
    expect(r.horas).toBe(48);
    expect(r.aviso.enviado).toBe(true);
    const p = (await q1<{ reservado_hasta: Date | null }>("SELECT reservado_hasta FROM pedido WHERE id = $1", [id]))!;
    expect(p.reservado_hasta).not.toBeNull();
    const m = (await q1<{ tipo: string; plantilla: string; estado: string }>("SELECT tipo, plantilla, estado FROM mensaje_whatsapp WHERE pedido_id = $1", [id]))!;
    expect(m.tipo).toBe("Confirmación de pedido");
    expect(m.plantilla).toBe("pedido_confirmado_retiro_v1");
    const t = (await plantillaAvisoPedido(id))!;
    expect(t.texto).toContain("C$ 1,300");
    expect(t.texto).toContain(`pedido #${id}`);
    expect(t.texto).toContain("retíralos");
  });

  it("PF-PC2 · delivery: la reserva no vence, no se expira sola y el aviso lleva el costo del envío", async () => {
    const id = await pedidoDe("delivery");
    const r = await confirmarYReservar(UID, id, 100);
    expect(r.horas).toBeNull();
    const p = (await q1<{ reservado_hasta: Date | null; total_final: number }>("SELECT reservado_hasta, total_final FROM pedido WHERE id = $1", [id]))!;
    expect(p.reservado_hasta).toBeNull();
    expect(Number(p.total_final)).toBe(1400);
    expect((await q<{ expira_en: Date | null }>("SELECT expira_en FROM reserva_inventario WHERE pedido_id = $1", [id]))[0].expira_en).toBeNull();
    await vencerReservasPedidos();
    expect((await q1<{ estado: string }>("SELECT estado FROM pedido WHERE id = $1", [id]))!.estado).toBe("Reservado");
    const t = (await plantillaAvisoPedido(id))!;
    expect(t.nombre).toBe("pedido_confirmado_delivery_v1");
    expect(t.texto).toContain("delivery: C$ 100");
    expect(t.texto).toContain("total: C$ 1,400");
    expect(t.texto).toContain("Reparto Fátima");
  });

  it("PF-PC3 · un retiro sin pago sigue venciendo a las 48 horas", async () => {
    const id = await pedidoDe("retiro");
    await confirmarYReservar(UID, id, null);
    await q("UPDATE pedido SET reservado_hasta = now() - interval '1 minute' WHERE id = $1", [id]);
    await vencerReservasPedidos();
    expect((await q1<{ estado: string }>("SELECT estado FROM pedido WHERE id = $1", [id]))!.estado).toBe("Expirado");
  });

  it("PF-PC4 · si la clienta no aceptó mensajes, el pedido se confirma igual y no se envía el aviso", async () => {
    const id = await pedidoDe("retiro", false);
    const r = await confirmarYReservar(UID, id, null);
    expect(r.aviso.enviado).toBe(false);
    expect((await q1<{ estado: string }>("SELECT estado FROM pedido WHERE id = $1", [id]))!.estado).toBe("Reservado");
    expect(await q1("SELECT id FROM mensaje_whatsapp WHERE pedido_id = $1", [id])).toBeNull();
  });
});
