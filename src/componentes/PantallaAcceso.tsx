import type { ReactNode } from "react";

// Posiciones fijas de las centellas (sin azar para que servidor y navegador dibujen lo mismo).
const CENTELLAS = [
  { x: "8%", y: "14%", d: "0s", s: 1 }, { x: "22%", y: "72%", d: "1.2s", s: 0.7 }, { x: "34%", y: "28%", d: "2.4s", s: 1.2 }, { x: "48%", y: "88%", d: "0.6s", s: 0.8 },
  { x: "58%", y: "10%", d: "3.1s", s: 0.9 }, { x: "71%", y: "58%", d: "1.8s", s: 1.1 }, { x: "84%", y: "20%", d: "0.3s", s: 0.7 }, { x: "92%", y: "76%", d: "2.9s", s: 1 },
  { x: "14%", y: "46%", d: "3.6s", s: 0.6 }, { x: "63%", y: "36%", d: "2s", s: 0.8 }, { x: "40%", y: "58%", d: "0.9s", s: 0.6 }, { x: "78%", y: "92%", d: "1.5s", s: 0.9 },
];
const CHIPS = ["Solicitudes", "Cotizaciones", "Agenda", "Comprobantes", "WhatsApp"];

/** Escudo AP con anillos que giran y ondas suaves. */
function Emblema({ tam = 112 }: { tam?: number }) {
  return (
    <div className="relative grid place-items-center" style={{ width: tam, height: tam }}>
      <span className="acc-aro" />
      <span className="acc-aro" style={{ "--d": "1.8s" } as React.CSSProperties} />
      <svg className="acc-giro-lento absolute inset-0" viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="acc-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f1ddb0" />
            <stop offset=".55" stopColor="#c9a25e" />
            <stop offset="1" stopColor="#9c7a3c" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="47" fill="none" stroke="url(#acc-g)" strokeWidth="1.6" strokeDasharray="2 5" strokeLinecap="round" />
      </svg>
      <svg className="acc-giro-inverso absolute inset-0" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="42" fill="none" stroke="url(#acc-g)" strokeWidth="2" strokeDasharray="60 204" strokeLinecap="round" />
      </svg>
      <div className="grid place-items-center rounded-full border-2 border-oro-300 bg-negro-900 font-titulo font-semibold text-oro-300" style={{ width: tam * 0.68, height: tam * 0.68, fontSize: tam * 0.26 }}>
        AP
      </div>
    </div>
  );
}

/** Marco compartido del inicio de sesión y de la recuperación de la cuenta: fondo animado, marca y tarjeta. */
export function PantallaAcceso({ children }: { children: ReactNode }) {
  return (
    <div className="acc-fondo relative min-h-dvh overflow-hidden text-white">
      {/* Fondo: manchas de luz dorada que flotan y centellas */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="acc-blob" style={{ left: "-8%", top: "-12%", width: 420, height: 420, background: "#9c7a3c" }} />
        <span className="acc-blob" style={{ right: "-10%", top: "18%", width: 360, height: 360, background: "#c9a25e", animationDelay: "-5s", animationDuration: "19s" }} />
        <span className="acc-blob" style={{ left: "30%", bottom: "-18%", width: 460, height: 460, background: "#6b4f1d", animationDelay: "-9s", animationDuration: "22s" }} />
        {CENTELLAS.map((c, i) => (
          <span key={i} className="acc-centella" style={{ left: c.x, top: c.y, ["--d" as string]: c.d, transform: `scale(${c.s})` }} />
        ))}
      </div>

      <div className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        {/* Marca */}
        <section className="text-center lg:text-left">
          <div className="acc-subir flex justify-center lg:justify-start">
            <Emblema tam={118} />
          </div>
          <p className="acc-subir mt-6 font-titulo text-xs font-medium uppercase tracking-[0.42em] text-oro-300" style={{ ["--d" as string]: "0.15s" }}>
            Andrea Paola · Beauty Studio
          </p>
          <h1 className="acc-subir titulo-grande mt-3 text-4xl sm:text-5xl lg:text-6xl" style={{ ["--d" as string]: "0.25s" }}>
            Panel de <span className="texto-oro">administración</span>
          </h1>
          <div className="acc-linea-oro mx-auto mt-5 lg:mx-0" />
          <p className="acc-subir mt-5 max-w-md text-base text-white/70 lg:text-lg" style={{ ["--d" as string]: "0.45s" }}>
            Solicitudes, cotizaciones, comprobantes y agenda en un solo lugar.
          </p>
          <ul className="mt-7 hidden flex-wrap gap-2.5 lg:flex">
            {CHIPS.map((c, i) => (
              <li key={c} className="acc-subir" style={{ ["--d" as string]: `${0.6 + i * 0.1}s` }}>
                <span className="acc-chip inline-block rounded-full border border-oro-300/40 bg-white/5 px-4 py-1.5 text-sm text-oro-200 backdrop-blur" style={{ ["--d" as string]: `${i * 0.7}s` }}>
                  {c}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-10 hidden text-xs text-white/40 lg:block">Los Cedros, León · Nicaragua</p>
        </section>

        {/* Tarjeta del formulario */}
        <section className="acc-subir mx-auto w-full max-w-md" style={{ ["--d" as string]: "0.3s" }}>
          <div className="acc-tarjeta rounded-3xl p-7 text-texto-900 sm:p-9">{children}</div>
          <p className="mt-5 text-center text-xs text-white/40">Acceso solo para la administradora.</p>
        </section>
      </div>
    </div>
  );
}
