import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { servicio } from "@/modulos/catalogo";
import { moneda } from "@/lib/tiempo";
import { Volver } from "@/componentes/ui";

export const dynamic = "force-dynamic";

// P03 Detalle de servicio
export default async function DetalleServicio({ params }: { params: Promise<{ id: string }> }) {
  const s = await servicio(Number((await params).id));
  if (!s || !s.activo) notFound();
  return (
    <div>
      {s.imagen_url && <Image src={s.imagen_url} alt={s.nombre} width={560} height={320} className="h-64 w-full object-cover" priority />}
      <div className="px-5 py-5">
        <Volver href="/servicios">Servicios</Volver>
        <h1 className="mt-2 text-2xl font-bold">{s.nombre}</h1>
        <p className="mt-2 text-[15px]">{s.descripcion}</p>
        <p className="mt-3 text-sm font-semibold text-oro-700">{s.precio_base ? `Desde ${moneda(s.precio_base)}` : "Precio según cotización"}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-gris-600">
          <li>• Puedes pedirlo en el local o a domicilio.</li>
          <li>• Para apartar la fecha se paga un anticipo del 10 % dentro de 24 horas.</li>
          <li>• El saldo se paga el día de la atención.</li>
        </ul>
        <Link href={`/solicitar/servicio?servicio=${s.id}`} className="btn-primario mt-6 w-full">
          Solicitar este servicio
        </Link>
      </div>
    </div>
  );
}
