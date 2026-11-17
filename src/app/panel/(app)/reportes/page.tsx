import { reporte } from "@/modulos/reportes";
import { diaLocal, moneda } from "@/lib/tiempo";
import { EncabezadoPanel, Vacio } from "@/componentes/ui";
import { PestanasPanel, PESTANAS_FINANZAS } from "@/componentes/PestanasPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reportes" };

function periodo(tipo: string, ref: string, desde?: string, hasta?: string) {
  const d = new Date(`${ref}T12:00:00Z`);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (tipo === "dia") return { desde: ref, hasta: ref };
  if (tipo === "semana") {
    const dow = (d.getUTCDay() + 6) % 7;
    const ini = new Date(d.getTime() - dow * 86_400_000);
    return { desde: iso(ini), hasta: iso(new Date(ini.getTime() + 6 * 86_400_000)) };
  }
  if (tipo === "anio") return { desde: `${ref.slice(0, 4)}-01-01`, hasta: `${ref.slice(0, 4)}-12-31` };
  if (tipo === "intervalo" && desde && hasta && desde <= hasta) return { desde, hasta };
  const [a, m] = ref.split("-").map(Number);
  return { desde: `${ref.slice(0, 7)}-01`, hasta: iso(new Date(Date.UTC(a, m, 0))) };
}

function Fila({ t, v, fuerte, negativo }: { t: string; v: number; fuerte?: boolean; negativo?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${fuerte ? "border-t border-linea-200 font-bold" : ""}`}>
      <span>{t}</span>
      <span>{negativo && v ? `− ${moneda(v)}` : moneda(v)}</span>
    </div>
  );
}

// A22 Reportes (CU-35, RF-30): por día, semana, mes, año o intervalo. No es facturación fiscal (RN-30.8).
export default async function Reportes({ searchParams }: { searchParams: Promise<{ tipo?: string; ref?: string; desde?: string; hasta?: string }> }) {
  const sp = await searchParams;
  const tipo = sp.tipo ?? "mes";
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(sp.ref ?? "") ? sp.ref! : diaLocal(new Date());
  const p = periodo(tipo, ref, sp.desde, sp.hasta);
  const r = await reporte(p);
  return (
    <>
      <EncabezadoPanel titulo="Ventas, gastos y reportes" />
      <PestanasPanel pestanas={PESTANAS_FINANZAS} activa="/panel/reportes" />
      <div className="space-y-5 p-5 lg:p-8">
        <form className="tarjeta flex flex-wrap items-end gap-3 p-4">
          <label>
            <span className="etiqueta-campo">Período</span>
            <select name="tipo" defaultValue={tipo} className="campo">
              <option value="dia">Día</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
              <option value="anio">Año</option>
              <option value="intervalo">Intervalo</option>
            </select>
          </label>
          <label>
            <span className="etiqueta-campo">Fecha de referencia</span>
            <input type="date" name="ref" defaultValue={ref} className="campo" />
          </label>
          <label>
            <span className="etiqueta-campo">Desde (intervalo)</span>
            <input type="date" name="desde" defaultValue={sp.desde} className="campo" />
          </label>
          <label>
            <span className="etiqueta-campo">Hasta (intervalo)</span>
            <input type="date" name="hasta" defaultValue={sp.hasta} className="campo" />
          </label>
          <button className="btn-primario">Ver reporte</button>
          <p className="w-full text-sm text-gris-600">
            Del {p.desde} al {p.hasta}. Reporte administrativo; no constituye facturación fiscal.
          </p>
        </form>

        <div className="grid gap-5 xl:grid-cols-3">
          <section className="tarjeta p-4 text-sm">
            <h2 className="mb-2 font-bold">Resultado estimado del período</h2>
            <Fila t="Servicios realizados" v={r.servicios} />
            <Fila t="Cursos impartidos" v={r.cursos} />
            <Fila t="Productos: ventas en el local" v={r.ventas_local} />
            <Fila t="Productos: pedidos entregados" v={r.ventas_pedidos} />
            <Fila t="Anticipos retenidos (cancelación o inasistencia)" v={r.anticipos_retenidos} />
            <Fila t="Ingresos" v={r.ingresos} fuerte />
            <Fila t="Costo de productos vendidos" v={r.costo_productos} negativo />
            <Fila t="Costos de servicios y cursos" v={r.costo_servicios} negativo />
            <Fila t="Gastos operativos" v={r.gastos_operativos} negativo />
            <Fila t="Costos y gastos" v={r.costos} fuerte negativo />
            <div className={`mt-2 flex justify-between rounded-xl px-3 py-2 text-base font-bold ${r.resultado >= 0 ? "bg-ok-100 text-ok-700" : "bg-error-100 text-error-700"}`}>
              <span>Resultado estimado</span>
              <span>{moneda(r.resultado)}</span>
            </div>
          </section>
          <section className="tarjeta p-4 text-sm">
            <h2 className="mb-2 font-bold">Cobros recibidos (por fecha de pago)</h2>
            <Fila t="Anticipos de servicios y cursos" v={r.cobros_anticipos} />
            <Fila t="Saldos cobrados" v={r.cobros_saldos} />
            <Fila t="Pagos de pedidos" v={r.cobros_pedidos} />
            <Fila t="Ventas en el local" v={r.cobros_local} />
            <Fila t="Total cobrado" v={r.cobros_anticipos + r.cobros_saldos + r.cobros_pedidos + r.cobros_local} fuerte />
            <h3 className="mt-4 mb-1 font-semibold">Separado de las operaciones terminadas (a hoy)</h3>
            <Fila t="Anticipos de actividades pendientes" v={r.anticipos_pendientes} />
            <Fila t="Pagos de pedidos sin entregar" v={r.pedidos_por_entregar} />
          </section>
          <section className="tarjeta p-4 text-sm">
            <h2 className="mb-2 font-bold">Más vendidos</h2>
            {r.masVendidos.length === 0 ? (
              <Vacio>Sin ventas en el período.</Vacio>
            ) : (
              r.masVendidos.map((m) => (
                <div key={m.nombre} className="flex justify-between py-1">
                  <span>{m.nombre}</span>
                  <span>
                    {m.unidades} u. · {moneda(m.total)}
                  </span>
                </div>
              ))
            )}
            <h2 className="mt-4 mb-2 font-bold">Servicios y cursos más solicitados</h2>
            {r.masSolicitados.length === 0 ? (
              <Vacio>Sin solicitudes en el período.</Vacio>
            ) : (
              r.masSolicitados.map((m) => (
                <div key={m.nombre} className="flex justify-between py-1">
                  <span>
                    {m.nombre} <span className="text-xs text-gris-600">({m.tipo})</span>
                  </span>
                  <span>
                    {m.solicitudes} solicitadas · {m.confirmadas} confirmadas
                  </span>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </>
  );
}
