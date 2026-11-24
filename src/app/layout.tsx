import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MensajesValidacion } from "@/componentes/MensajesValidacion";
import { datosNegocio } from "@/lib/negocio";

export async function generateMetadata(): Promise<Metadata> {
  const n = await datosNegocio();
  return {
    title: { default: n.ciudad ? `${n.nombre} · ${n.ciudad}` : n.nombre, template: `%s · ${n.nombre}` },
    description: `Servicios de belleza, productos y cursos${n.ciudad ? ` en ${n.ciudad}` : ""}. Solicita tu cotización en línea.`,
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#14110d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">
        <MensajesValidacion />
        {children}
      </body>
    </html>
  );
}
