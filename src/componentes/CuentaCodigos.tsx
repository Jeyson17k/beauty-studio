"use client";
// Pantallas de contraseña y correo con código por correo (como «olvidé mi contraseña» de Facebook):
// primero se pide el código y, cuando llega, se escribe junto con lo nuevo.
import Link from "next/link";
import { useCallback, useState } from "react";
import { Formulario } from "./Formulario";
import {
  accionCambiarPasswordConCodigo, accionCambiarUsuario, accionConfirmarCorreo, accionConfirmarCorreoEmergencia, accionGenerarClaveEmergencia, accionPedirCorreoEmergencia, accionCorreoPrueba, accionPedirCodigoCambio, accionPedirCodigoCorreo, accionPedirCodigoUsuario,
  accionPedirRecuperacion, accionRecordarUsuario, accionRestablecerPassword,
} from "@/app/panel/cuenta-acciones";

const CampoCodigo = () => (
  <label className="block">
    <span className="etiqueta-campo">Código de 6 dígitos</span>
    <input name="codigo" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" className="campo text-center text-xl tracking-[0.4em]" />
  </label>
);

const CamposPasswordNueva = () => (
  <>
    <label className="block">
      <span className="etiqueta-campo">Contraseña nueva (mínimo 10 caracteres)</span>
      <input type="password" name="nueva" required minLength={10} autoComplete="new-password" className="campo" />
    </label>
    <label className="block">
      <span className="etiqueta-campo">Repetir la contraseña nueva</span>
      <input type="password" name="repetir" required minLength={10} autoComplete="new-password" className="campo" />
    </label>
  </>
);

/** Inicio de sesión → «¿Olvidaste tu contraseña?»: correo → código → contraseña nueva. */
export function RecuperarContrasena() {
  const [correo, setCorreo] = useState("");
  const [paso, setPaso] = useState<1 | 2>(1);
  const [listo, setListo] = useState(false);
  const aPaso2 = useCallback(() => setPaso(2), []);
  const terminar = useCallback(() => setListo(true), []);
  return (
    <div className="space-y-5">
      <Formulario accion={accionPedirRecuperacion} boton={paso === 1 ? "Enviarme el código" : "Enviar un código nuevo"} claseBoton={paso === 1 ? "btn-primario" : "btn-borde"} botonAncho alExito={aPaso2}>
        <label className="block">
          <span className="etiqueta-campo">Correo registrado</span>
          <input name="correo" type="email" required autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@gmail.com" className="campo" />
        </label>
      </Formulario>
      {paso === 2 && !listo && (
        <Formulario accion={accionRestablecerPassword} boton="Cambiar mi contraseña" botonAncho alExito={terminar} className="space-y-4">
          <input type="hidden" name="correo" value={correo} />
          <CampoCodigo />
          <CamposPasswordNueva />
        </Formulario>
      )}
      {listo && (
        <>
          <p role="status" className="rounded-xl bg-ok-100 px-4 py-3 text-sm text-ok-700">
            Contraseña actualizada. Ya puedes iniciar sesión con la nueva.
          </p>
          <Link href="/panel/login" className="btn-primario block w-full text-center">
            Ir a iniciar sesión
          </Link>
        </>
      )}
    </div>
  );
}

/** Configuración → cambiar contraseña: se envía un código al correo registrado y se confirma con él. */
export function CambiarContrasena({ correoOculto }: { correoOculto: string | null }) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const aPaso2 = useCallback(() => setPaso(2), []);
  if (!correoOculto) {
    return <p className="mt-2 rounded-xl bg-aviso-100 px-4 py-3 text-sm text-aviso-700">Para cambiar la contraseña con un código, primero registra tu correo en la sección de arriba.</p>;
  }
  return (
    <div className="mt-3 space-y-4">
      <p className="text-sm text-gris-600">
        Te enviamos un código de 6 dígitos a <strong>{correoOculto}</strong> para confirmar que eres tú.
      </p>
      <Formulario accion={accionPedirCodigoCambio} boton={paso === 1 ? "Enviarme un código" : "Enviar un código nuevo"} claseBoton="btn-borde" alExito={aPaso2} />
      {paso === 2 && (
        <Formulario accion={accionCambiarPasswordConCodigo} boton="Cambiar contraseña" reiniciar className="space-y-3">
          <CampoCodigo />
          <CamposPasswordNueva />
        </Formulario>
      )}
    </div>
  );
}

