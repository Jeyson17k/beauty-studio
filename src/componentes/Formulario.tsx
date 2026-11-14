"use client";
// Formulario con acción de servidor: muestra el error o el mensaje de éxito y desactiva el botón mientras se procesa
// (evita dobles clics; RN-11.8 también se garantiza en el servidor).
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type EstadoForm = { ok: boolean; error?: string; mensaje?: string } | null;

function Enviar({ texto, clase, confirmar }: { texto: string; clase: string; confirmar?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={clase}
      disabled={pending}
      onClick={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {pending ? "Procesando…" : texto}
    </button>
  );
}

export function Formulario({
  accion, children, boton = "Guardar", claseBoton = "btn-primario", confirmar, className = "space-y-4", reiniciar = false, botonAncho = false,
}: {
  accion: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  children?: React.ReactNode;
  boton?: string;
  claseBoton?: string;
  confirmar?: string;
  className?: string;
  reiniciar?: boolean;
  botonAncho?: boolean;
}) {
  const [estado, ejecutar] = useActionState(accion, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok && reiniciar) ref.current?.reset();
  }, [estado, reiniciar]);
  return (
    <form ref={ref} action={ejecutar} className="space-y-3" encType="multipart/form-data">
      {children && <div className={className}>{children}</div>}
      {estado?.error && (
        <p role="alert" className="rounded-xl bg-error-100 px-4 py-3 text-sm text-error-700">
          {estado.error}
        </p>
      )}
      {estado?.ok && estado.mensaje && (
        <p role="status" className="rounded-xl bg-ok-100 px-4 py-3 text-sm text-ok-700">
          {estado.mensaje}
        </p>
      )}
      <div className={botonAncho ? "" : "flex flex-wrap gap-2"}>
        <Enviar texto={boton} clase={`${claseBoton} ${botonAncho ? "w-full" : ""}`} confirmar={confirmar} />
      </div>
    </form>
  );
}
