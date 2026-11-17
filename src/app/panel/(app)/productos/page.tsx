import { categoriasProducto, movimientos, productos } from "@/modulos/inventario";
import { fechaHora, moneda } from "@/lib/tiempo";
import { Formulario } from "@/componentes/Formulario";
import { CampoFoto } from "@/componentes/CampoFoto";
import { EncabezadoPanel, Etiqueta, Vacio } from "@/componentes/ui";
import { PestanasPanel, PESTANAS_INVENTARIO } from "@/componentes/PestanasPanel";
import { accionAjuste, accionEntrada, accionGuardarProducto } from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Productos e inventario" };

type P = Awaited<ReturnType<typeof productos>>[number];

function CamposProducto({ p, cats }: { p?: P; cats: { id: number; nombre: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <label className="sm:col-span-2">
        <span className="etiqueta-campo">Nombre</span>
        <input name="nombre" required defaultValue={p?.nombre} className="campo" />
      </label>
      <label>
        <span className="etiqueta-campo">Categoría</span>
        <select name="categoria_id" defaultValue={p?.categoria_id} className="campo">
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-3">
        <span className="etiqueta-campo">Descripción</span>
        <input name="descripcion" maxLength={200} defaultValue={p?.descripcion ?? ""} className="campo" />
      </label>
      <label>
        <span className="etiqueta-campo">Precio de venta (C$)</span>
        <input name="precio_venta" required inputMode="decimal" defaultValue={p?.precio_venta} className="campo" />
      </label>
      <label>
        <span className="etiqueta-campo">Stock mínimo</span>
        <input name="stock_minimo" type="number" min={0} defaultValue={p?.stock_minimo ?? 2} className="campo" />
      </label>
      <CampoFoto actual={p?.foto_url} nombre={p?.nombre} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="visible_publico" defaultChecked={p?.visible_publico ?? true} className="h-4 w-4 accent-[#7a5c24]" /> Visible en el catálogo
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activo" defaultChecked={p?.activo ?? true} className="h-4 w-4 accent-[#7a5c24]" /> Activo
      </label>
    </div>
  );
}

// A19 Productos e inventario (CU-32, RF-26)
export default async function Productos() {
  const [lista, cats, movs] = await Promise.all([productos(), categoriasProducto(), movimientos()]);
  return (
    <>
      <EncabezadoPanel titulo="Pedidos e inventario" />
      <PestanasPanel pestanas={PESTANAS_INVENTARIO} activa="/panel/productos" />
      <div className="space-y-5 p-5 lg:p-8">
        <section className="tarjeta overflow-x-auto p-4">
          {lista.length === 0 ? (
            <Vacio>Todavía no hay productos. Regístralos abajo.</Vacio>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Físico</th>
                  <th>Reservado</th>
                  <th>Disponible</th>
                  <th>Costo prom.</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.nombre}
                      <span className="block text-xs text-gris-600">{p.categoria}</span>
                    </td>
                    <td>{moneda(p.precio_venta)}</td>
                    <td>{p.stock_actual}</td>
                    <td>{p.stock_reservado}</td>
                    <td className="font-semibold">{p.disponible}</td>
                    <td>{moneda(p.costo_promedio)}</td>
                    <td className="space-x-1">
                      {!p.activo ? <Etiqueta texto="Inactivo" tono="n" /> : p.disponible <= 0 ? <Etiqueta texto="Agotado" tono="err" /> : p.disponible <= p.stock_minimo ? <Etiqueta texto="Bajo stock" tono="warn" /> : <Etiqueta texto="OK" tono="ok" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {lista.length > 0 && (
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="tarjeta p-4">
              <h2 className="font-bold">Entrada de inventario</h2>
              <Formulario accion={accionEntrada} boton="Registrar entrada" className="mt-3 grid gap-3 sm:grid-cols-2" reiniciar>
                <label className="sm:col-span-2">
                  <span className="etiqueta-campo">Producto</span>
                  <select name="producto_id" className="campo">
                    {lista.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="etiqueta-campo">Cantidad</span>
                  <input name="cantidad" type="number" min={1} required className="campo" />
                </label>
                <label>
                  <span className="etiqueta-campo">Costo unitario de compra (C$)</span>
                  <input name="costo_unitario" required inputMode="decimal" className="campo" />
                </label>
                <label className="sm:col-span-2">
                  <span className="etiqueta-campo">Proveedor o nota</span>
                  <input name="motivo" className="campo" placeholder="Compra a proveedor" />
                </label>
              </Formulario>
            </section>
            <section className="tarjeta p-4">
              <h2 className="font-bold">Ajuste de inventario</h2>
              <Formulario accion={accionAjuste} boton="Registrar ajuste" claseBoton="btn-borde" className="mt-3 grid gap-3 sm:grid-cols-2" reiniciar>
                <label className="sm:col-span-2">
                  <span className="etiqueta-campo">Producto</span>
                  <select name="producto_id" className="campo">
                    {lista.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} (físico {p.stock_actual}, reservado {p.stock_reservado})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="etiqueta-campo">Tipo</span>
                  <select name="tipo" className="campo">
                    <option>Corrección</option>
                    <option>Daño</option>
                  </select>
                </label>
                <label>
                  <span className="etiqueta-campo">Unidades (+ suma, − resta)</span>
                  <input name="cantidad" type="number" required className="campo" placeholder="-1" />
                </label>
                <label className="sm:col-span-2">
                  <span className="etiqueta-campo">Motivo (obligatorio)</span>
                  <input name="motivo" required minLength={3} className="campo" />
                </label>
              </Formulario>
            </section>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="tarjeta p-4">
            <h2 className="font-bold">Nuevo producto</h2>
            <Formulario accion={accionGuardarProducto} boton="Registrar producto" className="mt-3" reiniciar>
              <CamposProducto cats={cats} />
            </Formulario>
            {lista.map((p) => (
              <details key={p.id} className="mt-3 border-t border-linea-200 pt-3">
                <summary className="cursor-pointer text-sm font-semibold">Editar {p.nombre}</summary>
                <Formulario accion={accionGuardarProducto} boton="Guardar" claseBoton="btn-borde" className="mt-3">
                  <CamposProducto p={p} cats={cats} />
                </Formulario>
              </details>
            ))}
          </section>
          <section className="tarjeta p-4">
            <h2 className="font-bold">Movimientos recientes</h2>
            <ul className="mt-2 max-h-[34rem] space-y-1 overflow-y-auto text-xs">
              {movs.length === 0 && <li className="text-gris-600">Sin movimientos.</li>}
              {movs.map((m) => (
                <li key={m.id} className="flex justify-between gap-2 border-b border-linea-200 py-1">
                  <span>
                    {fechaHora(m.creado_en)} · <strong>{m.tipo}</strong> · {m.producto} ({m.cantidad > 0 ? "+" : ""}
                    {m.cantidad})
                  </span>
                  <span className="text-gris-600">{m.motivo}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
