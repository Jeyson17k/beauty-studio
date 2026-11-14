"use client";
import { useState } from "react";

/** Datos de identificación (RN-01.1: sin correo ni contraseña) y aceptación de mensajes (RN-01.6). */
export function CamposIdentificacion({ conTitulo = true }: { conTitulo?: boolean }) {
  return (
    <fieldset className="space-y-4">
      {conTitulo && <legend className="mb-1 text-base font-bold">Tus datos</legend>}
      <label className="block">
        <span className="etiqueta-campo">Nombre completo</span>
        <input name="nombre" required minLength={3} maxLength={100} autoComplete="name" className="campo" placeholder="Ej.: Valeria Gómez" />
      </label>
      <label className="block">
        <span className="etiqueta-campo">Número de WhatsApp</span>
        <input name="whatsapp" required inputMode="tel" autoComplete="tel" className="campo" placeholder="8888 8888" />
        <span className="ayuda">Con este número se asocian tus solicitudes. No te pediremos correo ni contraseña.</span>
      </label>
      <label className="flex items-start gap-3 rounded-xl bg-crema-100 p-3 text-sm">
        <input type="checkbox" name="acepta" defaultChecked className="mt-1 h-4 w-4 accent-[#7a5c24]" />
        <span>Acepto recibir por WhatsApp la cotización y el aviso de confirmación de mis solicitudes. Puedes desmarcarlo: Andrea te escribirá ella misma.</span>
      </label>
    </fieldset>
  );
}

/** Lugar de atención: la dirección solo se pide a domicilio (RN-07.5 a RN-07.7). */
export function CamposLugar() {
  const [lugar, setLugar] = useState<"local" | "domicilio">("local");
  return (
    <fieldset>
      <legend className="etiqueta-campo">¿Dónde será la atención?</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["local", "domicilio"] as const).map((l) => (
          <label key={l} className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-semibold ${lugar === l ? "border-oro-700 bg-crema-300" : "border-linea-200 bg-white"}`}>
            <input type="radio" name="lugar" value={l} checked={lugar === l} onChange={() => setLugar(l)} className="sr-only" />
            {l === "local" ? "En el salón" : "A domicilio"}
          </label>
        ))}
      </div>
      {lugar === "domicilio" && (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="etiqueta-campo">Dirección</span>
            <input name="direccion" required minLength={5} maxLength={250} className="campo" placeholder="Barrio, calle, número de casa" />
          </label>
          <label className="block">
            <span className="etiqueta-campo">Referencia</span>
            <input name="referencia" maxLength={150} className="campo" placeholder="Ej.: frente al parque, portón negro" />
          </label>
          <p className="ayuda">Andrea suma el tiempo de traslado a la duración de la atención.</p>
        </div>
      )}
    </fieldset>
  );
}
