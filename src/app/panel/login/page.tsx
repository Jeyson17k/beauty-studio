import { redirect } from "next/navigation";
import { Formulario } from "@/componentes/Formulario";
import { Logo } from "@/componentes/ui";
import { sesionAdmin } from "@/lib/sesion";
import { accionLogin } from "../acciones";

export const metadata = { title: "Iniciar sesión" };

// A01 Iniciar sesión (CU-10)
export default async function Login({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  if (await sesionAdmin()) redirect("/panel");
  const { siguiente } = await searchParams;
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-negro-900 p-10 text-white lg:flex">
        <Logo claro />
        <div>
          <p className="text-3xl font-bold leading-tight">Panel de administración</p>
          <p className="mt-2 text-oro-200">Solicitudes, cotizaciones, comprobantes y agenda en un solo lugar.</p>
        </div>
        <p className="text-xs text-oro-200">Andrea Paola · Los Cedros, León</p>
      </div>
      <div className="flex items-center justify-center bg-crema-200 p-6">
        <div className="tarjeta w-full max-w-sm p-6">
          <h1 className="text-xl font-bold">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-gris-600">Solo para la administradora.</p>
          <Formulario accion={accionLogin} boton="Entrar" botonAncho className="mt-5 space-y-4">
            <input type="hidden" name="siguiente" value={siguiente ?? "/panel"} />
            <label className="block">
              <span className="etiqueta-campo">Usuario</span>
              <input name="usuario" required autoComplete="username" className="campo" />
            </label>
            <label className="block">
              <span className="etiqueta-campo">Contraseña</span>
              <input name="password" type="password" required autoComplete="current-password" className="campo" />
            </label>
          </Formulario>
        </div>
      </div>
    </div>
  );
}
