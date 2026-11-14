import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Beauty Studio · Andrea Paola", template: "%s · Beauty Studio" },
  description: "Maquillaje, peinado y cursos con Andrea Paola en Los Cedros, León. Solicita tu cotización.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#14110d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
