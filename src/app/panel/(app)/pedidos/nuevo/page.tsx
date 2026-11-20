import { Formulario } from "@/componentes/Formulario";
import { CamposLugar } from "@/componentes/CamposPublicos";
import { EncabezadoPanel, Vacio, Volver } from "@/componentes/ui";
import { moneda } from "@/lib/tiempo";
import { productos } from "@/modulos/inventario";
import { accionPedidoPorClienta } from "../../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido por una clienta" };

// Pedido registrado por Andrea a nombre de una clienta (misma regla que la web: no aparta inventario hasta confirmarlo).
export default async function PedidoPorClienta() {
  const lista = (await productos()).filter((p) => p.activo && p.visible_publico && p.disponible > 0);
  return (
    <>
      <EncabezadoPanel titulo="Pedido por una clienta" />
      <div className="max-w-2xl space-y-4 p-5 lg:p-8">
        <Volver href="/panel/registrar">Registrar por una clienta</Volver>
        <div className="tarjeta p-5">
          <p className="mb-4 text-sm text-gris-600">Queda como «Pendiente de confirmación». Luego confirmas, reservas el inventario y mandas el mensaje por WhatsApp como en cualquier pedido.</p>
          {lista.length === 0 ? (
            <Vacio>No hay productos visibles con unidades disponibles.</Vacio>
          ) : (
            <Formulario accion={accionPedidoPorClienta} boton="Registrar pedido">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="etiqueta-campo">Nombre completo de la clienta</span>
                  <input name="nombre" required minLength={3} maxLength={100} autoComplete="name" pattern=" *\p{L}[\p{L}\p{M}'.\-]+( +[\p{L}\p{M}'.\-]+)+ *" title="Escribe nombre y apellido, solo con letras (sin números ni símbolos)." className="campo" />
                </label>
                <label>
                  <span className="etiqueta-campo">WhatsApp</span>
                  <input name="whatsapp" required inputMode="tel" maxLength={20} pattern=" *\+?[0-9 \(\)\-.]{8,20} *" title="Escribe un número de WhatsApp con dígitos, por ejemplo 8888 1234." className="campo" placeholder="8888 8888" />
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-xl bg-crema-100 p-3 text-sm">
                <input type="checkbox" name="acepta" className="mt-1 h-4 w-4 accent-[#7a5c24]" />
                <span>La clienta aceptó recibir mensajes por WhatsApp sobre su pedido.</span>
              </label>
              <fieldset className="space-y-2">
                <legend className="etiqueta-campo">Productos (deja en blanco los que no lleva)</legend>
                {lista.map((p) => (
                  <label key={p.id} className="grid grid-cols-[1fr_5rem] items-center gap-3 rounded-xl border border-linea-200 bg-white px-3 py-2 text-sm">
                    <span>
                      <input type="hidden" name="producto_id" value={p.id} />
                      <span className="font-semibold">{p.nombre}</span>
                      <span className="block text-xs text-gris-600">
                        {moneda(p.precio_venta)} · disponibles {p.disponible}
                      </span>
                    </span>
                    <input name="cantidad" type="number" min={0} max={Math.min(99, p.disponible)} defaultValue={0} inputMode="numeric" className="campo text-center" aria-label={`Cantidad de ${p.nombre}`} />
                  </label>
                ))}
              </fieldset>
              <CamposLugar etiquetas={["Retiro en el local", "Delivery"]} />
            </Formulario>
          )}
        </div>
      </div>
    </>
  );
}
