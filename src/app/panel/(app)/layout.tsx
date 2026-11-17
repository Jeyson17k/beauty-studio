import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/componentes/ui";
import { MenuPanel } from "@/componentes/MenuPanel";
import { sesionAdmin } from "@/lib/sesion";
import { modoWhatsApp } from "@/modulos/whatsapp/cliente";
import { accionLogout } from "../acciones";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

// Panel de Andrea (A02 a A22). El menú lateral sigue el prototipo de Figma (M10). Las rutas están protegidas por el middleware y aquí se vuelve a comprobar la sesión.
export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const s = await sesionAdmin();
  if (!s) redirect("/panel/login");
  return (
    <div className="min-h-dvh bg-crema-200 lg:flex">
      <aside className="bg-negro-900 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:flex-col">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/panel">
            <Logo claro />
          </Link>
        </div>
        <MenuPanel simulado={modoWhatsApp() === "simulado"} />
        <div className="hidden px-5 pb-5 text-xs text-[#e8dcc6] lg:block">
          {modoWhatsApp() === "simulado" && <p className="mb-2 rounded-lg bg-aviso-100 px-2 py-1 font-semibold text-aviso-700">WhatsApp en modo simulado</p>}
          <Link href="/cambiar-perfil?a=clienta" className="mb-2 block font-semibold text-oro-300 hover:underline">
            Ver la página como clienta
          </Link>
          <p>Andrea · {s.rol}</p>
          <form action={accionLogout}>
            <button className="mt-2 font-semibold text-oro-300 hover:underline">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
