import Link from "next/link";
import { tonoEstado } from "@/modulos/estados";

const TONOS = {
  info: "bg-info-100 text-info-700",
  warn: "bg-aviso-100 text-aviso-700",
  err: "bg-error-100 text-error-700",
  ok: "bg-ok-100 text-ok-700",
  n: "bg-[#eee8dc] text-gris-600",
};

export function Etiqueta({ texto, tono }: { texto: string; tono?: keyof typeof TONOS }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONOS[tono ?? tonoEstado(texto)]}`}>{texto}</span>;
}

export function Aviso({ tono = "info", children }: { tono?: keyof typeof TONOS; children: React.ReactNode }) {
  return <div className={`rounded-xl px-4 py-3 text-sm ${TONOS[tono]}`} role={tono === "err" ? "alert" : "status"}>{children}</div>;
}

export function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gris-600">{etiqueta}</dt>
      <dd className="mt-0.5 text-[15px]">{children}</dd>
    </div>
  );
}

export function EncabezadoPanel({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-linea-200 bg-white px-6 py-4 lg:px-8">
      <h1 className="text-xl font-bold">{titulo}</h1>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-linea-200 px-4 py-6 text-center text-sm text-gris-600">{children}</p>;
}

export function Volver({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-semibold text-oro-700 hover:underline">
      ← {children}
    </Link>
  );
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`grid h-9 w-9 place-items-center rounded-full border-2 border-oro-300 text-sm font-bold ${claro ? "bg-negro-900 text-oro-300" : "bg-negro-900 text-oro-300"}`}>AP</span>
      <span className={`text-[17px] font-bold ${claro ? "text-white" : "text-texto-900"}`}>Beauty Studio</span>
    </span>
  );
}
