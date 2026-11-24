// MOD-07 Catálogo, carrito y pedidos (CU-07 a CU-09, CU-30, CU-31; RF-21 a RF-25).
// El carrito no reserva existencias (RN-21.4). La reserva la registra la administradora y dura 48 h (RN-24.7).
// La venta y la salida de inventario se registran una sola vez, al cerrar el pedido (RN-25.7).
import { q, q1, tx, pool } from "@/lib/db";
import { ReglaError } from "@/lib/errores";
import { monto, textoConLetras, textoOpcional } from "@/lib/validar";
import { leerConfig } from "@/lib/config";
import { moneda } from "@/lib/tiempo";
import { auditar, notificar } from "./seguridad";
import { salidaPorVenta } from "./inventario";
import { identificar } from "./clientas";
import { despachar } from "./whatsapp/servicio";
import { Plantilla, plantillaPedidoDelivery, plantillaPedidoRetiro } from "./whatsapp/plantillas";

let esquemaAviso: Promise<unknown> | null = null;
/** Prepara la tabla de mensajes para el aviso de pedido confirmado, si la base todavía no lo tiene (una sola vez; no toca datos). */
function asegurarAvisoPedido() {
  esquemaAviso ??= (async () => {
    await q("ALTER TABLE mensaje_whatsapp ADD COLUMN IF NOT EXISTS pedido_id BIGINT");
    await q("ALTER TABLE mensaje_whatsapp DROP CONSTRAINT IF EXISTS mensaje_whatsapp_tipo_check");
    await q("ALTER TABLE mensaje_whatsapp ADD CONSTRAINT mensaje_whatsapp_tipo_check CHECK (tipo IN ('Cotización','Aviso de confirmación','Código de verificación','Confirmación de pedido'))");
  })().catch((e) => {
    esquemaAviso = null;
    throw e;
  });
  return esquemaAviso;
}

export type ItemCarrito = { producto_id: number; nombre: string; precio_venta: number; cantidad: number; subtotal: number; foto_url: string | null; disponible: boolean };

async function carritoId(clienteId: string, db = pool as Parameters<typeof q1>[2]) {
  const r = await q1<{ id: number }>(
    "INSERT INTO carrito (cliente_id) VALUES ($1) ON CONFLICT (cliente_id) DO UPDATE SET actualizado_en = now() RETURNING id",
    [clienteId],
    db,
  );
  return r!.id;
}

export async function verCarrito(clienteId: string): Promise<{ items: ItemCarrito[]; total: number }> {
  const items = await q<ItemCarrito>(
    `SELECT i.producto_id, p.nombre, p.precio_venta, i.cantidad, (p.precio_venta * i.cantidad)::numeric AS subtotal, p.foto_url,
            (p.activo AND p.visible_publico) AS disponible
     FROM carrito c JOIN item_carrito i ON i.carrito_id = c.id JOIN producto p ON p.id = i.producto_id
     WHERE c.cliente_id = $1 ORDER BY p.nombre`,
    [clienteId],
  );
  return { items, total: Math.round(items.reduce((a, i) => a + Number(i.subtotal), 0) * 100) / 100 };
}

/** Unidades que la clienta lleva en su carrito (para el contador del encabezado). */
export async function cantidadCarrito(clienteId: string) {
  const r = await q1<{ n: number }>(
    "SELECT COALESCE(sum(i.cantidad), 0)::int AS n FROM carrito c JOIN item_carrito i ON i.carrito_id = c.id JOIN producto p ON p.id = i.producto_id WHERE c.cliente_id = $1 AND p.activo AND p.visible_publico",
    [clienteId],
  );
  return r!.n;
}

