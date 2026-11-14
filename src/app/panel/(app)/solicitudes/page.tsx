import Link from "next/link";
import { listarSolicitudes } from "@/modulos/solicitudes";
import { SOL } from "@/modulos/estados";
import { fechaHora, moneda } from "@/lib/tiempo";
import { mostrarWhatsApp } from "@/lib/telefono";
import { EncabezadoPanel, Etiqueta, Vacio } from "@/componentes/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitudes" };

// A03 Centro de solicitudes (CU-11, RF-09): diferencia servicios y cursos y destaca plazos vencidos y envíos fallidos.
export default async function Solicitudes({ searchParams }: { searchParams: Promise<{ estado?: string; tipo?: string; q?: string }> }) {
  const sp = await searchParams;
  const filas = await listarSolicitudes({ estado: sp.estado, tipo: sp.tipo, texto: sp.q });
  return (
    <>
      <EncabezadoPanel titulo="Centro de solicitudes">
        <Link href="/panel/solicitudes/nueva" className="btn-primario">
          + Registro directo
        </Link>
      </EncabezadoPanel>
      <div className="space-y-4 p-5 lg:p-8">
        <form className="tarjeta flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-52 flex-1">
            <span className="etiqueta-campo">Buscar</span>
            <input name="q" defaultValue={sp.q} placeholder="Nombre, WhatsApp o número de solicitud" className="campo" />
          </label>
          <label>
            <span className="etiqueta-campo">Estado</span>
            <select name="estado" defaultValue={sp.estado ?? ""} className="campo">
              <option value="">Todos</option>
              {Object.values(SOL).map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="etiqueta-campo">Tipo</span>
            <select name="tipo" defaultValue={sp.tipo ?? ""} className="campo">
              <option value="">Servicios y cursos</option>
              <option value="servicio">Servicios</option>
              <option value="curso">Cursos</option>
            </select>
          </label>
          <button className="btn-borde">Filtrar</button>
        </form>

        <div className="tarjeta overflow-x-auto">
          {filas.length === 0 ? (
            <div className="p-4">
              <Vacio>No hay solicitudes con esos filtros.</Vacio>
            </div>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Clienta</th>
                  <th>Actividad</th>
                  <th>Fecha solicitada</th>
                  <th>Estado</th>
                  <th>WhatsApp</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className={f.estado === SOL.PLAZO_VENCIDO ? "bg-aviso-100/40" : f.ultimo_mensaje === "Fallido" && f.estado === SOL.PENDIENTE_REVISION ? "bg-error-100/40" : ""}>
                    <td className="font-semibold">{f.id}</td>
                    <td>
                      {f.clienta}
                      <span className="block text-xs text-gris-600">{mostrarWhatsApp(f.whatsapp)}</span>
                    </td>
                    <td>
                      {f.actividad}
                      <span className="block text-xs text-gris-600">
                        {f.tipo === "curso" ? `Curso ${f.modalidad ?? ""}` : f.fuera_local ? "Servicio a domicilio" : "Servicio en el local"}
                        {f.registro_directo && " · registro directo"}
                      </span>
                    </td>
                    <td >{fechaHora(f.inicio)}</td>
                    <td>
                      <Etiqueta texto={f.estado} />
                      {f.estado === SOL.PENDIENTE_PAGO && f.plazo_pago_hasta && <span className="mt-1 block text-xs text-gris-600">vence {fechaHora(f.plazo_pago_hasta)}</span>}
                    </td>
                    <td>{f.ultimo_mensaje ? <Etiqueta texto={f.ultimo_mensaje} /> : <span className="text-xs text-gris-600">—</span>}</td>
                    <td>{moneda(f.precio_total)}</td>
                    <td>
                      <Link href={`/panel/solicitudes/${f.id}`} className="font-semibold text-oro-700">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
