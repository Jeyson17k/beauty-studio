import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { servicio } from "@/modulos/catalogo";
import { moneda } from "@/lib/tiempo";
import { PildorasNumeradas } from "@/componentes/publico";

export const dynamic = "force-dynamic";

// P03 Detalle de servicio
export default async function DetalleServicio({ params }: { params: Promise<{ id: string }> }) {
  const s = await servicio(Number((await params).id));
  if (!s || !s.activo) notFound();
  return (
    <div className="bg-negro-950 text-white">
      <div className="contenedor grid gap-8 py-8 md:grid-cols-2 md:items-center md:py-14">
        {s.imagen_url && (
          <div className="overflow-hidden rounded-3xl border border-oro-300/40">
            <Image src={s.imagen_url} alt={s.nombre} width={800} height={800} className="aspect-square w-full object-cover md:max-h-[520px]" priority />
          </div>
        )}
        <div>
          <Link href="/servicios" className="text-sm font-semibold text-oro-300 hover:underline">
            ← Servicios
          </Link>
          <h1 className="titulo-grande mt-2 text-4xl md:text-5xl">{s.nombre}</h1>
          <span aria-hidden className="oro-degradado mt-3 block h-1 w-16 rounded-full" />
          <p className="mt-4 text-[15px] text-white/80">{s.descripcion}</p>
          <p className="mt-4 font-titulo text-2xl font-semibold text-oro-300">{s.precio_base ? `Desde ${moneda(s.precio_base)}` : "Precio según cotización"}</p>
          <div className="mt-6">
            <PildorasNumeradas
              destacado={-1}
              items={["Puedes pedirlo en el local o a domicilio.", "Para apartar la fecha se paga un anticipo del 10 % dentro de 24 horas.", "El saldo se paga el día de la atención."]}
            />
          </div>
          <Link href={`/solicitar/servicio?servicio=${s.id}`} className="btn oro-degradado mt-8 w-full px-7 py-3 text-sm uppercase tracking-wider text-negro-950 sm:w-auto">
            Solicitar este servicio
          </Link>
        </div>
      </div>
    </div>
  );
}
