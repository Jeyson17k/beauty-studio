// MOD-08 Inventario, ventas y gastos (CU-32, CU-33, CU-34; RF-26, RF-27, RF-28).
// Stock disponible = físico − reservado (RN-24.3). Ningún ajuste deja el físico por debajo de lo reservado (RN-26.3).
import type { PoolClient } from "pg";
import { q, q1, tx, Db } from "@/lib/db";
import { ReglaError } from "@/lib/errores";
import { auditar } from "./seguridad";

export type Producto = {
  id: number; categoria_id: number; categoria: string; nombre: string; descripcion: string | null; foto_url: string | null; precio_venta: number;
  stock_actual: number; stock_reservado: number; stock_minimo: number; visible_publico: boolean; activo: boolean; disponible: number; costo_promedio: number | null;
};

const SELECT_PRODUCTO = `
  SELECT p.*, cp.nombre AS categoria, (p.stock_actual - p.stock_reservado) AS disponible,
    (SELECT round(sum(m.cantidad * m.costo_unitario) / NULLIF(sum(m.cantidad), 0), 2) FROM movimiento_inventario m WHERE m.producto_id = p.id AND m.tipo = 'Entrada') AS costo_promedio
  FROM producto p JOIN categoria_producto cp ON cp.id = p.categoria_id`;

export const categoriasProducto = () => q<{ id: number; nombre: string }>("SELECT id, nombre FROM categoria_producto ORDER BY nombre");
export const categoriasGasto = () => q<{ id: number; nombre: string }>("SELECT id, nombre FROM categoria_gasto ORDER BY nombre");

/** Catálogo público: solo productos activos y visibles; no muestra existencias exactas (RN-20.1 a RN-20.4). */
export async function catalogoPublico(f: { texto?: string; categoria?: number } = {}) {
  return q<Pick<Producto, "id" | "nombre" | "descripcion" | "foto_url" | "precio_venta" | "categoria"> & { agotado: boolean }>(
    `SELECT p.id, p.nombre, p.descripcion, p.foto_url, p.precio_venta, cp.nombre AS categoria, (p.stock_actual - p.stock_reservado) <= 0 AS agotado
     FROM producto p JOIN categoria_producto cp ON cp.id = p.categoria_id
     WHERE p.activo AND p.visible_publico AND ($1::text IS NULL OR p.nombre ILIKE '%' || $1 || '%' OR p.descripcion ILIKE '%' || $1 || '%')
       AND ($2::int IS NULL OR p.categoria_id = $2)
     ORDER BY cp.nombre, p.nombre`,
    [f.texto?.trim() || null, f.categoria || null],
  );
}

export const productos = () => q<Producto>(`${SELECT_PRODUCTO} ORDER BY p.activo DESC, (p.stock_actual - p.stock_reservado) <= p.stock_minimo DESC, p.nombre`);
export const producto = (id: number, db?: Db) => q1<Producto>(`${SELECT_PRODUCTO} WHERE p.id = $1`, [id], db);
export const productosBajoStock = () =>
  q<Producto>(`${SELECT_PRODUCTO} WHERE p.activo AND (p.stock_actual - p.stock_reservado) <= p.stock_minimo ORDER BY (p.stock_actual - p.stock_reservado)`);

export async function guardarProducto(uid: number, d: { id?: number; categoria_id: number; nombre: string; descripcion: string | null; foto_url: string | null; precio_venta: number; stock_minimo: number; visible_publico: boolean; activo: boolean }) {
  if (d.nombre.trim().length < 2) throw new ReglaError("Escribe el nombre del producto.");
  if (!(d.precio_venta > 0)) throw new ReglaError("El precio de venta debe ser mayor que cero.");
  if (!(d.stock_minimo >= 0)) throw new ReglaError("El stock mínimo no puede ser negativo.");
  return tx(async (c) => {
    if (d.id) {
      await q(
        "UPDATE producto SET categoria_id=$2, nombre=$3, descripcion=$4, foto_url=$5, precio_venta=$6, stock_minimo=$7, visible_publico=$8, activo=$9 WHERE id=$1",
        [d.id, d.categoria_id, d.nombre.trim(), d.descripcion, d.foto_url, d.precio_venta, d.stock_minimo, d.visible_publico, d.activo],
        c,
      );
      await auditar(c, uid, "Modificar producto", "producto", d.id, d.nombre);
      return d.id;
    }
    const r = await q1<{ id: number }>(
      "INSERT INTO producto (categoria_id, nombre, descripcion, foto_url, precio_venta, stock_actual, stock_reservado, stock_minimo, visible_publico, activo) VALUES ($1,$2,$3,$4,$5,0,0,$6,$7,$8) RETURNING id",
      [d.categoria_id, d.nombre.trim(), d.descripcion, d.foto_url, d.precio_venta, d.stock_minimo, d.visible_publico, d.activo],
      c,
    );
    await auditar(c, uid, "Registrar producto", "producto", r!.id, d.nombre);
    return r!.id;
  });
}

