import { CONFIG_INICIAL, leerConfig } from "@/lib/config";
import { sesionAdmin } from "@/lib/sesion";
import { ultimaAuditoria } from "@/modulos/seguridad";
import { ocultarCorreo, tieneClaveEmergencia, usuarioPorId } from "@/modulos/cuenta";
import { CambiarContrasena, CambiarUsuario, ClaveEmergencia, ProbarCorreo, RegistrarCorreo } from "@/componentes/CuentaCodigos";
import { modoCorreo } from "@/lib/correo";
import { modoWhatsApp } from "@/modulos/whatsapp/cliente";
import { Formulario } from "@/componentes/Formulario";
import { EncabezadoPanel } from "@/componentes/ui";
import { fechaHora } from "@/lib/tiempo";
import { accionEjecutarPlanificador, accionGuardarConfig } from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración" };

// Parámetros editables (tabla configuracion), cambio de contraseña y auditoría (RNF-08).
export default async function Configuracion() {
  const [cfg, auditoria, yo] = await Promise.all([leerConfig(), ultimaAuditoria(40), sesionAdmin().then((s) => (s ? usuarioPorId(s.uid) : null))]);
  const correoOculto = yo?.correo ? ocultarCorreo(yo.correo) : null;
  return (
    <>
      <EncabezadoPanel titulo="Configuración" />
      <div className="grid gap-5 p-5 lg:p-8 xl:grid-cols-2">
        <section className="tarjeta p-4">
          <h2 className="font-bold">Parámetros</h2>
          <p className="text-xs text-gris-600">El anticipo es siempre el 10 % del precio total (RN-10.3).</p>
          <Formulario accion={accionGuardarConfig} boton="Guardar parámetros" className="mt-3 space-y-3">
            {(Object.keys(CONFIG_INICIAL) as (keyof typeof CONFIG_INICIAL)[]).map((k) => (
              <label key={k} className="block">
                <span className="etiqueta-campo">{CONFIG_INICIAL[k].descripcion}</span>
                <input name={k} defaultValue={cfg[k]} className="campo" />
              </label>
            ))}
          </Formulario>
        </section>
        <div className="space-y-5">
          <section className="tarjeta p-4">
            <h2 className="font-bold">Planificador de tareas</h2>
            <p className="text-sm text-gris-600">
              Corre solo cada minuto. WhatsApp: modo <strong>{modoWhatsApp()}</strong>.
            </p>
            <Formulario accion={accionEjecutarPlanificador} boton="Ejecutar ahora" claseBoton="btn-borde" className="mt-3 space-y-2" />
          </section>
          <section className="tarjeta p-4">
            <h2 className="font-bold">Correo de recuperación</h2>
            <RegistrarCorreo correoOculto={correoOculto} />
            {correoOculto && (
              <div className="mt-4 border-t border-linea-200 pt-3">
                <p className="text-xs text-gris-600">
                  Envío de correos: modo <strong>{modoCorreo()}</strong>
                  {modoCorreo() === "simulado" && " (los códigos se muestran en pantalla; para correos reales usa MAIL_MODE=resend o smtp en .env.local)"}.
                </p>
                <div className="mt-2">
                  <ProbarCorreo />
                </div>
              </div>
            )}
          </section>
          <section className="tarjeta p-4">
            <h2 className="font-bold">Clave de emergencia</h2>
            <ClaveEmergencia tiene={await tieneClaveEmergencia(yo?.id ?? 0)} />
          </section>
          <section className="tarjeta p-4">
            <h2 className="font-bold">Nombre de usuario</h2>
            <CambiarUsuario usuarioActual={yo?.usuario ?? ""} correoOculto={correoOculto} />
          </section>
          <section className="tarjeta p-4">
            <h2 className="font-bold">Cambiar contraseña</h2>
            <CambiarContrasena correoOculto={correoOculto} />
          </section>
          <section className="tarjeta p-4">
            <h2 className="font-bold">Auditoría reciente</h2>
            <ol className="mt-2 max-h-96 space-y-1 overflow-y-auto text-xs">
              {auditoria.map((a) => (
                <li key={a.id}>
                  <span className="text-gris-600">{fechaHora(a.marca_tiempo)}</span> · {a.accion} · {a.entidad}
                  {a.entidad_id ? ` #${a.entidad_id}` : ""} · {a.usuario ?? "sistema"}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
