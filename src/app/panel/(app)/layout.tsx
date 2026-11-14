import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/componentes/ui";
import { sesionAdmin } from "@/lib/sesion";
import { modoWhatsApp } from "@/modulos/whatsapp/cliente";
import { accionLogout } from "../acciones";

export const dynamic = "force-dynamic";

const MENU = [
  ["/panel", "Panel de inicio"],
  ["/panel/solicitudes", "Solicitudes"],
  ["/panel/agenda", "Agenda"],
  ["/panel/pedidos", "Pedidos"],
  ["/panel/productos", "Productos e inventario"],
  ["/panel/ventas", "Ventas"],
  ["/panel/gastos", "Gastos"],
  ["/panel/reportes", "Reportes"],
  ["/panel/mensajes", "Mensajes de WhatsApp"],
  ["/panel/servicios", "Servicios"],
  ["/panel/cursos", "Cursos y sesiones"],
  ["/panel/configuracion", "Configuración"],
];

// Panel de Andrea (A02 a A16). Las rutas están protegidas por el middleware y aquí se vuelve a comprobar la sesión.
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
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm lg:flex-1 lg:flex-col lg:overflow-visible">
          {MENU.map(([href, t]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2.5 text-[#e8dcc6] hover:bg-negro-800 hover:text-white">
              {t}
            </Link>
          ))}
        </nav>
        <div className="hidden px-5 pb-5 text-xs text-[#e8dcc6] lg:block">
          {modoWhatsApp() === "simulado" && <p className="mb-2 rounded-lg bg-aviso-100 px-2 py-1 font-semibold text-aviso-700">WhatsApp en modo simulado</p>}
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
