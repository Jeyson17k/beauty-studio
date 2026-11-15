"use client";
import { useState } from "react";
import { CamposLugar } from "./CamposPublicos";
import { SelectorCalendario, type Casilla } from "./SelectorCalendario";

type Op = { id: number; nombre: string };
type Ses = { id: number; curso_id: number; texto: string };

/** Campos del registro directo (A11): el formulario se adapta a servicio, clase individual o sesión grupal (RN-17.2). */
export function CamposRegistroDirecto({ servicios, cursos, sesiones, minimo, casillas, tipoInicial = "servicio" }: { servicios: Op[]; cursos: (Op & { modalidad: string })[]; sesiones: Ses[]; minimo: string; casillas: Casilla[]; tipoInicial?: "servicio" | "curso" }) {
  const [tipo, setTipo] = useState<"servicio" | "curso">(tipoInicial);
  const [cursoId, setCursoId] = useState<number>(cursos[0]?.id ?? 0);
  const curso = cursos.find((c) => c.id === cursoId);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {(["servicio", "curso"] as const).map((t) => (
          <label key={t} className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-semibold ${tipo === t ? "border-oro-700 bg-crema-300" : "border-linea-200 bg-white"}`}>
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
            {t === "servicio" ? "Servicio de belleza" : "Curso"}
          </label>
        ))}
      </div>
      {tipo === "servicio" ? (
        <>
          <label className="block">
            <span className="etiqueta-campo">Servicio</span>
            <select name="servicio_id" required className="campo">
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="etiqueta-campo">Fecha y hora</span>
          <SelectorCalendario casillas={casillas} minimo={minimo} detalle />
          </div>
          <CamposLugar />
        </>
      ) : (
        <>
          <label className="block">
            <span className="etiqueta-campo">Curso</span>
            <select name="curso_id" value={cursoId} onChange={(e) => setCursoId(Number(e.target.value))} className="campo">
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.modalidad})
                </option>
              ))}
            </select>
          </label>
          {curso?.modalidad === "grupal" ? (
            <label className="block">
              <span className="etiqueta-campo">Sesión</span>
              <select name="sesion_id" required className="campo">
                {sesiones.filter((s) => s.curso_id === cursoId).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.texto}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div>
              <span className="etiqueta-campo">Fecha y hora de la clase (3 horas)</span>
              <SelectorCalendario casillas={casillas} minimo={minimo} duracionMin={180} detalle />
            </div>
          )}
        </>
      )}
      <label className="block">
        <span className="etiqueta-campo">Notas</span>
        <textarea name="descripcion" maxLength={300} rows={2} className="campo" />
      </label>
    </>
  );
}
