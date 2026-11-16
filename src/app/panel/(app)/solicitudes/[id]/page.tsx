import Link from "next/link";
import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { detalleSolicitud } from "@/modulos/solicitudes";
import { eventosDeMensaje, mensajesDeSolicitud, vistaPreviaConfirmacion, vistaPreviaCotizacion } from "@/modulos/whatsapp/servicio";
import { sesionesAbiertas } from "@/modulos/catalogo";
import { datosCalendario } from "@/modulos/agenda";
import { SelectorCalendario } from "@/componentes/SelectorCalendario";
import { saldoPendiente } from "@/modulos/pagos";
import { SOL } from "@/modulos/estados";
import { aLocal, fechaHora, hora, minimoLocal, moneda } from "@/lib/tiempo";
import { enlaceWhatsApp, mostrarWhatsApp } from "@/lib/telefono";
import { Formulario } from "@/componentes/Formulario";
import { AutoRefrescar } from "@/componentes/AutoRefrescar";
import { Aviso, Dato, EncabezadoPanel, Etiqueta, Vacio, Volver } from "@/componentes/ui";
import {
  accionAtencion, accionAvisoManual, accionCargarComprobante, accionCotizar, accionEnviarCotizacion, accionEnvioManual, accionExpirar,
  accionRechazarCancelar, accionRechazarComprobante, accionRechazarReprogramacion, accionReenviarAviso, accionReprogramar, accionSaldo, accionValidarComprobante,
} from "../../../acciones";

export const dynamic = "force-dynamic";

