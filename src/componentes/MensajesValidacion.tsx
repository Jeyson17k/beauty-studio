"use client";
// Avisos de validación del navegador en español y con el texto propio de cada campo (atributo title),
// en vez del mensaje genérico «Utiliza un formato que coincida…». La regla real vive en el servidor (src/lib/validar.ts).
import { useEffect } from "react";

type Campo = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function mensaje(c: Campo): string {
  const v = c.validity;
  if (v.valueMissing) return c instanceof HTMLSelectElement ? "Elige una opción." : "Completa este campo.";
  if (v.patternMismatch) return c.title || "El dato no tiene el formato esperado.";
  if (v.tooShort) return `Escribe al menos ${(c as HTMLInputElement).minLength} caracteres.`;
  if (v.tooLong) return `Escribe como máximo ${(c as HTMLInputElement).maxLength} caracteres.`;
  if (v.badInput) return "Escribe solo números.";
  if (v.stepMismatch) return "Escribe un número entero.";
  if (v.rangeUnderflow) return `El valor mínimo es ${(c as HTMLInputElement).min}.`;
  if (v.rangeOverflow) return `El valor máximo es ${(c as HTMLInputElement).max}.`;
  if (v.typeMismatch) return "Revisa el dato escrito.";
  return "";
}

export function MensajesValidacion() {
  useEffect(() => {
    const alInvalido = (e: Event) => {
      const c = e.target as Campo;
      if (!("setCustomValidity" in c)) return;
      c.setCustomValidity("");
      if (!c.validity.valid) c.setCustomValidity(mensaje(c));
    };
    const alEscribir = (e: Event) => {
      const c = e.target as Campo;
      if ("setCustomValidity" in c) c.setCustomValidity("");
    };
    document.addEventListener("invalid", alInvalido, true);
    document.addEventListener("input", alEscribir, true);
    document.addEventListener("change", alEscribir, true);
    return () => {
      document.removeEventListener("invalid", alInvalido, true);
      document.removeEventListener("input", alEscribir, true);
      document.removeEventListener("change", alEscribir, true);
    };
  }, []);
  return null;
}
