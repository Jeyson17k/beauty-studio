import Link from "next/link";
import Image from "next/image";
import { cursosActivos, serviciosActivos } from "@/modulos/catalogo";

export const dynamic = "force-dynamic";

// P01 Inicio
export default async function Inicio() {
  const [servicios, cursos] = await Promise.all([serviciosActivos(), cursosActivos()]);
  return (
    <div>
      <section className="flex items-center gap-4 bg-crema-300 px-5 py-7">
        <div className="flex-1">
          <h1 className="text-2xl font-bold leading-tight">Maquillaje y peinado para tu momento especial</h1>
          <p className="mt-2 text-sm text-gris-600">Andrea Paola · Los Cedros, León</p>
          <Link href="/solicitar/servicio" className="btn-primario mt-5 w-full sm:w-auto">
            Solicitar cotización
          </Link>
        </div>
        <Image src="/img/hero_portrait.jpg" alt="Andrea Paola" width={120} height={150} className="h-[150px] w-[110px] rounded-[60px] border-2 border-oro-200 object-cover" priority />
      </section>

      <section className="px-5 pt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="titulo-seccion">Servicios</h2>
          <Link href="/servicios" className="text-sm font-semibold text-oro-700">
            Ver todos
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {servicios.slice(0, 4).map((s) => (
            <Link key={s.id} href={`/servicios/${s.id}`} className="tarjeta overflow-hidden">
              {s.imagen_url && <Image src={s.imagen_url} alt={s.nombre} width={300} height={200} className="h-28 w-full object-cover" />}
              <div className="p-3">
                <p className="font-semibold">{s.nombre}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gris-600">{s.descripcion}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-5 pt-6">
        <h2 className="titulo-seccion">Cursos de maquillaje</h2>
        <Link href="/cursos" className="tarjeta mt-3 flex items-center gap-3 p-3">
          <Image src="/img/course_sq.jpg" alt="" width={70} height={70} className="h-[70px] w-[70px] rounded-xl object-cover" />
          <div>
            <p className="font-semibold">Clases individuales y grupales</p>
            <p className="text-xs text-gris-600">Sesiones de 3 horas. Mira cupos y fechas. ({cursos.length} cursos)</p>
          </div>
        </Link>
      </section>

      <section className="px-5 pt-6">
        <h2 className="titulo-seccion">¿Cómo funciona?</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {[
            "Envías tu solicitud con la fecha, la hora y, si quieres, fotos de referencia.",
            "Andrea la revisa y te envía la cotización por WhatsApp.",
            "Pagas el anticipo del 10 % dentro de 24 horas y le envías el comprobante por WhatsApp.",
            "Andrea verifica el pago y confirma tu cita. El saldo se paga el día de la atención.",
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-negro-900 text-xs font-bold text-oro-300">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <Link href="/disponibilidad" className="btn-borde mt-5 w-full">
          Ver horarios ocupados
        </Link>
      </section>
    </div>
  );
}