/** Agrega, cambia o quita (cantidad 0) un producto del carrito (RN-21.2). */
export async function cambiarCarrito(clienteId: string, productoId: number, cantidad: number, sumar = false) {
  if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > 99) throw new ReglaError("Cantidad no válida.");
  const p = await q1<{ activo: boolean; visible_publico: boolean }>("SELECT activo, visible_publico FROM producto WHERE id = $1", [productoId]);
  if (!p?.activo || !p.visible_publico) throw new ReglaError("El producto no está disponible.");
  const cid = await carritoId(clienteId);
  if (cantidad === 0 && !sumar) {
    await q("DELETE FROM item_carrito WHERE carrito_id = $1 AND producto_id = $2", [cid, productoId]);
    return;
  }
  await q(
    `INSERT INTO item_carrito (carrito_id, producto_id, cantidad) VALUES ($1,$2,$3)
     ON CONFLICT (carrito_id, producto_id) DO UPDATE SET cantidad = LEAST(99, CASE WHEN $4 THEN item_carrito.cantidad + EXCLUDED.cantidad ELSE EXCLUDED.cantidad END)`,
    [cid, productoId, Math.max(1, cantidad), sumar],
  );
}

/** CU-09: registra la solicitud de pedido sin apartar inventario (RN-22.7) y prepara el mensaje para WhatsApp (RF-23). */
export async function crearPedido(clienteId: string, d: { entrega: "delivery" | "retiro"; direccion?: string; referencia?: string }) {
  if (d.entrega === "delivery" && !(d.direccion && d.direccion.trim().length >= 5)) throw new ReglaError("Escribe la dirección para el delivery", "RN-22.3");
  if (d.entrega === "delivery") d.direccion = textoConLetras(d.direccion ?? "", "la dirección", 5, 200);
  d.referencia = textoOpcional(d.referencia ?? "", "el punto de referencia", 200);
  const { items, total } = await verCarrito(clienteId);
  const validos = items.filter((i) => i.disponible);
  if (validos.length === 0) throw new ReglaError("Tu carrito está vacío.");
  return tx(async (c) => {
    const p = await q1<{ id: number }>(
      `INSERT INTO pedido (cliente_id, tipo_entrega, direccion, referencia, subtotal_productos, estado) VALUES ($1,$2,$3,$4,$5,'Pendiente de confirmación') RETURNING id`,
      [clienteId, d.entrega, d.entrega === "delivery" ? d.direccion!.trim().slice(0, 250) : null, d.entrega === "delivery" ? d.referencia?.trim().slice(0, 150) || null : null, total],
      c,
    );
    for (const i of validos) {
      // el precio queda congelado en el detalle (RN-25.5)
      await q("INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1,$2,$3,$4,$5)", [p!.id, i.producto_id, i.cantidad, i.precio_venta, i.subtotal], c);
    }
    await q("DELETE FROM item_carrito WHERE carrito_id = (SELECT id FROM carrito WHERE cliente_id = $1)", [clienteId], c);
    await notificar(c, "Pedido nuevo", `Nuevo pedido #${p!.id} por ${moneda(total)}.`, "pedido", p!.id);
    await auditar(c, null, "Registrar pedido web", "pedido", p!.id, moneda(total));
    return p!.id;
  });
}

/**
 * Pedido registrado por la administradora a nombre de una clienta que no puede usar la página (por WhatsApp o en persona).
 * Sigue las mismas reglas que un pedido de la web: no aparta inventario hasta que la administradora lo confirme (RN-22.7).
 */
export async function pedidoPorNegocio(
  uid: number,
  d: { nombre: string; whatsapp: string; acepta: boolean; lineas: { productoId: number; cantidad: number }[]; entrega: "delivery" | "retiro"; direccion?: string; referencia?: string },
) {
  const lineas = d.lineas.filter((l) => l.productoId && l.cantidad > 0);
  if (lineas.length === 0) throw new ReglaError("Elige al menos un producto.");
  const cli = await identificar(d.nombre, d.whatsapp, d.acepta);
  // El carrito de la clienta se arma de cero con lo que la administradora registró.
  await q("DELETE FROM item_carrito WHERE carrito_id IN (SELECT id FROM carrito WHERE cliente_id = $1)", [cli.id]);
  for (const l of lineas) await cambiarCarrito(cli.id, l.productoId, l.cantidad);
  const id = await crearPedido(cli.id, { entrega: d.entrega, direccion: d.direccion, referencia: d.referencia });
  await auditar(pool, uid, "Registrar pedido a nombre de una clienta", "pedido", id);
  return id;
}

