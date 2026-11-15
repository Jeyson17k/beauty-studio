"use client";
import { useState } from "react";

/** Campo de contraseña con botón para ver u ocultar lo escrito. */
export function CampoPassword({ name = "password", etiqueta = "Contraseña", autoComplete = "current-password", minLength }: { name?: string; etiqueta?: string; autoComplete?: string; minLength?: number }) {
  const [ver, setVer] = useState(false);
  return (
    <label className="block">
      <span className="etiqueta-campo">{etiqueta}</span>
      <span className="relative mt-1 block">
        <input name={name} type={ver ? "text" : "password"} required minLength={minLength} autoComplete={autoComplete} className="campo !mt-0 pr-20" />
        <button type="button" onClick={() => setVer((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-semibold text-oro-700 hover:bg-crema-300" aria-pressed={ver}>
          {ver ? "Ocultar" : "Ver"}
        </button>
      </span>
    </label>
  );
}
