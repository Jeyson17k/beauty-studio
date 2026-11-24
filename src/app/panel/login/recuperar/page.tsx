import Link from "next/link";
import { redirect } from "next/navigation";
import { PerdiMiCorreo, RecordarUsuario, RecuperarContrasena } from "@/componentes/CuentaCodigos";
import { PantallaAcceso } from "@/componentes/PantallaAcceso";
import { sesionAdmin } from "@/lib/sesion";

export const metadata = { title: "Recuperar la cuenta" };

// Recuperar la cuenta: contraseña (correo → código → contraseña nueva) o usuario olvidado (llega por correo).
export default async function Recuperar({ searchParams }: { searchParams: Promise<{ que?: string }> }) {
  if (await sesionAdmin()) redirect("/panel");
  const { que } = await searchParams;
  const usuario = que === "usuario";
  const correo = que === "correo";
  const pestana = (activa: boolean) => `flex-1 rounded-full px-3 py-2 text-center text-sm font-semibold transition ${activa ? "oro-degradado text-negro-950" : "text-gris-600 hover:text-oro-700"}`;
  return (
    <PantallaAcceso>
      <h2 className="font-titulo text-2xl font-semibold uppercase tracking-wide">Recuperar mi cuenta</h2>
      <div className="mt-4 flex gap-1 rounded-full bg-crema-100 p-1">
        <Link href="/panel/login/recuperar?que=password" className={pestana(!usuario && !correo)}>
          Mi contraseña
        </Link>
        <Link href="/panel/login/recuperar?que=usuario" className={pestana(usuario)}>
          Mi usuario
        </Link>
        <Link href="/panel/login/recuperar?que=correo" className={pestana(correo)}>
          Perdí mi correo
        </Link>
      </div>
      <p className="mt-4 text-sm text-gris-600">
        {correo
          ? "¿Ya no tienes acceso a tu correo? Usa tu clave de emergencia (la que generaste en Configuración) para registrar uno nuevo."
          : usuario
            ? "Escribe el correo de la cuenta y te enviamos tu usuario."
            : "Escribe el correo de la cuenta y te enviamos un código de 6 dígitos."}
      </p>
      <div className="mt-4">{correo ? <PerdiMiCorreo /> : usuario ? <RecordarUsuario /> : <RecuperarContrasena />}</div>
      <Link href="/panel/login" className="mt-5 block text-center text-sm font-semibold text-oro-700 hover:underline">
        ← Volver a iniciar sesión
      </Link>
    </PantallaAcceso>
  );
}
