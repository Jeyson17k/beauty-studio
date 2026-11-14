// MOD-09 Panel y reportes (CU-35; RF-30). Reportes administrativos, no son facturación fiscal (RN-30.8).
import { q, q1 } from "@/lib/db";
import { desdeLocal } from "@/lib/tiempo";

export type Periodo = { desde: string; hasta: string }; // días locales, ambos incluidos

const rango = (p: Periodo) => [desdeLocal(`${p.desde}T00:00`), new Date(desdeLocal(`${p.hasta}T00:00`).getTime() + 86_400_000)] as const;
const n = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

const CLAVES = ["servicios", "cursos", "ventas_local", "ventas_pedidos", "anticipos_retenidos", "costo_productos", "costo_servicios", "gastos_operativos",
  "cobros_anticipos", "cobros_saldos", "cobros_pedidos", "cobros_local", "anticipos_pendientes", "pedidos_por_entregar"] as const;
type Montos = Record<(typeof CLAVES)[number], number>;

export async function reporte(p: Periodo) {
  const [a, b] = rango(p);
  const r = await q1<Record<string, number>>(
    `SELECT
       -- Ingresos de operaciones terminadas (RN-30.7): precio acordado de servicios realizados y cursos impartidos
       (SELECT COALESCE(sum(co.precio_total),0) FROM solicitud_actividad s JOIN cotizacion co ON co.solicitud_id = s.id AND co.vigente
          LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id
          WHERE s.tipo = 'servicio' AND s.estado IN ('Realizada','Cerrada') AND COALESCE(s.inicio_solicitado, ses.inicio) >= $1 AND COALESCE(s.inicio_solicitado, ses.inicio) < $2) AS servicios,
       (SELECT COALESCE(sum(co.precio_total),0) FROM solicitud_actividad s JOIN cotizacion co ON co.solicitud_id = s.id AND co.vigente
          JOIN sesion_curso ses ON ses.id = s.sesion_id
          WHERE s.tipo = 'curso' AND s.estado IN ('Realizada','Cerrada') AND ses.inicio >= $1 AND ses.inicio < $2) AS cursos,
       (SELECT COALESCE(sum(total),0) FROM venta WHERE origen = 'fisica' AND creado_en >= $1 AND creado_en < $2) AS ventas_local,
       (SELECT COALESCE(sum(total),0) FROM venta WHERE origen = 'web' AND creado_en >= $1 AND creado_en < $2) AS ventas_pedidos,
       -- Anticipos retenidos por cancelación de la clienta o inasistencia (RN-30.11): no son un nuevo cobro
       (SELECT COALESCE(sum(pg.monto),0) FROM pago pg JOIN solicitud_actividad s ON s.id = pg.solicitud_id
          WHERE ((s.estado = 'Cancelada' AND s.origen_cancelacion = 'clienta') OR s.estado = 'No asistida') AND s.actualizado_en >= $1 AND s.actualizado_en < $2) AS anticipos_retenidos,
       -- Costos: productos vendidos (costo guardado en la salida), servicios y cursos, y gastos operativos (RN-30.6, RN-28.5)
       (SELECT COALESCE(sum(-m.cantidad * COALESCE(m.costo_unitario,0)),0) FROM movimiento_inventario m WHERE m.tipo = 'Venta' AND m.creado_en >= $1 AND m.creado_en < $2) AS costo_productos,
       (SELECT COALESCE(sum(g.monto),0) FROM gasto g JOIN categoria_gasto cg ON cg.id = g.categoria_id WHERE cg.nombre ILIKE 'Costo de servicios%' AND g.fecha >= $3::date AND g.fecha <= $4::date) AS costo_servicios,
       (SELECT COALESCE(sum(g.monto),0) FROM gasto g JOIN categoria_gasto cg ON cg.id = g.categoria_id WHERE cg.nombre NOT ILIKE 'Costo de servicios%' AND g.fecha >= $3::date AND g.fecha <= $4::date) AS gastos_operativos,
       -- Cobros por fecha de recepción (RN-30.9)
       (SELECT COALESCE(sum(monto),0) FROM pago WHERE tipo = 'Anticipo' AND registrado_en >= $1 AND registrado_en < $2) AS cobros_anticipos,
       (SELECT COALESCE(sum(monto),0) FROM pago WHERE tipo = 'Saldo' AND registrado_en >= $1 AND registrado_en < $2) AS cobros_saldos,
       (SELECT COALESCE(sum(monto),0) FROM pago WHERE tipo = 'Pedido' AND registrado_en >= $1 AND registrado_en < $2) AS cobros_pedidos,
       (SELECT COALESCE(sum(total),0) FROM venta WHERE origen = 'fisica' AND creado_en >= $1 AND creado_en < $2) AS cobros_local,
       -- Montos separados de las operaciones terminadas (RN-30.10), a la fecha de hoy
       (SELECT COALESCE(sum(pg.monto),0) FROM pago pg JOIN solicitud_actividad s ON s.id = pg.solicitud_id WHERE s.estado = 'Confirmada') AS anticipos_pendientes,
       (SELECT COALESCE(sum(pg.monto),0) FROM pago pg JOIN pedido pe ON pe.id = pg.pedido_id WHERE pe.estado = 'Reservado') AS pedidos_por_entregar`,
    [a, b, p.desde, p.hasta],
  );
  const d = Object.fromEntries(CLAVES.map((k) => [k, n(r![k])])) as Montos;
  const ingresos = d.servicios + d.cursos + d.ventas_local + d.ventas_pedidos + d.anticipos_retenidos;
  const costos = d.costo_productos + d.costo_servicios + d.gastos_operativos;
  const [masVendidos, masSolicitados] = await Promise.all([
    q<{ nombre: string; unidades: number; total: number }>(
      `SELECT p.nombre, sum(d.cantidad)::int AS unidades, sum(d.cantidad * d.precio_unitario)::numeric AS total
       FROM detalle_venta d JOIN venta v ON v.id = d.venta_id JOIN producto p ON p.id = d.producto_id
       WHERE v.creado_en >= $1 AND v.creado_en < $2 GROUP BY p.nombre ORDER BY unidades DESC LIMIT 5`,
      [a, b],
    ),
    q<{ nombre: string; tipo: string; solicitudes: number; confirmadas: number }>(
      `SELECT COALESCE(sv.nombre, cu.nombre) AS nombre, s.tipo, count(*)::int AS solicitudes,
              count(*) FILTER (WHERE s.estado IN ('Confirmada','Realizada','Cerrada','No asistida'))::int AS confirmadas
       FROM solicitud_actividad s LEFT JOIN servicio sv ON sv.id = s.servicio_id
       LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id LEFT JOIN curso cu ON cu.id = ses.curso_id
       WHERE s.creado_en >= $1 AND s.creado_en < $2 GROUP BY 1, 2 ORDER BY solicitudes DESC LIMIT 6`,
      [a, b],
    ),
  ]);
  return { ...d, ingresos: n(ingresos), costos: n(costos), resultado: n(ingresos - costos), masVendidos, masSolicitados };
}
