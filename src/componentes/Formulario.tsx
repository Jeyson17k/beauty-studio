"use client";
// Formulario con acción de servidor: muestra el error o el mensaje de éxito y desactiva el botón mientras se procesa
// (evita dobles clics; RN-11.8 también se garantiza en el servidor).
// El envío se hace desde onSubmit para que, si el servidor rechaza un dato, el formulario conserve lo escrito
// (con action={...} React vacía los campos después de cada envío, aunque haya error).
import { startTransition, useActionState, useEffect, useRef } from "react";

export type EstadoForm = { ok: boolean; error?: string; mensaje?: string; pedirCodigo?: boolean } | null;

function Enviar({ texto, clase, confirmar, pending }: { texto: string; clase: string; confirmar?: string; pending: boolean }) {
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
  accion, children, boton = "Guardar", claseBoton = "btn-primario", confirmar, className = "space-y-4", reiniciar = false, botonAncho = false, alExito,
}: {
  accion: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  children?: React.ReactNode;
  boton?: string;
  claseBoton?: string;
  confirmar?: string;
  className?: string;
  reiniciar?: boolean;
  botonAncho?: boolean;
  alExito?: (mensaje?: string) => void;
}) {
  const [estado, ejecutar, pending] = useActionState(accion, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok && reiniciar) ref.current?.reset();
    if (estado?.ok) alExito?.(estado.mensaje);
  }, [estado, reiniciar, alExito]);
  return (
    <form
      ref={ref}
      className="space-y-3"
      encType="multipart/form-data"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => ejecutar(fd));
      }}
    >
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
      {estado?.pedirCodigo && (
        <div className="space-y-2 rounded-xl bg-crema-100 p-3">
          <label className="block">
            <span className="etiqueta-campo">Código de 6 dígitos que te llegó por WhatsApp</span>
            <input name="codigo" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" className="campo text-center text-xl tracking-[0.4em]" />
          </label>
          <button type="submit" name="paso" value="reenviar" formNoValidate disabled={pending} className="text-sm font-semibold text-oro-700 hover:underline">
            Enviarme otro código
          </button>
        </div>
      )}
      <div className={botonAncho ? "" : "flex flex-wrap gap-2"}>
        <Enviar texto={boton} clase={`${claseBoton} ${botonAncho ? "w-full" : ""}`} confirmar={confirmar} pending={pending} />
      </div>
    </form>
  );
}