/** Configuración → correo de recuperación: el código llega al correo nuevo para comprobar que es de ella. */
export function RegistrarCorreo({ correoOculto }: { correoOculto: string | null }) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const aPaso2 = useCallback(() => setPaso(2), []);
  return (
    <div className="mt-3 space-y-4">
      <p className="text-sm text-gris-600">
        {correoOculto ? (
          <>
            Correo actual: <strong>{correoOculto}</strong>. Puedes cambiarlo abajo.
          </>
        ) : (
          "Todavía no hay un correo registrado. Regístralo para poder recuperar y cambiar la contraseña con un código."
        )}
      </p>
      <Formulario accion={accionPedirCodigoCorreo} boton={paso === 1 ? "Enviar código al correo" : "Enviar un código nuevo"} claseBoton="btn-borde" className="space-y-3" alExito={aPaso2}>
        <label className="block">
          <span className="etiqueta-campo">{correoOculto ? "Correo nuevo" : "Correo"}</span>
          <input name="correo" type="email" required autoComplete="email" placeholder="nombre@gmail.com" className="campo" />
        </label>
        <label className="block">
          <span className="etiqueta-campo">Tu contraseña actual (para confirmar)</span>
          <input name="password" type="password" required autoComplete="current-password" className="campo" />
        </label>
      </Formulario>
      {paso === 2 && (
        <Formulario accion={accionConfirmarCorreo} boton="Confirmar correo" reiniciar className="space-y-3">
          <CampoCodigo />
        </Formulario>
      )}
    </div>
  );
}

/** Inicio de sesión → «¿Olvidaste tu usuario?»: se escribe el correo registrado y el usuario llega por correo. */
export function RecordarUsuario() {
  return (
    <Formulario accion={accionRecordarUsuario} boton="Enviarme mi usuario" botonAncho>
      <label className="block">
        <span className="etiqueta-campo">Correo registrado</span>
        <input name="correo" type="email" required autoComplete="email" placeholder="nombre@gmail.com" className="campo" />
      </label>
    </Formulario>
  );
}

/** Configuración → nombre de usuario: se elige el nuevo y se confirma con un código enviado al correo registrado. */
export function CambiarUsuario({ usuarioActual, correoOculto }: { usuarioActual: string; correoOculto: string | null }) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [nuevo, setNuevo] = useState("");
  const aPaso2 = useCallback(() => setPaso(2), []);
  return (
    <div className="mt-3 space-y-4">
      <p className="text-sm text-gris-600">
        Usuario actual: <strong>{usuarioActual}</strong>
      </p>
      {!correoOculto ? (
        <p className="rounded-xl bg-aviso-100 px-4 py-3 text-sm text-aviso-700">Para cambiar el usuario con un código, primero registra tu correo en la sección de arriba.</p>
      ) : (
        <>
          <Formulario accion={accionPedirCodigoUsuario} boton={paso === 1 ? "Enviar código al correo" : "Enviar un código nuevo"} claseBoton="btn-borde" className="space-y-3" alExito={aPaso2}>
            <label className="block">
              <span className="etiqueta-campo">Usuario nuevo</span>
              <input name="usuario_nuevo" required minLength={4} maxLength={30} autoComplete="off" value={nuevo} onChange={(e) => setNuevo(e.target.value)} className="campo" />
              <span className="ayuda">De 4 a 30 caracteres: letras sin tilde, números, punto, guion o guion bajo. El código llega a {correoOculto}.</span>
            </label>
          </Formulario>
          {paso === 2 && (
            <Formulario accion={accionCambiarUsuario} boton="Cambiar usuario" className="space-y-3">
              <input type="hidden" name="usuario_nuevo" value={nuevo} />
              <CampoCodigo />
            </Formulario>
          )}
        </>
      )}
    </div>
  );
}

