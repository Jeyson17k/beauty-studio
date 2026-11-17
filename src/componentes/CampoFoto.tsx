"use client";
// Campo para subir la foto de un producto: botón «Elegir imagen», vista previa y opción de quitar la actual.
import { useEffect, useRef, useState } from "react";
import { FotoProducto } from "./FotoProducto";

const MAX = 8 * 1024 * 1024;

export function CampoFoto({ actual, nombre }: { actual?: string | null; nombre?: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [quitar, setQuitar] = useState(false);
  const [error, setError] = useState("");
  const [nombreArchivo, setNombreArchivo] = useState("");

  // Al reiniciar el formulario (después de registrar un producto nuevo) se limpia la vista previa.
  useEffect(() => {
    const f = entrada.current?.form;
    const limpiar = () => { setVista(null); setQuitar(false); setError(""); setNombreArchivo(""); };
    f?.addEventListener("reset", limpiar);
    return () => f?.removeEventListener("reset", limpiar);
  }, []);
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);

  const elegir = (archivo?: File) => {
    setError("");
    setNombreArchivo(archivo?.name ?? "");
    if (!archivo) return setVista(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) { setError("Usa una imagen JPG, PNG o WEBP."); setNombreArchivo(""); if (entrada.current) entrada.current.value = ""; return setVista(null); }
    if (archivo.size > MAX) { setError("La imagen supera los 8 MB."); setNombreArchivo(""); if (entrada.current) entrada.current.value = ""; return setVista(null); }
    setQuitar(false);
    setVista(URL.createObjectURL(archivo));
  };

  const mostrada = vista ?? (quitar ? null : actual ?? null);
  return (
    <div className="sm:col-span-3">
      <span className="etiqueta-campo">Foto del producto (opcional)</span>
      <input type="hidden" name="foto_actual" value={actual ?? ""} />
      <div className="mt-1 flex flex-wrap items-center gap-4">
        <FotoProducto url={mostrada} nombre={nombre || "Nuevo producto"} className="h-20 w-20 rounded-xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-borde cursor-pointer px-4 py-2 text-sm">
              {vista || actual ? "Cambiar imagen" : "Elegir imagen"}
              <input ref={entrada} type="file" name="foto" accept="image/jpeg,image/png,image/webp" onChange={(e) => elegir(e.target.files?.[0])} className="sr-only" />
            </label>
            <span className="max-w-[14rem] truncate text-xs text-gris-600">{nombreArchivo || "Ningún archivo elegido"}</span>
          </div>
          <p className="text-xs text-gris-600">JPG, PNG o WEBP, hasta 8 MB.</p>
          {actual && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="quitar_foto" checked={quitar} onChange={(e) => { setQuitar(e.target.checked); if (e.target.checked) { setVista(null); setNombreArchivo(""); if (entrada.current) entrada.current.value = ""; } }} className="h-4 w-4 accent-[#7a5c24]" />
              Quitar la foto actual
            </label>
          )}
          {error && <p role="alert" className="text-xs text-error-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
