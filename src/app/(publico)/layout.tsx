import Link from "next/link";
import { Logo } from "@/componentes/ui";
import { sesionClienta } from "@/lib/sesion";
import { mostrarWhatsApp } from "@/lib/telefono";
import { accionOlvidarme } from "./acciones";

// Interfaz pública mobile-first (RNF-01), páginas P01 a P13.
export default async function LayoutPublico({ children }: { children: React.ReactNode }) {
  const clienta = await sesionClienta();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col bg-crema-50 shadow-sm">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-linea-200 bg-white/95 px-4 py-3 backdrop-blur">
        <Link href="/" aria-label="Inicio">
          <Logo />
        </Link>
        <Link href="/solicitar/servicio" className="btn-primario px-4 py-2 text-xs">
          Solicitar
        </Link>
      </header>
      {clienta && (
        // RN-01.3: nombre y WhatsApp visibles durante el uso
        <div className="flex items-center justify-between gap-2 bg-crema-300 px-4 py-2 text-xs text-texto-900">
          <span>
            <strong>{clienta.nombre}</strong> · {mostrarWhatsApp(clienta.whatsapp)}
          </span>
          <form action={accionOlvidarme}>
            <button className="font-semibold text-oro-700 hover:underline">No soy yo</button>
          </form>
        </div>
      )}
      <main className="flex-1 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-[560px] -translate-x-1/2 grid-cols-5 border-t border-linea-200 bg-white text-center text-[13px]">
        {[
          ["/", "Inicio"],
          ["/servicios", "Servicios"],
          ["/cursos", "Cursos"],
          ["/catalogo", "Catálogo"],
          ["/historial", "Historial"],
        ].map(([href, t]) => (
          <Link key={href} href={href} className="py-3.5 text-[12px] font-medium sm:text-[13px] text-gris-600 hover:text-oro-700">
            {t}
          </Link>
        ))}
      </nav>
    </div>
  );
}
