"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Opcion = { href: string; texto: string; rutas: string[] };

// Menú lateral del panel de Andrea: los 5 apartados del prototipo de Figma (M10) y, debajo, «Más opciones».
const PRINCIPAL: Opcion[] = [
  { href: "/panel", texto: "Panel de inicio", rutas: [] },
  { href: "/panel/solicitudes", texto: "Solicitudes", rutas: ["/panel/solicitudes"] },
  { href: "/panel/agenda", texto: "Agenda", rutas: ["/panel/agenda"] },
  { href: "/panel/pedidos", texto: "Pedidos e inventario", rutas: ["/panel/pedidos", "/panel/productos"] },
  { href: "/panel/ventas", texto: "Ventas y gastos", rutas: ["/panel/ventas", "/panel/gastos", "/panel/reportes"] },
];

const MAS: Opcion[] = [
  { href: "/panel/registrar", texto: "Registrar por una clienta", rutas: ["/panel/registrar"] },
  { href: "/panel/servicios", texto: "Servicios", rutas: ["/panel/servicios"] },
  { href: "/panel/cursos", texto: "Cursos y sesiones", rutas: ["/panel/cursos"] },
  { href: "/panel/mensajes", texto: "Mensajes de WhatsApp", rutas: ["/panel/mensajes"] },
  { href: "/panel/configuracion", texto: "Configuración", rutas: ["/panel/configuracion"] },
];

const PRUEBA: Opcion = { href: "/panel/whatsapp-prueba", texto: "Teléfono de prueba", rutas: ["/panel/whatsapp-prueba"] };

export function MenuPanel({ simulado }: { simulado: boolean }) {
  const ruta = usePathname();
  const activa = (o: Opcion) => (o.href === "/panel" ? ruta === "/panel" : o.rutas.some((r) => ruta === r || ruta.startsWith(r + "/")));
  const enlace = (o: Opcion) => (
    <Link
      key={o.href}
      href={o.href}
      aria-current={activa(o) ? "page" : undefined}
      className={`whitespace-nowrap rounded-lg px-3 py-2.5 ${
        activa(o) ? "bg-negro-800 font-semibold text-oro-300" : "text-[#e8dcc6] hover:bg-negro-800 hover:text-white"
      }`}
    >
      {o.texto}
    </Link>
  );
  const mas = simulado ? [...MAS, PRUEBA] : MAS;
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
      {PRINCIPAL.map(enlace)}
      <p className="hidden px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-oro-300/70 lg:block">Más opciones</p>
      {mas.map(enlace)}
      <Link href="/cambiar-perfil?a=clienta" className="whitespace-nowrap rounded-lg px-3 py-2.5 font-semibold text-oro-300 lg:hidden">
        Ver como clienta
      </Link>
    </nav>
  );
}
