import Link from "next/link";
import { q1 } from "@/lib/db";
import { sesionClienta } from "@/lib/sesion";
import { fechaHora } from "@/lib/tiempo";
import { Etiqueta } from "@/componentes/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitud registrada" };

// P10 Solicitud registrada. Solo se muestra a la clienta que la creó (RN-02.3).
export default async function Listo({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const [{ id }, clienta] = await Promise.all([searchParams, sesionClienta()]);
  const s =
    clienta && id
      ? await q1<{ id: number; estado: string; actividad: string; inicio: Date | null }>(
          `SELECT s.id, s.estado, COALESCE(sv.nombre, cu.nombre) AS actividad, COALESCE(s.inicio_solicitado, ses.inicio) AS inicio
           FROM solicitud_actividad s LEFT JOIN servicio sv ON sv.id = s.servicio_id LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id LEFT JOIN curso cu ON cu.id = ses.curso_id
           WHERE s.id = $1 AND s.cliente_id = $2`,
          [Number(id), clienta.cid],
        )
      : null;
  return (
    <div className="contenedor py-12 text-center md:py-16">
      <div className="hexagono oro-degradado mx-auto grid h-20 w-24 place-items-center text-4xl text-negro-950">✓</div>
      <h1 className="titulo-grande mt-5 text-3xl md:text-4xl">¡Solicitud enviada!</h1>
      {s && (
        <div className="tarjeta mx-auto mt-5 max-w-sm p-4 text-left text-sm">
          <p className="font-semibold">
            #{s.id} · {s.actividad}
          </p>
          <p className="mt-1 text-gris-600">{fechaHora(s.inicio)}</p>
          <div className="mt-2">
            <Etiqueta texto={s.estado} />
          </div>
        </div>
      )}
      <p className="mx-auto mt-5 max-w-sm text-[15px]">
        Andrea revisará tu solicitud y te enviará la cotización por WhatsApp. Tu horario todavía no está apartado: se aparta cuando recibes la cotización y se
        confirma cuando Andrea verifica tu anticipo.
      </p>
      <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2 sm:max-w-md sm:flex-row sm:justify-center">
        <Link href="/historial" className="btn-borde">
          Ver mi historial
        </Link>
        <Link href="/" className="btn-primario">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
