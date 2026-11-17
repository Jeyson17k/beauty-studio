import { productos, ventasRecientes } from "@/modulos/inventario";
import { fechaHora, moneda } from "@/lib/tiempo";
import { Formulario } from "@/componentes/Formulario";
import { EncabezadoPanel, Etiqueta, Vacio } from "@/componentes/ui";
import { PestanasPanel, PESTANAS_FINANZAS } from "@/componentes/PestanasPanel";
import { accionVentaDirecta } from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ventas" };

// A20 Venta directa (CU-33, RF-27): descuenta existencias una sola vez y no usa unidades reservadas (RN-27.3, RN-27.6).
export default async function Ventas() {
  const [lista, ventas] = await Promise.all([productos(), ventasRecientes()]);
  const disponibles = lista.filter((p) => p.activo && p.disponible > 0);
  return (
    <>
      <EncabezadoPanel titulo="Ventas, gastos y reportes" />
      <PestanasPanel pestanas={PESTANAS_FINANZAS} activa="/panel/ventas" />
      <div className="grid gap-5 p-5 lg:p-8 xl:grid-cols-[1fr_1fr]">
        <section className="tarjeta p-4">
          <h2 className="font-bold">Registrar venta directa en el local</h2>
          {disponibles.length === 0 ? (
            <Vacio>No hay productos con unidades disponibles.</Vacio>
          ) : (
            <Formulario accion={accionVentaDirecta} boton="Registrar venta" className="mt-3 space-y-2" reiniciar>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_6rem] gap-2">
                  <select name="producto_id" className="campo" defaultValue="">
                    <option value="">{i === 0 ? "Elige un producto" : "(otro producto, opcional)"}</option>
                    {disponibles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} · {moneda(p.precio_venta)} · disp. {p.disponible}
                      </option>
                    ))}
                  </select>
                  <input name="cantidad" type="number" min={0} defaultValue={i === 0 ? 1 : 0} className="campo" aria-label="Cantidad" />
                </div>
              ))}
              <label className="block">
                <span className="etiqueta-campo">Nota (opcional)</span>
                <input name="nota" className="campo" />
              </label>
              <p className="ayuda">Se registra con pago y entrega en el momento; el precio es el de venta vigente.</p>
            </Formulario>
          )}
        </section>
        <section className="tarjeta p-4">
          <h2 className="font-bold">Ventas recientes</h2>
          <ul className="mt-2 divide-y divide-linea-200 text-sm">
            {ventas.length === 0 && <Vacio>Sin ventas.</Vacio>}
            {ventas.map((v) => (
              <li key={v.id} className="flex justify-between gap-2 py-2">
                <span>
                  #{v.id} · {fechaHora(v.creado_en)}
                  <span className="block text-xs text-gris-600">{v.productos}</span>
                </span>
                <span className="text-right">
                  <strong>{moneda(v.total)}</strong>
                  <span className="mt-1 block">
                    <Etiqueta texto={v.origen === "web" ? `Pedido #${v.pedido_id}` : "Local"} tono={v.origen === "web" ? "info" : "n"} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
