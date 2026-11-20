import { categoriasGasto, gastos } from "@/modulos/inventario";
import { diaLocal, moneda } from "@/lib/tiempo";
import { Formulario } from "@/componentes/Formulario";
import { EncabezadoPanel, Vacio } from "@/componentes/ui";
import { PestanasPanel, PESTANAS_FINANZAS } from "@/componentes/PestanasPanel";
import { accionEliminarGasto, accionGasto } from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gastos" };

// A21 Gastos (CU-34, RF-28). La categoría «Costo de servicios y cursos» se separa de los gastos operativos (RN-28.5).
export default async function Gastos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : diaLocal(new Date()).slice(0, 7);
  const [a, m] = mes.split("-").map(Number);
  const fin = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const [cats, lista] = await Promise.all([categoriasGasto(), gastos(`${mes}-01`, fin)]);
  const total = lista.reduce((s, g) => s + Number(g.monto), 0);
  return (
    <>
      <EncabezadoPanel titulo="Ventas, gastos y reportes" />
      <PestanasPanel pestanas={PESTANAS_FINANZAS} activa="/panel/gastos" />
      <div className="grid gap-5 p-5 lg:p-8 xl:grid-cols-[1fr_1.3fr]">
        <section className="tarjeta p-4">
          <h2 className="font-bold">Registrar costo o gasto</h2>
          <Formulario accion={accionGasto} boton="Registrar" className="mt-3 grid gap-3 sm:grid-cols-2" reiniciar>
            <label className="sm:col-span-2">
              <span className="etiqueta-campo">Concepto</span>
              <input name="concepto" required minLength={3} maxLength={120} pattern=".*\p{L}.*" title="Debe llevar palabras, no solo números o símbolos." className="campo" placeholder="Ej.: pestañas postizas para novias" />
            </label>
            <label>
              <span className="etiqueta-campo">Categoría</span>
              <select name="categoria_id" className="campo">
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="etiqueta-campo">Monto (C$)</span>
              <input name="monto" required inputMode="decimal" maxLength={12} pattern=" *[0-9][0-9,]*(\.[0-9]{1,2})? *" title="Escribe solo números, con hasta dos decimales (por ejemplo 1300 o 1300.50)." className="campo" />
            </label>
            <label>
              <span className="etiqueta-campo">Fecha</span>
              <input name="fecha" type="date" required defaultValue={diaLocal(new Date())} className="campo" />
            </label>
            <label>
              <span className="etiqueta-campo">Observación</span>
              <input name="observacion" className="campo" />
            </label>
            <p className="ayuda sm:col-span-2">Las compras de productos se registran como entradas de inventario, no aquí (RN-28.6).</p>
          </Formulario>
        </section>
        <section className="tarjeta p-4">
          <form className="flex items-end justify-between gap-3">
            <h2 className="font-bold">Gastos de {mes}</h2>
            <span className="flex items-end gap-2">
              <input type="month" name="mes" defaultValue={mes} className="campo" />
              <button className="btn-borde">Ver</button>
            </span>
          </form>
          <ul className="mt-3 divide-y divide-linea-200 text-sm">
            {lista.length === 0 && <Vacio>Sin gastos en este mes.</Vacio>}
            {lista.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {g.concepto}
                  <span className="block text-xs text-gris-600">
                    {g.fecha} · {g.categoria}
                    {g.observacion ? ` · ${g.observacion}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <strong>{moneda(g.monto)}</strong>
                  <Formulario accion={accionEliminarGasto} boton="Eliminar" claseBoton="text-xs text-error-700 hover:underline" confirmar="¿Eliminar este gasto?">
                    <input type="hidden" name="gasto_id" value={g.id} />
                  </Formulario>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-right font-bold">Total {moneda(total)}</p>
        </section>
      </div>
    </>
  );
}