/** Entrada de inventario con cantidad, costo unitario y fecha (RN-26.5). */
export async function registrarEntrada(uid: number, productoId: number, cantidad: number, costoUnitario: number, motivo: string) {
  if (!Number.isInteger(cantidad) || cantidad <= 0) throw new ReglaError("La cantidad debe ser un número entero mayor que cero.");
  if (!(costoUnitario >= 0)) throw new ReglaError("Escribe el costo unitario de adquisición", "RN-26.5");
  return tx(async (c) => {
    const p = await q1("SELECT id FROM producto WHERE id = $1 FOR UPDATE", [productoId], c);
    if (!p) throw new ReglaError("El producto no existe.");
    await q("UPDATE producto SET stock_actual = stock_actual + $2 WHERE id = $1", [productoId, cantidad], c);
    await q(
      "INSERT INTO movimiento_inventario (producto_id, usuario_id, tipo, cantidad, motivo, costo_unitario) VALUES ($1,$2,'Entrada',$3,$4,$5)",
      [productoId, uid, cantidad, motivo?.trim().slice(0, 150) || "Compra", costoUnitario],
      c,
    );
    await auditar(c, uid, "Entrada de inventario", "producto", productoId, `${cantidad} u. a C$ ${costoUnitario}`);
  });
}

/** Ajuste con motivo obligatorio; no deja el físico negativo ni por debajo de lo reservado (RN-26.2, RN-26.3). */
export async function registrarAjuste(uid: number, productoId: number, delta: number, tipo: "Daño" | "Corrección", motivo: string) {
  if (!Number.isInteger(delta) || delta === 0) throw new ReglaError("Indica cuántas unidades se suman o restan.");
  if (!motivo || motivo.trim().length < 3) throw new ReglaError("Todo ajuste debe indicar un motivo", "RN-26.2");
  if (tipo === "Daño" && delta > 0) throw new ReglaError("Un daño solo puede restar unidades.");
  return tx(async (c) => {
    const p = await q1<{ stock_actual: number; stock_reservado: number }>("SELECT stock_actual, stock_reservado FROM producto WHERE id = $1 FOR UPDATE", [productoId], c);
    if (!p) throw new ReglaError("El producto no existe.");
    if (p.stock_actual + delta < p.stock_reservado) throw new ReglaError(`El ajuste dejaría el stock por debajo de las ${p.stock_reservado} unidades reservadas`, "RN-26.3");
    await q("UPDATE producto SET stock_actual = stock_actual + $2 WHERE id = $1", [productoId, delta], c);
    await q("INSERT INTO movimiento_inventario (producto_id, usuario_id, tipo, cantidad, motivo) VALUES ($1,$2,$3,$4,$5)", [productoId, uid, tipo, delta, motivo.trim().slice(0, 150)], c);
    await auditar(c, uid, `Ajuste de inventario (${tipo})`, "producto", productoId, `${delta} u.: ${motivo}`);
  });
}

export const movimientos = (productoId?: number) =>
  q<{ id: number; producto: string; tipo: string; cantidad: number; motivo: string | null; costo_unitario: number | null; creado_en: Date; pedido_id: number | null; venta_id: number | null }>(
    `SELECT m.id, p.nombre AS producto, m.tipo, m.cantidad, m.motivo, m.costo_unitario, m.creado_en, m.pedido_id, m.venta_id
     FROM movimiento_inventario m JOIN producto p ON p.id = m.producto_id WHERE ($1::int IS NULL OR m.producto_id = $1) ORDER BY m.creado_en DESC LIMIT 100`,
    [productoId ?? null],
  );

/** Salida física por venta con su costo (RN-25.4, RN-26.6, RN-27.6). Si viene de un pedido, consume lo reservado. */
export async function salidaPorVenta(c: PoolClient, uid: number, ventaId: number, productoId: number, cantidad: number, pedidoId: number | null) {
  const p = await q1<{ stock_actual: number; stock_reservado: number; costo: number | null; nombre: string }>(
    `SELECT p.stock_actual, p.stock_reservado, p.nombre,
       (SELECT round(sum(m.cantidad * m.costo_unitario) / NULLIF(sum(m.cantidad), 0), 2) FROM movimiento_inventario m WHERE m.producto_id = p.id AND m.tipo = 'Entrada') AS costo
     FROM producto p WHERE p.id = $1 FOR UPDATE OF p`,
    [productoId],
    c,
  );
  if (!p) throw new ReglaError("El producto no existe.");
  const reservadoUsado = pedidoId ? cantidad : 0;
  if (!pedidoId && p.stock_actual - p.stock_reservado < cantidad)
    throw new ReglaError(`No hay unidades disponibles de ${p.nombre} (las reservadas no se pueden vender)`, "RN-27.3");
  await q("UPDATE producto SET stock_actual = stock_actual - $2, stock_reservado = stock_reservado - $3 WHERE id = $1", [productoId, cantidad, reservadoUsado], c);
  await q(
    "INSERT INTO movimiento_inventario (producto_id, venta_id, pedido_id, usuario_id, tipo, cantidad, motivo, costo_unitario) VALUES ($1,$2,$3,$4,'Venta',$5,$6,$7)",
    [productoId, ventaId, pedidoId, uid, -cantidad, pedidoId ? `Pedido #${pedidoId}` : "Venta directa", p.costo],
    c,
  );
}

