import Link from "next/link";
import { q1 } from "@/lib/db";
import { sesionAdmin } from "@/lib/sesion";
import { notificacionesPendientes } from "@/modulos/seguridad";
import { solicitudesPorEstado } from "@/modulos/solicitudes";
import { agendaAdmin } from "@/modulos/agenda";
import { sesionesPanel } from "@/modulos/catalogo";
import { SOL } from "@/modulos/estados";
import { desdeLocal, diaLocal, fecha, fechaHora, hora } from "@/lib/tiempo";
import { EncabezadoPanel, Etiqueta, Vacio } from "@/componentes/ui";
import { accionLeerNotificaciones } from "../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel de inicio" };

// A02 Panel de inicio (CU-29, RF-29)
export default async function PanelInicio() {
  const s = (await sesionAdmin())!;
  const hoy = desdeLocal(`${diaLocal(new Date())}T00:00`);
  const [conteo, atencion, notifs, hoyAgenda, proximas, sesiones] = await Promise.all([
    q1<{ nuevas: number; vencidas: number; pago: number; fallidos: number; encola: number; comprobantes: number; pedidos: number; por_entregar: number; bajo_stock: number }>(`
      SELECT (SELECT count(*)::int FROM solicitud_actividad WHERE estado = 'Pendiente de revisión') AS nuevas,
             (SELECT count(*)::int FROM solicitud_actividad WHERE estado = 'Plazo vencido pendiente de revisión') AS vencidas,
             (SELECT count(*)::int FROM solicitud_actividad WHERE estado = 'Pendiente de pago') AS pago,
             (SELECT count(*)::int FROM mensaje_whatsapp m WHERE m.estado = 'Fallido' AND m.tipo <> 'Código de verificación' AND m.creado_en > now() - interval '7 days'
                AND NOT EXISTS (SELECT 1 FROM mensaje_whatsapp x WHERE x.solicitud_id = m.solicitud_id AND x.tipo = m.tipo AND x.estado <> 'Fallido' AND x.creado_en > m.creado_en)) AS fallidos,
             (SELECT count(*)::int FROM mensaje_whatsapp WHERE estado = 'En cola') AS encola,
             (SELECT count(*)::int FROM comprobante_pago WHERE estado = 'Pendiente') AS comprobantes,
             (SELECT count(*)::int FROM pedido WHERE estado = 'Pendiente de confirmación') AS pedidos,
             (SELECT count(*)::int FROM pedido WHERE estado = 'Reservado' AND estado_pago = 'Pagado') AS por_entregar,
             (SELECT count(*)::int FROM producto WHERE activo AND stock_actual - stock_reservado <= stock_minimo) AS bajo_stock`),
    solicitudesPorEstado([SOL.PLAZO_VENCIDO, SOL.PENDIENTE_REVISION, SOL.COTIZACION_ENVIO], 8),
    notificacionesPendientes(s.uid, 12),
    agendaAdmin(hoy, new Date(hoy.getTime() + 86_400_000)),
    agendaAdmin(new Date(hoy.getTime() + 86_400_000), new Date(hoy.getTime() + 8 * 86_400_000)),
    sesionesPanel(),
  ]);
  const c = conteo!;
  const tarjetas = [
    ["Solicitudes nuevas", c.nuevas, "bg-info-100 text-info-700", "/panel/solicitudes?estado=Pendiente de revisión"],
    ["Plazo vencido por revisar", c.vencidas, "bg-aviso-100 text-aviso-700", "/panel/solicitudes?estado=Plazo vencido pendiente de revisión"],
    ["Envíos de WhatsApp fallidos", c.fallidos, "bg-error-100 text-error-700", "/panel/mensajes?estado=Fallido"],
    ["Comprobantes por validar", c.comprobantes, "bg-[#eee8dc] text-gris-600", "/panel/solicitudes?estado=Pendiente de pago"],
    ["Pedidos por confirmar", c.pedidos, "bg-info-100 text-info-700", "/panel/pedidos?estado=Pendiente de confirmación"],
    ["Pagados por entregar", c.por_entregar, "bg-ok-100 text-ok-700", "/panel/pedidos?estado=Reservado"],
    ["Bajo stock o agotados", c.bajo_stock, "bg-aviso-100 text-aviso-700", "/panel/productos"],
  ] as const;
  const recordatorios = notifs.filter((n) => n.tipo === "Recordatorio");
  const alertas = notifs.filter((n) => n.tipo !== "Recordatorio");
  const futuras = sesiones.filter((x) => ["Abierta", "Llena", "Programada"].includes(x.estado) && new Date(x.inicio) > new Date()).slice(0, 4);
  return (
    <>
      <EncabezadoPanel titulo="Panel de inicio">
        <Link href="/panel/registrar" className="btn-primario">
          + Registrar por una clienta
        </Link>
        <span className="rounded-full bg-oro-200 px-3 py-1.5 text-xs font-semibold">🔔 {alertas.length} alertas</span>
      </EncabezadoPanel>
      <div className="space-y-5 p-5 lg:p-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7">
          {tarjetas.map(([t, n, cls, href]) => (
            <Link key={t} href={href} className={`rounded-2xl p-4 ${cls}`}>
              <p className="text-3xl font-bold">{n}</p>
              <p className="mt-2 text-sm font-semibold">{t}</p>
            </Link>
          ))}
        </div>
        {c.encola > 0 && <p className="text-sm text-aviso-700">{c.encola} mensaje(s) de WhatsApp esperando el aviso de envío.</p>}

        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr_0.9fr]">
          <section className="tarjeta p-4">
            <h2 className="font-bold">Requieren tu atención</h2>
            <ul className="mt-2 divide-y divide-linea-200">
              {atencion.length === 0 && <Vacio>Nada pendiente.</Vacio>}
              {atencion.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">
                      {a.clienta} · {a.actividad}
                    </p>
                    <div className="mt-1">
                      <Etiqueta texto={a.estado} />
                    </div>
                  </div>
                  <Link href={`/panel/solicitudes/${a.id}`} className="text-sm font-semibold text-oro-700">
                    Abrir
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="tarjeta p-4">
            <h2 className="font-bold">Recordatorios</h2>
            <ul className="mt-2 space-y-3 text-sm">
              {recordatorios.length === 0 && proximas.length === 0 && <Vacio>Sin actividades próximas.</Vacio>}
              {recordatorios.map((r) => (
                <li key={r.id}>{r.mensaje}</li>
              ))}
              {recordatorios.length === 0 &&
                proximas.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <p className="text-xs font-semibold text-oro-700">
                      {fecha(p.inicio)} {hora(p.inicio)}
                    </p>
                    <p>
                      {p.actividad} · {p.sesion_id ? `${p.inscritas ?? 0} inscrita(s)` : p.clienta}
                    </p>
                  </li>
                ))}
            </ul>
          </section>

          <section className="tarjeta p-4">
            <h2 className="font-bold">Accesos</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/panel/solicitudes/nueva" className="btn-borde">
                Registrar solicitud directa
              </Link>
              <Link href="/panel/agenda" className="btn-borde">
                Ver agenda
              </Link>
              <Link href="/panel/cursos" className="btn-borde">
                Programar sesión
              </Link>
              <Link href="/panel/ventas" className="btn-borde">
                Registrar venta física
              </Link>
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <section className="tarjeta p-4">
            <h2 className="font-bold">Agenda de hoy</h2>
            <ul className="mt-2 space-y-2">
              {hoyAgenda.length === 0 && <Vacio>Sin actividades hoy.</Vacio>}
              {hoyAgenda.map((a) => (
                <li key={a.id} className="flex items-center gap-4 text-sm">
                  <span className="w-32 font-semibold">
                    {hora(a.inicio)} – {hora(a.fin)}
                  </span>
                  <span className={`h-8 w-1 rounded ${a.estado === "Confirmada" ? "bg-ok-700" : "bg-aviso-700"}`} />
                  <span>
                    {a.actividad} · {a.sesion_id ? `${a.inscritas ?? 0}/${a.capacidad} inscritas` : `${a.clienta} (${a.fuera_local ? "domicilio" : "local"})`}
                    {a.estado === "Provisional" && " · reserva provisional"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="tarjeta p-4">
            <h2 className="font-bold">Sesiones grupales</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {futuras.length === 0 && <Vacio>No hay sesiones próximas.</Vacio>}
              {futuras.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{x.curso}</span>
                    <span className="block text-xs text-gris-600">{fechaHora(x.inicio)}</span>
                  </span>
                  <span className="text-right text-xs">
                    {x.confirmados} confirmadas · {x.apartados} apartadas · {Math.max(0, x.capacidad - x.confirmados - x.apartados)} libres
                    <span className="mt-1 block">
                      <Etiqueta texto={x.estado} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="tarjeta p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Notificaciones</h2>
            {alertas.length > 0 && (
              <form action={accionLeerNotificaciones}>
                <button className="text-sm font-semibold text-oro-700">Marcar todas como leídas</button>
              </form>
            )}
          </div>
          <ul className="mt-2 divide-y divide-linea-200 text-sm">
            {alertas.length === 0 && <Vacio>Sin notificaciones nuevas.</Vacio>}
            {alertas.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <Etiqueta texto={n.tipo} tono={/fallid|Error/i.test(n.tipo) ? "err" : /vencido/i.test(n.tipo) ? "warn" : "info"} />
                  <p className="mt-1">{n.mensaje}</p>
                  <p className="text-xs text-gris-600">{fechaHora(n.creado_en)}</p>
                </div>
                <div className="flex shrink-0 gap-3">
                  {n.entidad_id && ["solicitud_actividad", "pedido"].includes(n.entidad ?? "") && (
                    <Link href={n.entidad === "pedido" ? `/panel/pedidos/${n.entidad_id}` : `/panel/solicitudes/${n.entidad_id}`} className="font-semibold text-oro-700">
                      Ver
                    </Link>
                  )}
                  <form action={accionLeerNotificaciones}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="text-gris-600 hover:underline">Leída</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