export type Pedido = {
  id: number; cliente_id: string; clienta: string; whatsapp: string; tipo_entrega: string; direccion: string | null; referencia: string | null;
  subtotal_productos: number; costo_entrega: number | null; total_final: number | null; estado: string; estado_pago: string; estado_entrega: string;
  reservado_hasta: Date | null; creado_en: Date; actualizado_en: Date;
};

export const pedido = (id: number, db?: Parameters<typeof q1>[2]) =>
  q1<Pedido>("SELECT p.*, c.nombre AS clienta, c.whatsapp FROM pedido p JOIN cliente c ON c.id = p.cliente_id WHERE p.id = $1", [id], db);

export const detallePedido = (id: number) =>
  q<{ producto_id: number; nombre: string; cantidad: number; precio_unitario: number; subtotal: number; disponible: number }>(
    `SELECT d.producto_id, pr.nombre, d.cantidad, d.precio_unitario, d.subtotal, (pr.stock_actual - pr.stock_reservado) AS disponible
     FROM detalle_pedido d JOIN producto pr ON pr.id = d.producto_id WHERE d.pedido_id = $1 ORDER BY pr.nombre`,
    [id],
  );

export const listarPedidos = (estado?: string) =>
  q<Pedido & { productos: string }>(
    `SELECT p.*, c.nombre AS clienta, c.whatsapp,
       (SELECT string_agg(pr.nombre || ' ×' || d.cantidad, ', ') FROM detalle_pedido d JOIN producto pr ON pr.id = d.producto_id WHERE d.pedido_id = p.id) AS productos
     FROM pedido p JOIN cliente c ON c.id = p.cliente_id
     WHERE ($1::text IS NULL OR p.estado = $1)
     ORDER BY CASE p.estado WHEN 'Pendiente de confirmación' THEN 0 WHEN 'Reservado' THEN 1 ELSE 2 END, p.creado_en DESC LIMIT 150`,
    [estado || null],
  );

/** Mensaje que la clienta envía a la administradora por WhatsApp (RN-23.1, RN-23.2, RN-23.5). */
export async function mensajePedido(id: number) {
  const [p, items, cfg] = await Promise.all([pedido(id), detallePedido(id), leerConfig()]);
  if (!p) return null;
  const lineas = items.map((i) => `• ${i.nombre} ×${i.cantidad}: ${moneda(i.subtotal)}`).join("\n");
  const texto =
    `Hola, soy ${p.clienta}. Quiero hacer el pedido #${p.id}:\n${lineas}\n` +
    `Total de productos: ${items.reduce((n, i) => n + i.cantidad, 0)}\n\n` +
    `Total de la compra: ${moneda(p.subtotal_productos)}\n\n` +
    `Entrega: ${p.tipo_entrega === "delivery" ? `delivery a ${p.direccion}${p.referencia ? ` (${p.referencia})` : ""}` : "retiro en el local"}\n` +
    `Por confirmar: disponibilidad${p.tipo_entrega === "delivery" ? ", costo del delivery" : ""} y forma de pago.`;
  return { texto, numero: cfg.whatsapp_negocio };
}

/**
 * Mensaje que recibe la clienta cuando la administradora confirma su pedido: total y, según la entrega, plazo para pagar y retirar (retiro en el local)
 * o costo del envío (delivery). Devuelve null si el pedido todavía no está confirmado.
 */
export async function plantillaAvisoPedido(id: number, db?: Parameters<typeof q1>[2]): Promise<Plantilla | null> {
  const p = await pedido(id, db);
  if (!p || p.estado === "Pendiente de confirmación" || p.total_final === null) return null;
  if (p.tipo_entrega === "delivery") {
    return plantillaPedidoDelivery({ nombre: p.clienta, pedidoId: p.id, productos: Number(p.subtotal_productos), envio: Number(p.costo_entrega ?? 0), total: Number(p.total_final), direccion: p.direccion ?? "la dirección indicada" });
  }
  const cfg = await leerConfig();
  return plantillaPedidoRetiro({ nombre: p.clienta, pedidoId: p.id, total: Number(p.total_final), limite: p.reservado_hasta ?? new Date(), lugar: cfg.lugar_local });
}

