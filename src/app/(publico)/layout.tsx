import Link from "next/link";
import { LogoPublico, PiePublico } from "@/componentes/publico";
import { NavEscritorio, NavMovil } from "@/componentes/NavPublica";
import { sesionClienta, sesionPerfilClienta } from "@/lib/sesion";
import { mostrarWhatsApp } from "@/lib/telefono";
import { leerConfig } from "@/lib/config";
import { cantidadCarrito } from "@/modulos/pedidos";
import { accionOlvidarme } from "./acciones";

// Interfaz pública P01 a P18: se adapta al teléfono (barra inferior) y a la computadora (barra superior) (RNF-01).
export default async function LayoutPublico({ children }: { children: React.ReactNode }) {
  const [clienta, config, perfil] = await Promise.all([sesionClienta(), leerConfig(), sesionPerfilClienta()]);
  const enCarrito = clienta ? await cantidadCarrito(clienta.cid) : 0;
  return (
    <div className="flex min-h-dvh flex-col bg-crema-50">
      {perfil && (
        // Andrea viendo la página como clienta: para volver al panel se pide la contraseña
        <div className="bg-oro-200 text-negro-950">
          <div className="contenedor flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs">
            <span>
              Estás viendo la página como <strong>clienta</strong> ({perfil.usuario}).
            </span>
            <Link href="/cambiar-perfil?a=admin" className="font-bold underline">
              Cambiar a perfil de administradora
            </Link>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-negro-950/95 backdrop-blur">
        <div className="contenedor flex items-center justify-between gap-4 py-3">
          <Link href="/" aria-label="Inicio">
            <LogoPublico />
          </Link>
          <NavEscritorio />
          <div className="flex items-center gap-2">
            <Link href="/carrito" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-white/70 hover:text-oro-200">
              Carrito
              {enCarrito > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-oro-300 px-1 text-[11px] font-bold text-negro-950">{enCarrito}</span>}
            </Link>
            <Link href="/solicitar/servicio" className="btn oro-degradado px-4 py-2 text-xs uppercase tracking-wider text-negro-950 hover:brightness-105 md:px-5">
              Solicitar cita
            </Link>
          </div>
        </div>
        {clienta && (
          // RN-01.3: nombre y WhatsApp visibles durante el uso
          <div className="border-t border-white/10 bg-negro-800">
            <div className="contenedor flex items-center justify-between gap-2 py-1.5 text-xs text-white/80">
              <span>
                Hola, <strong className="text-oro-200">{clienta.nombre}</strong> · {mostrarWhatsApp(clienta.whatsapp)}
              </span>
              <form action={accionOlvidarme}>
                <button className="font-semibold text-oro-300 hover:underline">No soy yo</button>
              </form>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <div className="pb-[72px] lg:pb-0">
        <PiePublico whatsapp={config.whatsapp_negocio} />
      </div>
      <NavMovil />
    </div>
  );
}