function Seccion({ titulo, codigo, children, tono }: { titulo: string; codigo?: string; children: React.ReactNode; tono?: "warn" | "err" }) {
  return (
    <section className={`tarjeta p-5 ${tono === "warn" ? "border-aviso-700/40 bg-aviso-100/30" : tono === "err" ? "border-error-700/40" : ""}`}>
      <h2 className="flex items-center justify-between gap-2 font-bold">
        {titulo}
        {codigo && <span className="text-xs font-normal text-gris-600">{codigo}</span>}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// A04 Detalle de solicitud, con A05 Cotizar, A06 Enviar, A07 Mensajes, A08 Comprobante, A09 Plazo vencido, A10 Rechazar o cancelar,
// A12 Reprogramar y A13 Atención y saldo, según el estado (diagrama de estados E1).
export default async function DetalleSolicitud({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await detalleSolicitud(id);
  if (!s) notFound();
  const [mensajes, previa, previaAviso, saldo, sesiones, bitacora, casillas] = await Promise.all([
    mensajesDeSolicitud(id),
    vistaPreviaCotizacion(id),
    s.estado === SOL.CONFIRMADA ? vistaPreviaConfirmacion(id) : Promise.resolve(null),
    saldoPendiente(id),
    s.modalidad === "grupal" && s.estado === SOL.CONFIRMADA ? sesionesAbiertas(s.curso_id ?? undefined) : Promise.resolve([]),
    q<{ accion: string; detalle: string | null; marca_tiempo: Date; usuario: string | null }>(
      "SELECT a.accion, a.detalle, a.marca_tiempo, u.usuario FROM auditoria a LEFT JOIN usuario_admin u ON u.id = a.usuario_id WHERE a.entidad = 'solicitud_actividad' AND a.entidad_id = $1 ORDER BY a.marca_tiempo",
      [id],
    ),
    s.estado === SOL.CONFIRMADA && s.modalidad !== "grupal" ? datosCalendario(true) : Promise.resolve([]),
  ]);
  const eventos = Object.fromEntries(await Promise.all(mensajes.map(async (m) => [m.id, await eventosDeMensaje(m.id)] as const)));
  const ultimaCot = mensajes.filter((m) => m.tipo === "Cotización").at(-1);
  const avisos = mensajes.filter((m) => m.tipo === "Aviso de confirmación");
  const avisoOk = avisos.some((m) => m.estado !== "Fallido");
  const yaEmpezo = s.inicio ? new Date(s.inicio) <= new Date() : false;
  const pendientesComp = s.comprobantes.filter((c) => c.estado === "Pendiente");
  const esperandoPago = s.estado === SOL.PENDIENTE_PAGO || s.estado === SOL.PLAZO_VENCIDO;

  return (
    <>
      {s.estado === SOL.COTIZACION_ENVIO && <AutoRefrescar />}
      <EncabezadoPanel titulo={`Solicitud #${s.id}`}>
        <Etiqueta texto={s.estado} />
      </EncabezadoPanel>
      <div className="grid gap-5 p-5 lg:p-8 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Volver href="/panel/solicitudes">Centro de solicitudes</Volver>

          <Seccion titulo="Datos de la solicitud" codigo="A04 · CU-11">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Dato etiqueta="Clienta">
                {s.clienta}
                <a href={`https://wa.me/${s.whatsapp.replace("+", "")}`} target="_blank" className="block text-sm font-semibold text-oro-700">
                  {mostrarWhatsApp(s.whatsapp)} ↗
                </a>
              </Dato>
              <Dato etiqueta="Actividad">
                {s.actividad}
                <span className="block text-sm text-gris-600">{s.tipo === "curso" ? `Curso ${s.modalidad}` : "Servicio de belleza"}</span>
              </Dato>
              <Dato etiqueta="Fecha y hora">
                <span >{fechaHora(s.inicio)}</span>
              </Dato>
              <Dato etiqueta="Lugar">
                {s.tipo === "curso" ? "Salón" : s.fuera_local ? `A domicilio: ${s.direccion}${s.referencia ? ` (${s.referencia})` : ""}` : "En el salón"}
              </Dato>
              <Dato etiqueta="Mensajes por WhatsApp">
                {s.acepta_whatsapp ? `Aceptó el ${fechaHora(s.acepta_whatsapp_en)}` : "No aceptó: usar envío manual"}
              </Dato>
              <Dato etiqueta="Origen">{s.registro_directo ? "Registro directo de Andrea" : `Web · ${fechaHora(s.creado_en)}`}</Dato>
              {s.descripcion && (
                <div className="sm:col-span-2">
                  <Dato etiqueta="Descripción">{s.descripcion}</Dato>
                </div>
              )}
              {s.motivo_cierre && (
                <div className="sm:col-span-2">
                  <Dato etiqueta="Motivo de cierre">
                    {s.motivo_cierre}
                    {s.origen_cancelacion && ` · originó: ${s.origen_cancelacion}`}
                  </Dato>
                </div>
              )}
            </dl>
            {s.fotos.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {s.fotos.map((f) => (
                  <a key={f.id} href={`/api/archivos/${f.archivo_url}`} target="_blank">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/archivos/${f.archivo_url}`} alt="Foto de referencia" className="h-24 w-24 rounded-xl border border-linea-200 object-cover" />
                  </a>
                ))}
              </div>
            )}
          </Seccion>

          {/* A05 Cotizar */}
          <Seccion titulo="Cotización" codigo="A05 · CU-12 · RF-10">
            {s.cotizacion_id ? (
              <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Dato etiqueta="Total">{moneda(s.precio_total)}</Dato>
                <Dato etiqueta="Anticipo 10 %">{moneda(s.anticipo)}</Dato>
                <Dato etiqueta="Saldo">{moneda(s.saldo)}</Dato>
                <Dato etiqueta="Intervalo">
                  {s.duracion_min} min{s.traslado_min ? ` + ${s.traslado_min} traslado` : ""}
                </Dato>
              </dl>
            ) : (
              <p className="mb-3 text-sm text-gris-600">Sin cotización todavía.</p>
            )}
            {s.estado === SOL.PENDIENTE_REVISION && (
              <Formulario accion={accionCotizar} boton={s.cotizacion_id ? "Actualizar cotización" : "Guardar cotización"} className="grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="solicitud_id" value={s.id} />
                <label>
                  <span className="etiqueta-campo">Precio total (C$)</span>
                  <input name="precio_total" required inputMode="decimal" defaultValue={s.precio_total ?? ""} className="campo" />
                </label>
                {s.tipo === "servicio" ? (
                  <>
                    <label>
                      <span className="etiqueta-campo">Duración (min)</span>
                      <input name="duracion_min" type="number" required min={15} max={720} step={5} defaultValue={s.duracion_min ?? 90} className="campo" />
                    </label>
                    {s.fuera_local && (
                      <label>
                        <span className="etiqueta-campo">Traslado (min)</span>
                        <input name="traslado_min" type="number" required min={0} max={240} step={5} defaultValue={s.traslado_min ?? 30} className="campo" />
                      </label>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gris-600 sm:col-span-2">Sesión de 3 horas (RN-10.7).</p>
                )}
                <p className="ayuda sm:col-span-3">El sistema calcula el anticipo del 10 % y el saldo. Guardar no aparta el horario ni inicia el plazo.</p>
              </Formulario>
            )}
          </Seccion>

          {/* A06 Enviar cotización */}
          {(s.estado === SOL.PENDIENTE_REVISION || s.estado === SOL.COTIZACION_ENVIO) && previa && (
            <Seccion titulo="Enviar cotización por WhatsApp" codigo="A06 · CU-14, CU-15 · RF-11">
              {ultimaCot?.estado === "Fallido" && s.estado === SOL.PENDIENTE_REVISION && (
                <div className="mb-3">
                  <Aviso tono="err">
                    El último envío falló ({ultimaCot.detalle_error}). El horario se liberó. Puedes reintentar o enviar el mensaje tú misma.
                  </Aviso>
                </div>
              )}
              <p className="text-xs font-semibold uppercase tracking-wide text-gris-600">Mensaje (plantilla {previa.nombre})</p>
              <p className="mt-1 rounded-xl bg-[#e7f6e7] p-3 text-sm leading-relaxed">{previa.texto}</p>
              {s.estado === SOL.COTIZACION_ENVIO ? (
                <div className="mt-3">
                  <Aviso tono="warn">
                    Cotización en envío: el horario está apartado de forma provisional. El plazo de 24 horas empezará cuando WhatsApp informe que el mensaje fue
                    enviado. Si no llega el aviso en 15 minutos, el envío se marcará como fallido.
                  </Aviso>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold">Con la API de WhatsApp</p>
                    {s.acepta_whatsapp ? (
                      <Formulario accion={accionEnviarCotizacion} boton="Enviar cotización" claseBoton="btn-oro" className="mt-2 space-y-2">
                        <input type="hidden" name="solicitud_id" value={s.id} />
                        <p className="ayuda">Comprueba la disponibilidad y aparta el horario en la misma operación.</p>
                      </Formulario>
                    ) : (
                      <p className="mt-2 text-sm text-gris-600">La clienta no aceptó mensajes por la API.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Envío manual</p>
                    <a href={enlaceWhatsApp(s.whatsapp, previa.texto)} target="_blank" className="btn-borde mt-2">
                      Abrir WhatsApp con el mensaje
                    </a>
                    <Formulario accion={accionEnvioManual} boton="Registrar envío manual" claseBoton="btn-borde" className="mt-3 space-y-2">
                      <input type="hidden" name="solicitud_id" value={s.id} />
                      <label className="block">
                        <span className="etiqueta-campo">¿Cuándo lo enviaste?</span>
                        <input type="datetime-local" name="enviado_en" required defaultValue={aLocal(new Date())} max={aLocal(new Date(Date.now() + 60_000))} className="campo" />
                      </label>
                    </Formulario>
                  </div>
                </div>
              )}
            </Seccion>
          )}

          {/* A08 / A09 Comprobante, confirmación y plazo vencido */}
          {esperandoPago && (
            <Seccion titulo={s.estado === SOL.PLAZO_VENCIDO ? "Plazo vencido: revisar el pago" : "Anticipo y confirmación"} codigo="A08, A09 · CU-18, CU-19, CU-22" tono={s.estado === SOL.PLAZO_VENCIDO ? "warn" : undefined}>
              <p className="text-sm">
                Plazo de pago: <strong>{fechaHora(s.plazo_pago_hasta)}</strong> · Anticipo esperado: <strong>{moneda(s.anticipo)}</strong>.
                {s.estado === SOL.PLAZO_VENCIDO && " La reserva sigue bloqueada hasta que confirmes un pago hecho a tiempo o declares la expiración."}
              </p>
              {pendientesComp.length > 0 && (
                <div className="mt-4 space-y-3">
                  {pendientesComp.map((c) => (
                    <div key={c.id} className="rounded-xl border border-linea-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          Comprobante #{c.id} · <strong>{moneda(c.monto)}</strong> · pagado {fechaHora(c.pagado_en)}
                          {s.plazo_pago_hasta && new Date(c.pagado_en) > new Date(s.plazo_pago_hasta) && <span className="ml-2 font-semibold text-error-700">(fuera de plazo)</span>}
                        </span>
                        <a href={`/api/archivos/${c.archivo_url}`} target="_blank" className="font-semibold text-oro-700">
                          Ver archivo ↗
                        </a>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Formulario accion={accionValidarComprobante} boton="Validar anticipo y confirmar" claseBoton="btn-oro" confirmar="¿Comprobaste que el dinero ingresó a la cuenta?" >
                          <input type="hidden" name="comprobante_id" value={c.id} />
                        </Formulario>
                        <Formulario accion={accionRechazarComprobante} boton="Rechazar comprobante" claseBoton="btn-peligro" >
                          <input type="hidden" name="comprobante_id" value={c.id} />
                        </Formulario>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <details className="mt-4" open={pendientesComp.length === 0}>
                <summary className="cursor-pointer text-sm font-semibold text-oro-700">Cargar comprobante recibido por WhatsApp</summary>
                <Formulario accion={accionCargarComprobante} boton="Cargar comprobante" claseBoton="btn-borde" className="mt-3 grid gap-3 sm:grid-cols-3" reiniciar>
                  <input type="hidden" name="solicitud_id" value={s.id} />
                  <label className="sm:col-span-3">
                    <span className="etiqueta-campo">Archivo (imagen o PDF)</span>
                    <input type="file" name="archivo" required accept="image/*,application/pdf" className="campo" />
                  </label>
                  <label>
                    <span className="etiqueta-campo">Monto (C$)</span>
                    <input name="monto" required inputMode="decimal" defaultValue={s.anticipo ?? ""} className="campo" />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="etiqueta-campo">Fecha y hora del pago</span>
                    <input type="datetime-local" name="pagado_en" required max={aLocal(new Date(Date.now() + 60_000))} className="campo" />
                  </label>
                </Formulario>
              </details>
              {s.estado === SOL.PLAZO_VENCIDO && (
                <Formulario accion={accionExpirar} boton="Declarar expiración y liberar" claseBoton="btn-peligro" confirmar="Se liberará el horario o cupo. ¿Continuar?" className="mt-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="solicitud_id" value={s.id} />
                  <label className="min-w-60 flex-1">
                    <span className="etiqueta-campo">Resultado de la revisión</span>
                    <input name="motivo" defaultValue="Sin pago dentro del plazo" className="campo" />
                  </label>
                </Formulario>
              )}
            </Seccion>
          )}

          {/* Confirmada: aviso (RF-34), reprogramación (A12) y atención (A13) */}
          {s.estado === SOL.CONFIRMADA && (
            <>
              <Seccion titulo="Aviso de confirmación" codigo="CU-20 · RF-34">
                {avisoOk ? (
                  <p className="text-sm">El aviso se envió o está en cola (ver mensajes).</p>
                ) : (
                  <>
                    <Aviso tono={avisos.length ? "err" : "info"}>
                      {avisos.length ? "El aviso falló. La cita sigue confirmada." : s.acepta_whatsapp ? "Aún no se ha enviado el aviso." : "La clienta no aceptó mensajes por la API: avísale tú misma."}
                    </Aviso>
                    {previaAviso && <p className="mt-3 rounded-xl bg-[#e7f6e7] p-3 text-sm">{previaAviso.texto}</p>}
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      {s.acepta_whatsapp && (
                        <Formulario accion={accionReenviarAviso} boton="Enviar aviso por la API" claseBoton="btn-oro" >
                          <input type="hidden" name="solicitud_id" value={s.id} />
                        </Formulario>
                      )}
                      {previaAviso && (
                        <a href={enlaceWhatsApp(s.whatsapp, previaAviso.texto)} target="_blank" className="btn-borde">
                          Abrir WhatsApp
                        </a>
                      )}
                      <Formulario accion={accionAvisoManual} boton="Registrar aviso manual" claseBoton="btn-borde" className="flex items-end gap-2">
                        <input type="hidden" name="solicitud_id" value={s.id} />
                        <input type="hidden" name="enviado_en" value={aLocal(new Date())} />
                      </Formulario>
                    </div>
                  </>
                )}
              </Seccion>

              {!yaEmpezo && (
                <Seccion titulo="Reprogramar" codigo="A12 · CU-28 · RF-32">
                  <Formulario accion={accionReprogramar} boton="Aceptar cambio de fecha" claseBoton="btn-borde" className="grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="solicitud_id" value={s.id} />
                    {s.modalidad === "grupal" ? (
                      <label>
                        <span className="etiqueta-campo">Nueva sesión</span>
                        <select name="sesion_id" required className="campo">
                          {sesiones.filter((x) => x.id !== s.sesion_id && x.libres > 0).map((x) => (
                            <option key={x.id} value={x.id}>
                              {fechaHora(x.inicio)} · {x.libres} cupo(s)
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="sm:col-span-2">
                        <span className="etiqueta-campo">Nueva fecha y hora</span>
                        <SelectorCalendario casillas={casillas} minimo={minimoLocal()} duracionMin={s.duracion_min ?? 30} detalle />
                      </div>
                    )}
                    <label>
                      <span className="etiqueta-campo">Motivo</span>
                      <input name="motivo" className="campo" placeholder="Ej.: la clienta pidió otra fecha" />
                    </label>
                    <p className="ayuda sm:col-span-2">Se asegura el nuevo horario antes de liberar el anterior y se conserva el anticipo.</p>
                  </Formulario>
                  {s.modalidad !== "grupal" && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-gris-600">Registrar que no se aceptó un cambio pedido</summary>
                      <Formulario accion={accionRechazarReprogramacion} boton="Registrar rechazo" claseBoton="btn-borde" className="mt-2 grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="solicitud_id" value={s.id} />
                        <label>
                          <span className="etiqueta-campo">Fecha que pidió</span>
                          <input type="datetime-local" name="inicio" required className="campo" />
                        </label>
                        <label>
                          <span className="etiqueta-campo">Motivo</span>
                          <input name="motivo" className="campo" />
                        </label>
                      </Formulario>
                    </details>
                  )}
                </Seccion>
              )}

              <Seccion titulo="Atención" codigo="A13 · CU-27 · RF-31">
                {yaEmpezo ? (
                  <div className="flex flex-wrap gap-2">
                    <Formulario accion={accionAtencion} boton="Registrar atención realizada" claseBoton="btn-oro" >
                      <input type="hidden" name="solicitud_id" value={s.id} />
                      <input type="hidden" name="resultado" value="Realizada" />
                    </Formulario>
                    <Formulario accion={accionAtencion} boton="Registrar inasistencia" claseBoton="btn-peligro" confirmar="El anticipo quedará retenido. ¿Continuar?" >
                      <input type="hidden" name="solicitud_id" value={s.id} />
                      <input type="hidden" name="resultado" value="No asistida" />
                    </Formulario>
                  </div>
                ) : (
                  <p className="text-sm text-gris-600">Podrás registrar la atención a partir de las {hora(s.inicio)} del día de la actividad (RN-31.2).</p>
                )}
              </Seccion>
            </>
          )}

          {s.estado === SOL.REALIZADA && saldo && (
            <Seccion titulo="Cobro del saldo" codigo="A13 · CU-27 · RN-31.3, RN-31.4">
              <p className="text-sm">
                Total {moneda(saldo.precio)} · pagado {moneda(saldo.pagado)} · <strong>saldo {moneda(saldo.saldo)}</strong>
              </p>
              <Formulario accion={accionSaldo} boton="Registrar pago del saldo" claseBoton="btn-oro" className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="solicitud_id" value={s.id} />
                <label>
                  <span className="etiqueta-campo">Monto recibido (C$)</span>
                  <input name="monto" required inputMode="decimal" defaultValue={saldo.saldo} className="campo" />
                </label>
              </Formulario>
            </Seccion>
          )}

          {/* A10 Rechazar o cancelar */}
          {[SOL.PENDIENTE_REVISION, SOL.PENDIENTE_PAGO, SOL.PLAZO_VENCIDO, SOL.CONFIRMADA].includes(s.estado as never) && (
            <Seccion titulo={s.estado === SOL.PENDIENTE_REVISION ? "Rechazar solicitud" : "Cancelar"} codigo="A10 · CU-23 · RF-16">
              <Formulario
                accion={accionRechazarCancelar}
                boton={s.estado === SOL.PENDIENTE_REVISION ? "Rechazar" : "Cancelar solicitud"}
                claseBoton="btn-peligro"
                confirmar="Esta acción no se puede deshacer. ¿Continuar?"
                className="grid gap-3 sm:grid-cols-[2fr_1fr]"
              >
                <input type="hidden" name="solicitud_id" value={s.id} />
                <label>
                  <span className="etiqueta-campo">Motivo</span>
                  <input name="motivo" required minLength={3} className="campo" placeholder={s.estado === SOL.PENDIENTE_REVISION ? "Ej.: no hay disponibilidad ese día" : "Ej.: la clienta no puede asistir"} />
                </label>
                {s.estado !== SOL.PENDIENTE_REVISION && (
                  <label>
                    <span className="etiqueta-campo">¿Quién cancela?</span>
                    <select name="origen" className="campo">
                      <option value="clienta">La clienta (no se devuelve el anticipo)</option>
                      <option value="andrea">Andrea</option>
                    </select>
                  </label>
                )}
              </Formulario>
            </Seccion>
          )}
        </div>

        {/* Columna derecha: mensajes, agenda, pagos y bitácora */}
        <div className="space-y-5">
          <Seccion titulo="Mensajes de WhatsApp" codigo="A07 · CU-17 · RF-33">
            {mensajes.length === 0 ? (
              <Vacio>Sin mensajes.</Vacio>
            ) : (
              <ul className="space-y-3 text-sm">
                {mensajes.map((m) => (
                  <li key={m.id} className="rounded-xl border border-linea-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {m.tipo} · {m.origen === "manual" ? "manual" : "API"}
                      </span>
                      <Etiqueta texto={m.estado} />
                    </div>
                    <p className="mt-1 text-xs text-gris-600">
                      Creado {fechaHora(m.creado_en)} · Enviado {fechaHora(m.enviado_en)}
                    </p>
                    {m.id_externo && <p className="truncate text-xs text-gris-600">ID WhatsApp: {m.id_externo}</p>}
                    {m.detalle_error && (
                      <p className="mt-1 text-xs text-error-700">
                        Error {m.codigo_error}: {m.detalle_error}
                      </p>
                    )}
                    {eventos[m.id]?.length > 0 && (
                      <p className="mt-1 text-xs text-gris-600">Avisos: {eventos[m.id].map((e) => `${e.estado} ${hora(e.ocurrido_en)}`).join(" · ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion titulo="Agenda y pagos">
            <ul className="space-y-1 text-sm">
              {s.agenda.length === 0 && <li className="text-gris-600">Sin intervalos apartados.</li>}
              {s.agenda.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span >
                    {fechaHora(a.inicio)} – {hora(a.fin)}
                  </span>
                  <Etiqueta texto={a.estado} />
                </li>
              ))}
            </ul>
            {s.pagos.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-linea-200 pt-3 text-sm">
                {s.pagos.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>
                      {p.tipo} · {fechaHora(p.registrado_en)}
                    </span>
                    <strong>{moneda(p.monto)}</strong>
                  </li>
                ))}
              </ul>
            )}
            {s.comprobantes.filter((c) => c.estado !== "Pendiente").length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-linea-200 pt-3 text-xs text-gris-600">
                {s.comprobantes
                  .filter((c) => c.estado !== "Pendiente")
                  .map((c) => (
                    <li key={c.id}>
                      Comprobante #{c.id} {c.estado.toLowerCase()} · {moneda(c.monto)} ·{" "}
                      <a href={`/api/archivos/${c.archivo_url}`} target="_blank" className="text-oro-700">
                        ver
                      </a>
                    </li>
                  ))}
              </ul>
            )}
            {s.reprogramaciones.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-linea-200 pt-3 text-xs">
                {s.reprogramaciones.map((r) => (
                  <li key={r.id}>
                    Reprogramación {r.estado.toLowerCase()}: {fechaHora(r.inicio_original)} → {fechaHora(r.inicio_nuevo)}
                    {r.motivo && ` (${r.motivo})`}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion titulo="Bitácora" codigo="RNF-08">
            <ol className="space-y-1.5 text-xs">
              {bitacora.map((b, i) => (
                <li key={i}>
                  <span className="text-gris-600">{fechaHora(b.marca_tiempo)}</span> · {b.accion}
                  {b.usuario ? ` (${b.usuario})` : " (sistema)"}
                </li>
              ))}
            </ol>
          </Seccion>
          <Link href="/panel/agenda" className="btn-borde w-full">
            Ver en la agenda
          </Link>
        </div>
      </div>
    </>
  );
}