export type AvisoPedido = { enviado: true } | { enviado: false; motivo: string };

/** Envía el aviso de pedido confirmado por la API. Su fallo no revierte la confirmación; la administradora puede avisar a mano con el texto del panel. */
async function avisarPedidoConfirmado(uid: number, id: number): Promise<AvisoPedido> {
  await asegurarAvisoPedido();
  const preparado = await tx(async (c) => {
    const cli = await q1<{ cliente_id: string; whatsapp: string; acepta_whatsapp: boolean }>(
      "SELECT c.id AS cliente_id, c.whatsapp, c.acepta_whatsapp FROM pedido p JOIN cliente c ON c.id = p.cliente_id WHERE p.id = $1",
      [id],
      c,
    );
    if (!cli) return null;
    if (!cli.acepta_whatsapp) return { motivo: "La clienta no aceptó recibir mensajes por WhatsApp." } as const;
    const p = await plantillaAvisoPedido(id, c);
    if (!p) return null;
    const m = await q1<{ id: number }>(
      "INSERT INTO mensaje_whatsapp (cliente_id, pedido_id, tipo, plantilla, estado, origen) VALUES ($1,$2,'Confirmación de pedido',$3,'En cola','API') RETURNING id",
      [cli.cliente_id, id, p.nombre],
      c,
    );
    await auditar(c, uid, "Enviar aviso de pedido confirmado", "pedido", id, `mensaje ${m!.id}`);
    return { mensajeId: m!.id, para: cli.whatsapp, plantilla: p };
  });
  if (!preparado) return { enviado: false, motivo: "No se pudo preparar el mensaje." };
  if ("motivo" in preparado) return { enviado: false, motivo: String(preparado.motivo) };
  const r = await despachar(preparado.mensajeId, preparado.para, preparado.plantilla);
  return r.ok ? { enviado: true } : { enviado: false, motivo: r.error };
}

/**
 * CU-30: la administradora confirma y reserva. Verifica el disponible y aparta sin descontar el físico (RN-24.1 a RN-24.7).
 * El plazo de reserva (48 h) corre solo para retiro en el local: con delivery no hay plazo, porque la administradora hace la entrega.
 * Al terminar, avisa a la clienta por WhatsApp (total y plazo o costo de envío).
 */
export async function confirmarYReservar(uid: number, id: number, costoEntrega: number | null) {
  const cfg = await leerConfig();
  const horas = await tx(async (c) => {
    const p = await pedido(id, c);
    if (!p) throw new ReglaError("El pedido no existe.");
    await q("SELECT 1 FROM pedido WHERE id = $1 FOR UPDATE", [id], c);
    if (p.estado !== "Pendiente de confirmación") throw new ReglaError(`El pedido ya está ${p.estado.toLowerCase()}.`);
    if (p.tipo_entrega === "delivery" && (costoEntrega === null || !(costoEntrega >= 0))) throw new ReglaError("Registra el costo del delivery", "RN-24.6");
    if (p.tipo_entrega === "delivery") monto(costoEntrega as number, "el costo del delivery", { max: 10_000, permitirCero: true });
    const plazoHoras = p.tipo_entrega === "retiro" ? Number(cfg.reserva_pedido_horas) : null;
    const items = await q<{ producto_id: number; cantidad: number }>("SELECT producto_id, cantidad FROM detalle_pedido WHERE pedido_id = $1 ORDER BY producto_id", [id], c);
    for (const i of items) {
      const pr = await q1<{ nombre: string; disp: number }>("SELECT nombre, stock_actual - stock_reservado AS disp FROM producto WHERE id = $1 FOR UPDATE", [i.producto_id], c);
      if (!pr || pr.disp < i.cantidad) throw new ReglaError(`No hay suficientes unidades de ${pr?.nombre ?? "un producto"} (disponibles: ${pr?.disp ?? 0})`, "RN-24.4");
      await q("UPDATE producto SET stock_reservado = stock_reservado + $2 WHERE id = $1", [i.producto_id, i.cantidad], c);
      await q(
        "INSERT INTO reserva_inventario (pedido_id, producto_id, cantidad, estado, expira_en) VALUES ($1,$2,$3,'Activa', CASE WHEN $4::int IS NULL THEN NULL ELSE now() + make_interval(hours => $4::int) END)",
        [id, i.producto_id, i.cantidad, plazoHoras],
        c,
      );
      await q("INSERT INTO movimiento_inventario (producto_id, pedido_id, usuario_id, tipo, cantidad, motivo) VALUES ($1,$2,$3,'Reserva',$4,$5)", [i.producto_id, id, uid, i.cantidad, `Pedido #${id}`], c);
    }
    const entrega = p.tipo_entrega === "delivery" ? Math.round((costoEntrega ?? 0) * 100) / 100 : 0;
    await q(
      `UPDATE pedido SET estado = 'Reservado', costo_entrega = $2, total_final = subtotal_productos + $2,
         reservado_hasta = CASE WHEN $3::int IS NULL THEN NULL ELSE now() + make_interval(hours => $3::int) END, actualizado_en = now() WHERE id = $1`,
      [id, entrega, plazoHoras],
      c,
    );
    await auditar(c, uid, "Confirmar pedido y reservar", "pedido", id, `entrega C$ ${entrega}`);
    return plazoHoras;
  });
  const aviso = await avisarPedidoConfirmado(uid, id).catch((e) => ({ enviado: false as const, motivo: (e as Error).message }));
  return { horas, aviso };
}

