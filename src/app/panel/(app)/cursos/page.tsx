import { sesionesPanel, todosLosCursos } from "@/modulos/catalogo";
import { Formulario } from "@/componentes/Formulario";
import { EncabezadoPanel, Etiqueta, Vacio } from "@/componentes/ui";
import { fechaHora, hora, minimoLocal } from "@/lib/tiempo";
import { accionGuardarCurso, accionProgramarSesion, accionSesion } from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cursos y sesiones" };

// A16 Cursos y sesiones (CU-26, RF-04): sesiones de 3 horas, capacidad y cupos apartados/confirmados (RN-29.8).
export default async function CursosPanel() {
  const [cursos, sesiones] = await Promise.all([todosLosCursos(), sesionesPanel()]);
  const grupales = cursos.filter((c) => c.modalidad === "grupal" && c.activo);
  return (
    <>
      <EncabezadoPanel titulo="Cursos y sesiones" />
      <div className="space-y-5 p-5 lg:p-8">
        <section className="tarjeta p-4">
          <h2 className="font-bold">Programar sesión grupal</h2>
          {grupales.length === 0 ? (
            <Vacio>Primero registra un curso grupal activo.</Vacio>
          ) : (
            <Formulario accion={accionProgramarSesion} boton="Programar sesión" className="mt-3 grid gap-3 sm:grid-cols-4" reiniciar>
              <label className="sm:col-span-2">
                <span className="etiqueta-campo">Curso</span>
                <select name="curso_id" className="campo">
                  {grupales.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="etiqueta-campo">Inicio (3 horas)</span>
                <input type="datetime-local" name="inicio" required min={minimoLocal()} className="campo" />
              </label>
              <label>
                <span className="etiqueta-campo">Capacidad</span>
                <input type="number" name="capacidad" required min={2} max={50} defaultValue={6} className="campo" />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-4">
                <input type="checkbox" name="habilitar" defaultChecked className="h-4 w-4 accent-[#7a5c24]" /> Habilitar inscripciones ahora (aparta el intervalo
                completo en la agenda, RN-04.9)
              </label>
            </Formulario>
          )}
        </section>

        <section className="tarjeta overflow-x-auto p-4">
          <h2 className="font-bold">Sesiones grupales</h2>
          {sesiones.length === 0 ? (
            <Vacio>No hay sesiones.</Vacio>
          ) : (
            <table className="tabla mt-2">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Fecha</th>
                  <th>Capacidad</th>
                  <th>Confirmadas</th>
                  <th>Apartadas</th>
                  <th>Libres</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sesiones.map((s) => {
                  const libres = Math.max(0, s.capacidad - s.confirmados - s.apartados);
                  const pasada = new Date(s.inicio) < new Date();
                  return (
                    <tr key={s.id}>
                      <td>{s.curso}</td>
                      <td >
                        {fechaHora(s.inicio)} – {hora(s.fin)}
                      </td>
                      <td>{s.capacidad}</td>
                      <td>{s.confirmados}</td>
                      <td>{s.apartados}</td>
                      <td>{libres}</td>
                      <td>
                        <Etiqueta texto={s.estado} />
                      </td>
                      <td className="space-y-1">
                        {s.estado === "Programada" && !pasada && (
                          <Formulario accion={accionSesion} boton="Habilitar" claseBoton="btn-borde px-3 py-1 text-xs" >
                            <input type="hidden" name="sesion_id" value={s.id} />
                            <input type="hidden" name="op" value="habilitar" />
                          </Formulario>
                        )}
                        {["Abierta", "Llena"].includes(s.estado) && pasada && (
                          <Formulario accion={accionSesion} boton="Marcar realizada" claseBoton="btn-borde px-3 py-1 text-xs" >
                            <input type="hidden" name="sesion_id" value={s.id} />
                            <input type="hidden" name="op" value="realizada" />
                          </Formulario>
                        )}
                        {["Programada", "Abierta", "Llena"].includes(s.estado) && !pasada && (
                          <Formulario accion={accionSesion} boton="Cancelar" claseBoton="btn-peligro px-3 py-1 text-xs" confirmar="Se cancelarán las inscripciones abiertas y se liberará el intervalo. ¿Continuar?" >
                            <input type="hidden" name="sesion_id" value={s.id} />
                            <input type="hidden" name="op" value="cancelar" />
                          </Formulario>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          {cursos.map((c) => (
            <details key={c.id} className="tarjeta p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-2">
                <span className="font-semibold">{c.nombre}</span>
                <span className="flex gap-1">
                  <Etiqueta texto={c.modalidad} tono="info" />
                  <Etiqueta texto={c.activo ? "Activo" : "Inactivo"} tono={c.activo ? "ok" : "n"} />
                </span>
              </summary>
              <Formulario accion={accionGuardarCurso} boton="Guardar cambios" claseBoton="btn-borde" className="mt-4 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="modalidad" value={c.modalidad} />
                <label>
                  <span className="etiqueta-campo">Nombre</span>
                  <input name="nombre" defaultValue={c.nombre} className="campo" />
                </label>
                <label>
                  <span className="etiqueta-campo">Precio de referencia (C$)</span>
                  <input name="precio_base" defaultValue={c.precio_base ?? ""} className="campo" />
                </label>
                <label className="sm:col-span-2">
                  <span className="etiqueta-campo">Descripción</span>
                  <input name="descripcion" defaultValue={c.descripcion} className="campo" />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="activo" defaultChecked={c.activo} className="h-4 w-4 accent-[#7a5c24]" /> Activo
                </label>
              </Formulario>
            </details>
          ))}
          <section className="tarjeta p-4">
            <h2 className="font-bold">Nuevo curso</h2>
            <Formulario accion={accionGuardarCurso} boton="Registrar curso" className="mt-3 grid gap-3 sm:grid-cols-2" reiniciar>
              <label>
                <span className="etiqueta-campo">Nombre</span>
                <input name="nombre" required className="campo" />
              </label>
              <label>
                <span className="etiqueta-campo">Modalidad</span>
                <select name="modalidad" className="campo">
                  <option value="individual">Individual</option>
                  <option value="grupal">Grupal</option>
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="etiqueta-campo">Descripción</span>
                <input name="descripcion" className="campo" />
              </label>
              <label>
                <span className="etiqueta-campo">Precio de referencia (C$)</span>
                <input name="precio_base" className="campo" />
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input type="checkbox" name="activo" defaultChecked className="h-4 w-4 accent-[#7a5c24]" /> Activo
              </label>
            </Formulario>
          </section>
        </div>
      </div>
    </>
  );
}