/** Configuración → comprobar que el correo real funciona (manda un mensaje de prueba al correo registrado). */
export function ProbarCorreo() {
  return <Formulario accion={accionCorreoPrueba} boton="Enviarme un correo de prueba" claseBoton="btn-borde" />;
}

/** Configuración → clave de emergencia: se muestra una sola vez y sirve si se pierde el correo y la contraseña. */
export function ClaveEmergencia({ tiene }: { tiene: boolean }) {
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-gris-600">
        Si algún día Andrea pierde el acceso a su correo <strong>y</strong> olvida la contraseña, esta clave permite registrar un correo nuevo desde el inicio de sesión.
        Se muestra una sola vez: anótala y guárdala fuera del sistema.
      </p>
      <p className={`rounded-xl px-4 py-2 text-sm ${tiene ? "bg-ok-100 text-ok-700" : "bg-aviso-100 text-aviso-700"}`}>
        {tiene ? "Ya hay una clave de emergencia guardada. Puedes generar otra (la anterior dejará de servir)." : "Todavía no hay una clave de emergencia."}
      </p>
      <Formulario accion={accionGenerarClaveEmergencia} boton={tiene ? "Generar una clave nueva" : "Generar mi clave de emergencia"} claseBoton="btn-borde" reiniciar>
        <label className="block">
          <span className="etiqueta-campo">Tu contraseña actual (para confirmar)</span>
          <input name="password" type="password" required autoComplete="current-password" className="campo" />
        </label>
      </Formulario>
    </div>
  );
}

/** Inicio de sesión → «Perdí mi correo»: usuario + clave de emergencia + correo nuevo → código al correo nuevo. */
export function PerdiMiCorreo() {
  const [datos, setDatos] = useState({ usuario: "", clave: "", correo: "" });
  const [paso, setPaso] = useState<1 | 2>(1);
  const [listo, setListo] = useState(false);
  const aPaso2 = useCallback(() => setPaso(2), []);
  const terminar = useCallback(() => setListo(true), []);
  const campo = (k: "usuario" | "clave" | "correo") => ({ value: datos[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDatos((d) => ({ ...d, [k]: e.target.value })) });
  return (
    <div className="space-y-5">
      <Formulario accion={accionPedirCorreoEmergencia} boton={paso === 1 ? "Enviar código al correo nuevo" : "Enviar un código nuevo"} claseBoton={paso === 1 ? "btn-primario" : "btn-borde"} botonAncho alExito={aPaso2}>
        <label className="block">
          <span className="etiqueta-campo">Usuario</span>
          <input name="usuario" required autoComplete="username" className="campo" {...campo("usuario")} />
        </label>
        <label className="block">
          <span className="etiqueta-campo">Clave de emergencia</span>
          <input name="clave" required autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX" className="campo uppercase" {...campo("clave")} />
        </label>
        <label className="block">
          <span className="etiqueta-campo">Correo nuevo</span>
          <input name="correo" type="email" required autoComplete="email" placeholder="nombre@gmail.com" className="campo" {...campo("correo")} />
        </label>
      </Formulario>
      {paso === 2 && !listo && (
        <Formulario accion={accionConfirmarCorreoEmergencia} boton="Confirmar correo nuevo" botonAncho alExito={terminar} className="space-y-4">
          <input type="hidden" name="usuario" value={datos.usuario} />
          <input type="hidden" name="clave" value={datos.clave} />
          <CampoCodigo />
        </Formulario>
      )}
      {listo && (
        <>
          <p role="status" className="rounded-xl bg-ok-100 px-4 py-3 text-sm text-ok-700">
            Correo nuevo registrado. Ahora puedes recuperar la contraseña con «Mi contraseña». La clave de emergencia ya se gastó: genera otra en Configuración.
          </p>
          <Link href="/panel/login/recuperar?que=password" className="btn-primario block w-full text-center">
            Recuperar mi contraseña
          </Link>
        </>
      )}
    </div>
  );
}