/** CU-33: venta directa en el local, con pago y entrega en el momento (RN-27.1, RN-27.2). */
export async function registrarVentaDirecta(uid: number, lineas: { productoId: number; cantidad: number }[], nota?: string) {
  const items = lineas.filter((l) => l.productoId && l.cantidad > 0);
  if (items.length === 0) throw new ReglaError("Agrega al menos un producto.");
  if (items.some((l) => !Number.isInteger(l.cantidad))) throw new ReglaError("Las cantidades deben ser números enteros.");
  return tx(async (c) => {
    let total = 0;
    const precios: Record<number, number> = {};
    for (const l of items) {
      const p = await q1<{ precio_venta: number; activo: boolean }>("SELECT precio_venta, activo FROM producto WHERE id = $1", [l.productoId], c);
      if (!p?.activo) throw new ReglaError("Uno de los productos no está activo.");
      precios[l.productoId] = p.precio_venta;
      total += p.precio_venta * l.cantidad;
    }
    const v = await q1<{ id: number }>("INSERT INTO venta (usuario_id, origen, total, nota) VALUES ($1,'fisica',$2,$3) RETURNING id", [uid, Math.round(total * 100) / 100, nota?.slice(0, 150) || null], c);
    for (const l of items) {
      await q("INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario) VALUES ($1,$2,$3,$4)", [v!.id, l.productoId, l.cantidad, precios[l.productoId]], c);
      await salidaPorVenta(c, uid, v!.id, l.productoId, l.cantidad, null);
    }
    await auditar(c, uid, "Registrar venta directa", "venta", v!.id, `C$ ${total}`);
    return { ventaId: v!.id, total };
  });
}

export const ventasRecientes = () =>
  q<{ id: number; origen: string; total: number; creado_en: Date; pedido_id: number | null; productos: string }>(
    `SELECT v.id, v.origen, v.total, v.creado_en, v.pedido_id,
       (SELECT string_agg(p.nombre || ' ×' || d.cantidad, ', ') FROM detalle_venta d JOIN producto p ON p.id = d.producto_id WHERE d.venta_id = v.id) AS productos
     FROM venta v ORDER BY v.creado_en DESC LIMIT 50`,
  );

/** CU-34: costos y gastos con concepto, categoría, monto y fecha (RN-28.1 a RN-28.3). */
export async function registrarGasto(uid: number, d: { categoriaId: number; concepto: string; monto: number; fecha: string; observacion?: string }) {
  if (!d.concepto || d.concepto.trim().length < 3) throw new ReglaError("Escribe el concepto.");
  if (!(d.monto > 0)) throw new ReglaError("El monto debe ser mayor que cero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) throw new ReglaError("Elige la fecha.");
  return tx(async (c) => {
    const r = await q1<{ id: number }>(
      "INSERT INTO gasto (usuario_id, categoria_id, concepto, monto, fecha, observacion) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [uid, d.categoriaId, d.concepto.trim().slice(0, 150), Math.round(d.monto * 100) / 100, d.fecha, d.observacion?.trim().slice(0, 200) || null],
      c,
    );
    await auditar(c, uid, "Registrar gasto", "gasto", r!.id, `${d.concepto}: C$ ${d.monto}`);
    return r!.id;
  });
}

export async function eliminarGasto(uid: number, id: number) {
  return tx(async (c) => {
    const g = await q1<{ concepto: string }>("DELETE FROM gasto WHERE id = $1 RETURNING concepto", [id], c);
    if (!g) throw new ReglaError("El gasto no existe.");
    await auditar(c, uid, "Eliminar gasto", "gasto", id, g.concepto);
  });
}

export const gastos = (desde: string, hasta: string) =>
  q<{ id: number; categoria: string; concepto: string; monto: number; fecha: string; observacion: string | null }>(
    `SELECT g.id, cg.nombre AS categoria, g.concepto, g.monto, to_char(g.fecha, 'YYYY-MM-DD') AS fecha, g.observacion
     FROM gasto g JOIN categoria_gasto cg ON cg.id = g.categoria_id WHERE g.fecha BETWEEN $1 AND $2 ORDER BY g.fecha DESC, g.id DESC`,
    [desde, hasta],
  );
