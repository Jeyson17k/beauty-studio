"use client";
import { useMemo, useState } from "react";

export type Casilla = { i: string; f: string; t: "o" | "e" | "p"; e?: string };

// Nicaragua usa UTC−6 todo el año: se trabaja en «minutos locales» y se leen con los getters UTC.
const DESFASE = 6 * 3_600_000;
const aLocalMs = (iso: string) => Date.parse(iso) - DESFASE;
const pad = (n: number) => String(n).padStart(2, "0");
const clave = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const horaTxt = (ms: number) => {
  const d = new Date(ms);
  const h = d.getUTCHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getUTCMinutes())} ${h < 12 ? "a. m." : "p. m."}`;
};
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const HORA_INICIO = 0; // Andrea atiende las 24 horas del día (RN-05.11)
const HORA_FIN = 24 * 60; // última hora de inicio: 11:30 p. m.
const PASO = 30;

/**
 * Calendario para elegir día y hora (RF-05, RN-05.1, RN-05.6, RN-05.7).
 * Los horarios ocupados y los pendientes de pago (apartado de 24 h) se bloquean; las solicitudes pendientes de revisión no bloquean y solo se muestran a Andrea.
 * Envía el valor como «AAAA-MM-DDTHH:mm» en el campo `nombre`, igual que un datetime-local.
 */
export function SelectorCalendario({ nombre = "inicio", casillas, minimo, duracionMin = 30, detalle = false }: { nombre?: string; casillas: Casilla[]; minimo: string; duracionMin?: number; detalle?: boolean }) {
  const minimoMs = Date.parse(`${minimo}:00Z`); // «minimo» ya viene en hora local
  const hoyClave = clave(minimoMs);
  const [mes, setMes] = useState(() => {
    const d = new Date(minimoMs);
    return { a: d.getUTCFullYear(), m: d.getUTCMonth() };
  });
  const [dia, setDia] = useState<string | null>(null);
  const [hora, setHora] = useState<number | null>(null);

  const filas = useMemo(() => casillas.map((c) => ({ ...c, ini: aLocalMs(c.i), fin: aLocalMs(c.f) })), [casillas]);
  const pagoSolo = (k: string) => filas.filter((c) => clave(c.ini) === k).every((c) => c.t === "e");
  const ocupadoDia = (k: string) => filas.some((c) => clave(c.ini) === k || (clave(c.ini) < k && clave(c.fin - 1) >= k));

  const primero = Date.UTC(mes.a, mes.m, 1);
  const vacios = (new Date(primero).getUTCDay() + 6) % 7;
  const diasMes = new Date(Date.UTC(mes.a, mes.m + 1, 0)).getUTCDate();
  const celdas: (string | null)[] = [...Array(vacios).fill(null), ...Array.from({ length: diasMes }, (_, i) => `${mes.a}-${pad(mes.m + 1)}-${pad(i + 1)}`)];
  const mover = (n: number) => setMes((x) => { const d = new Date(Date.UTC(x.a, x.m + n, 1)); return { a: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const esActual = mes.a === new Date(minimoMs).getUTCFullYear() && mes.m === new Date(minimoMs).getUTCMonth();

  const franjas = useMemo(() => {
    if (!dia) return [];
    const base = Date.parse(`${dia}T00:00:00Z`);
    const lista: { min: number; ms: number; estado: "libre" | "ocupada" | "pasada"; pendiente: boolean; proceso: boolean }[] = [];
    for (let min = HORA_INICIO; min <= HORA_FIN - PASO; min += PASO) {
      const ms = base + min * 60_000;
      const fin = ms + duracionMin * 60_000;
      const choca = filas.some((c) => c.t !== "p" && ms < c.fin && fin > c.ini);
      const proceso = filas.some((c) => c.t === "e" && ms < c.fin && fin > c.ini);
      const pendiente = filas.some((c) => c.t === "p" && ms < c.fin && fin > c.ini);
      lista.push({ min, ms, estado: ms < minimoMs ? "pasada" : choca ? "ocupada" : "libre", pendiente, proceso });
    }
    return lista;
  }, [dia, filas, duracionMin, minimoMs]);

  const delDia = dia ? filas.filter((c) => clave(c.ini) === dia || (clave(c.ini) < dia && clave(c.fin - 1) >= dia)).sort((a, b) => a.ini - b.ini) : [];
  const valor = dia && hora !== null ? `${dia}T${pad(Math.floor(hora / 60))}:${pad(hora % 60)}` : "";
  const elegidaTxt = dia && hora !== null ? `${Number(dia.slice(8))} de ${MESES[Number(dia.slice(5, 7)) - 1]} de ${dia.slice(0, 4)}, ${horaTxt(Date.parse(`${dia}T00:00:00Z`) + hora * 60_000)}` : "";

  return (
    <div className="relative rounded-2xl border border-linea-200 bg-white p-3 sm:p-4">
      <input name={nombre} value={valor} onChange={() => {}} required tabIndex={-1} aria-hidden className="pointer-events-none absolute h-0 w-0 opacity-0" />
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => mover(-1)} disabled={esActual} className="btn-borde px-3 py-1 text-sm disabled:opacity-30" aria-label="Mes anterior">
          ←
        </button>
        <p className="font-titulo text-base font-semibold capitalize">
          {MESES[mes.m]} {mes.a}
        </p>
        <button type="button" onClick={() => mover(1)} className="btn-borde px-3 py-1 text-sm" aria-label="Mes siguiente">
          →
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-gris-600">
        {DIAS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {celdas.map((k, i) => {
          if (!k) return <span key={i} />;
          const pasado = k < hoyClave;
          const ocup = ocupadoDia(k);
          const sel = dia === k;
          return (
            <button
              key={k}
              type="button"
              disabled={pasado}
              onClick={() => { setDia(k); setHora(null); }}
              className={`relative h-10 rounded-lg text-sm font-semibold transition ${sel ? "bg-negro-950 text-white" : pasado ? "text-gris-600/40" : "bg-crema-100 hover:bg-crema-300"} ${k === hoyClave && !sel ? "ring-2 ring-oro-300" : ""}`}
            >
              {Number(k.slice(8))}
              {ocup && !pasado && <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${sel ? "bg-oro-300" : pagoSolo(k) ? "bg-aviso-700" : "bg-error-700"}`} />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gris-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-error-700" /> Día con horarios ocupados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-aviso-700" /> {detalle ? "Pendiente de pago (24 h para el anticipo) o solicitud por revisar" : "Día con horarios pendientes de pago"}
        </span>
      </div>

      {dia && (
        <div className="mt-4 border-t border-linea-200 pt-4">
          <p className="etiqueta-campo">Elige la hora · {Number(dia.slice(8))} de {MESES[Number(dia.slice(5, 7)) - 1]}</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {franjas.map((f) => {
              const sel = hora === f.min;
              const off = f.estado !== "libre";
              return (
                <button
                  key={f.min}
                  type="button"
                  disabled={off}
                  onClick={() => setHora(f.min)}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold ${sel ? "border-negro-950 bg-negro-950 text-white" : f.estado === "ocupada" ? (f.proceso ? "border-aviso-100 bg-aviso-100 text-aviso-700 line-through" : "border-error-100 bg-error-100 text-error-700 line-through") : off ? "border-linea-200 text-gris-600/40" : f.pendiente && detalle ? "border-aviso-700 bg-aviso-100 text-aviso-700" : "border-linea-200 bg-white hover:border-oro-700"}`}
                >
                  {horaTxt(f.ms)}
                </button>
              );
            })}
          </div>
          {delDia.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {delDia.map((c, i) => (
                <li key={i} className={`rounded-lg px-2.5 py-1.5 ${c.t === "o" ? "bg-error-100 text-error-700" : "bg-aviso-100 text-aviso-700"}`}>
                  <span className="font-semibold">
                    {horaTxt(c.ini)} – {horaTxt(c.fin)}
                  </span>{" "}
                  {c.t === "o" ? "Ocupado" : c.t === "e" ? "Pendiente de pago" : "Por revisar"}
                  {detalle && c.e ? ` · ${c.e}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-3 rounded-lg bg-crema-100 px-3 py-2 text-sm">
        {elegidaTxt ? (
          <>
            Elegiste: <span className="font-semibold">{elegidaTxt}</span>
          </>
        ) : (
          <span className="text-gris-600">Toca un día y luego una hora.</span>
        )}
      </p>
    </div>
  );
}
