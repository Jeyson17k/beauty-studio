import Link from "next/link";
import { redirect } from "next/navigation";
import { Formulario } from "@/componentes/Formulario";
import { Logo } from "@/componentes/ui";
import { sesionAdmin, sesionPerfilClienta } from "@/lib/sesion";
import { accionCambiarPerfil } from "./acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cambiar de perfil" };

// Andrea cambia entre el panel de administración y la página de las clientas. Siempre se pide la contraseña.
export default async function CambiarPerfil({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const aClienta = (await searchParams).a === "clienta";
  const actual = aClienta ? await sesionAdmin() : await sesionPerfilClienta();
  if (!actual) redirect("/panel/login");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-crema-200 p-6">
      <div className="tarjeta w-full max-w-sm space-y-5 p-6">
        <Logo />
        <div>
          <h1 className="text-xl font-bold">{aClienta ? "Cambiar a perfil de clienta" : "Cambiar a perfil de administradora"}</h1>
          <p className="mt-1 text-sm text-gris-600">
            {aClienta ? "Verás la página tal como la ven las clientas. Para volver al panel se te pedirá la contraseña." : "Escribe tu contraseña para volver al panel de administración."}
          </p>
        </div>
        <Formulario accion={accionCambiarPerfil} boton="Cambiar de perfil" botonAncho className="space-y-4">
          <input type="hidden" name="destino" value={aClienta ? "clienta" : "admin"} />
          <label className="block">
            <span className="etiqueta-campo">Contraseña de {actual.usuario}</span>
            <input name="password" type="password" required autoFocus autoComplete="current-password" className="campo" />
          </label>
        </Formulario>
        <Link href={aClienta ? "/panel" : "/"} className="block text-center text-sm font-semibold text-oro-700 hover:underline">
          {aClienta ? "← Quedarme en el panel" : "← Seguir como clienta"}
        </Link>
      </div>
    </div>
  );
}
