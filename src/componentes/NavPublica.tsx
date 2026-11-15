"use client";
// Navegación de la parte pública: barra superior en computadora y barra inferior fija en el teléfono.
import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES: [string, string, string][] = [
  ["/", "Inicio", "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"],
  ["/servicios", "Servicios", "M12 3l2.4 5 5.6.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.6-.8z"],
  ["/cursos", "Cursos", "M3 8l9-4 9 4-9 4zm4 2.5V15c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5"],
  ["/catalogo", "Catálogo", "M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0"],
  ["/disponibilidad", "Agenda", "M5 5h14v15H5zM5 9h14M9 3v4M15 3v4"],
  ["/historial", "Historial", "M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"],
];

function activo(ruta: string, href: string) {
  return href === "/" ? ruta === "/" : ruta.startsWith(href);
}

export function NavEscritorio() {
  const ruta = usePathname();
  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
      {ENLACES.map(([href, t]) => (
        <Link
          key={href}
          href={href}
          className={`rounded-full px-3.5 py-2 font-titulo text-[13px] font-medium uppercase tracking-[0.14em] transition ${
            activo(ruta, href) ? "bg-white/10 text-oro-200" : "text-white/70 hover:text-oro-200"
          }`}
        >
          {t}
        </Link>
      ))}
    </nav>
  );
}

export function NavMovil() {
  const ruta = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-white/10 bg-negro-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Principal"
    >
      {ENLACES.map(([href, t, d]) => {
        const a = activo(ruta, href);
        return (
          <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium ${a ? "text-oro-300" : "text-white/60"}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={d} />
            </svg>
            {t}
          </Link>
        );
      })}
    </nav>
  );
}
