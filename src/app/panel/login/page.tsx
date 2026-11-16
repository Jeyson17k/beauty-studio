import Link from "next/link";
import { redirect } from "next/navigation";
import { Formulario } from "@/componentes/Formulario";
import { CampoPassword } from "@/componentes/CampoPassword";
import { PantallaAcceso } from "@/componentes/PantallaAcceso";
import { sesionAdmin } from "@/lib/sesion";
import { accionLogin } from "../acciones";

export const metadata = { title: "Iniciar sesión" };

// A01 Iniciar sesión (CU-10)
export default async function Login({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  if (await sesionAdmin()) redirect("/panel");
  const { siguiente } = await searchParams;
  return (
    <PantallaAcceso>
      <h2 className="font-titulo text-2xl font-semibold uppercase tracking-wide">Iniciar sesión</h2>
      <p className="mt-1 text-sm text-gris-600">Bienvenida de nuevo, Andrea.</p>
      <Formulario accion={accionLogin} boton="Entrar" claseBoton="btn acc-boton-oscuro" botonAncho className="mt-6 space-y-4">
        <input type="hidden" name="siguiente" value={siguiente ?? "/panel"} />
        <label className="block">
          <span className="etiqueta-campo">Usuario</span>
          <input name="usuario" required autoComplete="username" autoFocus className="campo" />
        </label>
        <CampoPassword />
      </Formulario>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-oro-700">
        <Link href="/panel/login/recuperar?que=password" className="hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/panel/login/recuperar?que=usuario" className="hover:underline">
          ¿Olvidaste tu usuario?
        </Link>
        <Link href="/panel/login/recuperar?que=correo" className="hover:underline">
          Perdí mi correo
        </Link>
      </div>
      <Link href="/" className="mt-5 block border-t border-linea-200 pt-4 text-center text-xs text-gris-600 hover:text-oro-700">
        ← Ir a la página de Beauty Studio
      </Link>
    </PantallaAcceso>
  );
}