async function liberarReservas(c: Parameters<typeof q1>[2], uid: number | null, id: number, motivo: string) {
  const rs = await q<{ id: number; producto_id: number; cantidad: number }>("SELECT id, producto_id, cantidad FROM reserva_inventario WHERE pedido_id = $1 AND estado = 'Activa' FOR UPDATE", [id], c);
  for (const r of rs) {
    await q("UPDATE producto SET stock_reservado = stock_reservado - $2 WHERE id = $1", [r.producto_id, r.cantidad], c);
    await q("UPDATE reserva_inventario SET estado = 'Liberada' WHERE id = $1", [r.id], c);
    await q("INSERT INTO movimiento_inventario (producto_id, pedido_id, usuario_id, tipo, cantidad, motivo) VALUES ($1,$2,$3,'Liberación',$4,$5)", [r.producto_id, id, uid, r.cantidad, motivo], c);
  }
}

/** Registra el pago verificado del pedido; evita que expire (RN-24.9, RN-24.10, RN-25.6). */
export async function registrarPagoPedido(uid: number, id: number) {
  return tx(async (c) => {
    const p = await pedido(id, c);
    if (!p) throw new ReglaError("El pedido no existe.");
    if (p.estado !== "Reservado") throw new ReglaError("Solo se registra el pago de pedidos reservados.");
    if (p.estado_pago === "Pagado") throw new ReglaError("El pago ya estaba registrado.");
    await q("UPDATE pedido SET estado_pago = 'Pagado', actualizado_en = now() WHERE id = $1", [id], c);
    await q("INSERT INTO pago (pedido_id, tipo, monto, registrado_por) VALUES ($1,'Pedido',$2,$3)", [id, p.total_final, uid], c);
    await auditar(c, uid, "Registrar pago de pedido", "pedido", id, moneda(p.total_final));
  });
}

const ENTREGA = ["Pendiente", "En preparación", "Listo para retirar", "En delivery", "Entregado"];

