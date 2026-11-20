import Link from "next/link";
import { q } from "@/lib/db";
import { bandejaSimulada, modoWhatsApp, numeroPrueba } from "@/modulos/whatsapp/cliente";
import { fechaHora } from "@/lib/tiempo";
import { mostrarWhatsApp } from "@/lib/telefono";
import { Aviso, EncabezadoPanel, Etiqueta, Vacio } from "@/componentes/ui";
import { AutoRefrescar } from "@/componentes/AutoRefrescar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mensajes de WhatsApp" };

// A07 Mensajes de WhatsApp (CU-17, RF-33). Los códigos de verificación se muestran sin su valor (RN-33.4).
export default async function Mensajes({ searchParams }: { searchParams: Promise<{ estado?: string; tipo?: string }> }) {
  const sp = await searchParams;
  const filas = await q<{
    id: number; tipo: string; estado: string; origen: string; plantilla: string; solicitud_id: number | null; clienta: string; whatsapp: string;
    creado_en: Date; enviado_en: Date | null; codigo_error: string | null; detalle_error: string | null; eventos: number;
  }>(
    `SELECT m.id, m.tipo, m.estado, m.origen, m.plantilla, m.solicitud_id, c.nombre AS clienta, c.whatsapp, m.creado_en, m.enviado_en, m.codigo_error, m.detalle_error,
            (SELECT count(*)::int FROM evento_mensaje_whatsapp e WHERE e.mensaje_id = m.id) AS eventos
     FROM mensaje_whatsapp m JOIN cliente c ON c.id = m.cliente_id
     WHERE ($1::text IS NULL OR m.estado = $1) AND ($2::text IS NULL OR m.tipo = $2)
     ORDER BY m.creado_en DESC LIMIT 150`,
    [sp.estado || null, sp.tipo || null],
  );
  const simulado = modoWhatsApp() === "simulado";
  const bandeja = simulado ? bandejaSimulada().slice(0, 12) : [];
  return (
    <>
      {filas.some((f) => f.estado === "En cola") && <AutoRefrescar segundos={4} />}
      <EncabezadoPanel titulo="Mensajes de WhatsApp">
        <Link href="/panel/whatsapp-prueba" className="btn-primario px-3 py-1.5 text-xs">
          Ver teléfono de prueba
        </Link>
      </EncabezadoPanel>
      <div className="space-y-5 p-5 lg:p-8">
        {simulado ? (
          <Aviso tono="warn">
            Modo simulado (entorno de prueba): no se conecta con Meta. El aviso «enviado» se simula a los 2 segundos; los números que terminan en 9999 simulan un
            envío fallido. La conexión con la API real y el número de Andrea están pendientes de probar.
          </Aviso>
        ) : (
          <Aviso tono="info">Modo Cloud API: los estados llegan por el webhook /api/whatsapp/webhook.</Aviso>
        )}
        {numeroPrueba() && (
          <Aviso tono="info">
            Número de prueba activo: todos los mensajes se envían a <strong>{mostrarWhatsApp(numeroPrueba()!)}</strong>, no al número de cada clienta.{" "}
            <Link href="/panel/whatsapp-prueba" className="font-semibold underline">
              Abrir el teléfono de prueba
            </Link>
          </Aviso>
        )}
        <form className="tarjeta flex flex-wrap items-end gap-3 p-4">
          <label>
            <span className="etiqueta-campo">Estado</span>
            <select name="estado" defaultValue={sp.estado ?? ""} className="campo">
              <option value="">Todos</option>
              {["En cola", "Enviado", "Entregado", "Leído", "Fallido"].map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="etiqueta-campo">Tipo</span>
            <select name="tipo" defaultValue={sp.tipo ?? ""} className="campo">
              <option value="">Todos</option>
              {["Cotización", "Aviso de confirmación", "Código de verificación", "Confirmación de pedido"].map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
          <button className="btn-borde">Filtrar</button>
        </form>
        <div className="tarjeta overflow-x-auto">
          {filas.length === 0 ? (
            <div className="p-4">
              <Vacio>No hay mensajes.</Vacio>
            </div>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo</th>
                  <th>Clienta</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Enviado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>{f.id}</td>
                    <td>
                      {f.tipo}
                      <span className="block text-xs text-gris-600">
                        {f.origen === "manual" ? "envío manual" : `API · ${f.plantilla}`}
                      </span>
                    </td>
                    <td>
                      {f.clienta}
                      <span className="block text-xs text-gris-600">{mostrarWhatsApp(f.whatsapp)}</span>
                    </td>
                    <td>
                      <Etiqueta texto={f.estado} />
                      <span className="block text-xs text-gris-600">{f.eventos} aviso(s)</span>
                    </td>
                    <td>{fechaHora(f.creado_en)}</td>
                    <td>{fechaHora(f.enviado_en)}</td>
                    <td className="text-xs">
                      {f.detalle_error && <span className="text-error-700">{f.codigo_error}: {f.detalle_error}</span>}
                      {f.solicitud_id && (
                        <Link href={`/panel/solicitudes/${f.solicitud_id}`} className="block font-semibold text-oro-700">
                          Solicitud #{f.solicitud_id}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {simulado && (
          <section className="tarjeta p-4">
            <h2 className="font-bold">Bandeja simulada (lo que habría llegado al teléfono de la clienta)</h2>
            <p className="text-xs text-gris-600">Solo existe en el entorno de prueba. Sirve para probar los mensajes y el código de verificación.</p>
            <ul className="mt-3 space-y-2">
              {bandeja.length === 0 && <Vacio>Vacía.</Vacio>}
              {bandeja.map((b) => (
                <li key={b.idExterno} className="rounded-xl bg-[#e7f6e7] p-3 text-sm">
                  <p className="text-xs text-gris-600">
                    Clienta {mostrarWhatsApp(b.para)} → llegó a {mostrarWhatsApp(b.destino ?? b.para)} · {b.plantilla} · {fechaHora(b.en)}
                  </p>
                  <p className="mt-1">{b.texto}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
