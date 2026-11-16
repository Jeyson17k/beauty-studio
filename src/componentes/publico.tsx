// Piezas visuales de la parte pública (clientas). Estilo inspirado en el video de referencia
// (títulos grandes en mayúsculas, insignias hexagonales numeradas, cintas y píldoras),
// con los colores de la marca Beauty Studio: negro, oro y crema. El panel de Andrea no las usa.
import Link from "next/link";

export function LogoPublico() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-oro-300 bg-negro-950 font-titulo text-sm font-semibold tracking-wider text-oro-300">
        AP
      </span>
      <span className="leading-none">
        <span className="block font-titulo text-[17px] font-semibold uppercase tracking-[0.12em] text-white">Beauty Studio</span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.25em] text-oro-300">Andrea Paola</span>
      </span>
    </span>
  );
}

/** Insignia de sección: número en hexágono dorado + cinta con el título (como «① EQUIPO DE TRABAJO» del video). */
export function InsigniaSeccion({ numero, titulo, claro = false }: { numero: number; titulo: string; claro?: boolean }) {
  return (
    <div className="flex items-center">
      <span className="hexagono oro-degradado relative z-10 grid h-12 w-14 shrink-0 place-items-center font-titulo text-xl font-bold text-negro-950">{numero}</span>
      <span
        className={`cinta -ml-3 py-2 pl-6 pr-8 font-titulo text-sm font-semibold uppercase tracking-[0.18em] sm:text-base ${
          claro ? "bg-negro-900 text-oro-200" : "bg-white/10 text-oro-200 ring-1 ring-white/10"
        }`}
      >
        {titulo}
      </span>
    </div>
  );
}

/** Banda oscura con el título de cada página interior. */
export function EncabezadoPagina({
  titulo,
  subtitulo,
  volver,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  volver?: { href: string; texto: string };
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-negro-950 text-white">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-oro-400/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-oro-500/10 blur-3xl" />
      <div className="contenedor relative py-8 md:py-12">
        {volver && (
          <Link href={volver.href} className="text-sm font-semibold text-oro-300 hover:underline">
            ← {volver.texto}
          </Link>
        )}
        <h1 className="titulo-grande mt-1 text-3xl md:text-5xl">{titulo}</h1>
        <span aria-hidden className="oro-degradado mt-3 block h-1 w-16 rounded-full" />
        {subtitulo && <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">{subtitulo}</p>}
        {children}
      </div>
    </section>
  );
}

/** Lista numerada en píldoras (como el bloque «FUNCIONES» del video). El elemento destacado lleva la flecha. */
export function PildorasNumeradas({ items, destacado = 0, oscuro = true }: { items: React.ReactNode[]; destacado?: number; oscuro?: boolean }) {
  return (
    <ol className="space-y-2.5">
      {items.map((t, i) => {
        const activo = i === destacado;
        return (
          <li key={i} className="flex items-center gap-3">
            <span
              className={`flex min-h-12 flex-1 items-center gap-3 rounded-full px-2 py-1.5 pr-5 text-sm md:text-[15px] ${
                activo ? "oro-degradado font-semibold text-negro-950" : oscuro ? "bg-white/[0.07] text-white/90 ring-1 ring-white/10" : "bg-white text-texto-900 ring-1 ring-linea-200"
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-titulo text-sm font-bold ${
                  activo ? "bg-negro-950 text-oro-300" : oscuro ? "bg-white/10 text-oro-300" : "bg-negro-900 text-oro-300"
                }`}
              >
                {i + 1}
              </span>
              <span>{t}</span>
            </span>
            <span aria-hidden className={`hidden w-8 text-2xl leading-none md:block ${activo ? "text-oro-300" : "text-transparent"}`}>
              ⟵
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function PiePublico({ whatsapp }: { whatsapp: string }) {
  const numero = whatsapp.replace("+", "");
  return (
    <footer className="bg-negro-950 text-white/70">
      <div className="contenedor grid gap-8 py-10 text-sm md:grid-cols-3">
        <div>
          <LogoPublico />
          <p className="mt-4 max-w-xs">Maquillaje, peinado y cursos de maquillaje para tu momento especial.</p>
        </div>
        <div>
          <p className="font-titulo text-sm font-semibold uppercase tracking-[0.18em] text-oro-300">Visítanos</p>
          <p className="mt-3">Los Cedros, Carretera Vieja a León, Nicaragua</p>
          <p className="mt-1">Atención en el salón y a domicilio</p>
        </div>
        <div>
          <p className="font-titulo text-sm font-semibold uppercase tracking-[0.18em] text-oro-300">Escríbenos</p>
          <a href={`https://wa.me/${numero}`} target="_blank" rel="noreferrer" className="mt-3 inline-block hover:text-oro-200">
            WhatsApp {whatsapp.replace(/^\+505(\d{4})(\d{4})$/, "+505 $1-$2")}
          </a>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/solicitar/servicio" className="btn oro-degradado px-4 py-2 text-xs text-negro-950">
              Solicitar cotización
            </Link>
            <Link href="/disponibilidad" className="btn border border-white/20 px-4 py-2 text-xs text-white hover:border-oro-300">
              Ver disponibilidad
            </Link>
          </div>
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-white/40">© {new Date().getFullYear()} Andrea Paola · Beauty Studio ·{" "}
        <Link href="/panel/login" className="hover:text-oro-200">
          Acceso de administradora
        </Link>
      </p>
    </footer>
  );
}