/** Avanza la entrega. Entregar exige pago y cierra el pedido con una sola venta y salida (RN-25.3, RN-25.4, RN-25.7). */
export async function cambiarEntrega(uid: number, id: number, nuevo: string) {
  if (!ENTREGA.includes(nuevo)) throw new ReglaError("Estado de entrega no válido.");
  return tx(async (c) => {
    const p = await pedido(id, c);
    if (!p) throw new ReglaError("El pedido no existe.");
    await q("SELECT 1 FROM pedido WHERE id = $1 FOR UPDATE", [id], c);
    if (p.estado !== "Reservado") throw new ReglaError("Solo se gestionan entregas de pedidos reservados.");
    if (nuevo === "Listo para retirar" && p.tipo_entrega !== "retiro") throw new ReglaError("El pedido es para delivery.");
    if (nuevo === "En delivery" && p.tipo_entrega !== "delivery") throw new ReglaError("El pedido es para retiro en el local.");
    if (nuevo !== "Entregado") {
      await q("UPDATE pedido SET estado_entrega = $2, actualizado_en = now() WHERE id = $1", [id, nuevo], c);
      await auditar(c, uid, `Entrega: ${nuevo}`, "pedido", id);
      return { cerrado: false };
    }
    if (p.estado_pago !== "Pagado") throw new ReglaError("Registra el pago completo antes de entregar y cerrar", "RN-25.3");
    const ya = await q1("SELECT 1 FROM venta WHERE pedido_id = $1", [id], c);
    if (ya) throw new ReglaError("La venta de este pedido ya se registró", "RN-25.7");
    const v = await q1<{ id: number }>("INSERT INTO venta (pedido_id, usuario_id, origen, total) VALUES ($1,$2,'web',$3) RETURNING id", [id, uid, p.subtotal_productos], c);
    const items = await q<{ producto_id: number; cantidad: number; precio_unitario: number }>("SELECT producto_id, cantidad, precio_unitario FROM detalle_pedido WHERE pedido_id = $1", [id], c);
    for (const i of items) {
      await q("INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario) VALUES ($1,$2,$3,$4)", [v!.id, i.producto_id, i.cantidad, i.precio_unitario], c);
      await salidaPorVenta(c, uid, v!.id, i.producto_id, i.cantidad, id);
    }
    await q("UPDATE reserva_inventario SET estado = 'Consumida' WHERE pedido_id = $1 AND estado = 'Activa'", [id], c);
    await q("UPDATE pedido SET estado_entrega = 'Entregado', estado = 'Cerrado', actualizado_en = now() WHERE id = $1", [id], c);
    await auditar(c, uid, "Entregar y cerrar pedido", "pedido", id, `venta ${v!.id}`);
    return { cerrado: true };
  });
}

export async function cancelarPedido(uid: number, id: number, motivo: string) {
  if (!motivo || motivo.trim().length < 3) throw new ReglaError("Escribe el motivo.");
  motivo = textoConLetras(motivo, "el motivo", 3, 300);
  return tx(async (c) => {
    const p = await pedido(id, c);
    if (!p) throw new ReglaError("El pedido no existe.");
    if (!["Pendiente de confirmación", "Reservado"].includes(p.estado)) throw new ReglaError(`El pedido ya está ${p.estado.toLowerCase()}.`);
    await liberarReservas(c, uid, id, `Pedido #${id} cancelado`);
    await q("UPDATE pedido SET estado = 'Cancelado', actualizado_en = now() WHERE id = $1", [id], c);
    await auditar(c, uid, "Cancelar pedido", "pedido", id, motivo);
  });
}

/** Planificador: reservas de 48 h sin pago verificado expiran y liberan unidades (RN-24.8). Los pagados no expiran (RN-24.9). */
export async function vencerReservasPedidos() {
  const vencidos = await q<{ id: number }>("SELECT id FROM pedido WHERE estado = 'Reservado' AND estado_pago = 'Pendiente' AND reservado_hasta < now()");
  for (const v of vencidos) {
    await tx(async (c) => {
      const p = await q1<{ estado: string; estado_pago: string }>("SELECT estado, estado_pago FROM pedido WHERE id = $1 FOR UPDATE", [v.id], c);
      if (p?.estado !== "Reservado" || p.estado_pago !== "Pendiente") return;
      await liberarReservas(c, null, v.id, `Reserva del pedido #${v.id} vencida`);
      await q("UPDATE pedido SET estado = 'Expirado', actualizado_en = now() WHERE id = $1", [v.id], c);
      await notificar(c, "Pedido expirado", `El pedido #${v.id} expiró sin pago y se liberaron sus unidades.`, "pedido", v.id);
      await auditar(c, null, "Expirar pedido", "pedido", v.id);
    });
  }
  return vencidos.length;
}
