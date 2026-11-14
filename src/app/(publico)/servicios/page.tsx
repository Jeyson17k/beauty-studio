import Link from "next/link";
import Image from "next/image";
import { serviciosActivos } from "@/modulos/catalogo";
import { moneda } from "@/lib/tiempo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Servicios" };

// P02 Servicios (solo los activos, RN-03.3)
export default async function Servicios() {
  const servicios = await serviciosActivos();
  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-bold">Servicios de belleza</h1>
      <p className="mt-1 text-sm text-gris-600">El precio final lo define Andrea en tu cotización, según el trabajo, las fotos de referencia y el lugar.</p>
      <div className="mt-5 space-y-3">
        {servicios.map((s) => (
          <Link key={s.id} href={`/servicios/${s.id}`} className="tarjeta flex gap-3 p-3">
            {s.imagen_url && <Image src={s.imagen_url} alt="" width={96} height={96} className="h-24 w-24 rounded-xl object-cover" />}
            <div>
              <p className="font-semibold">{s.nombre}</p>
              <p className="mt-1 text-sm text-gris-600">{s.descripcion}</p>
              <p className="mt-1 text-xs font-semibold text-oro-700">{s.precio_base ? `Desde ${moneda(s.precio_base)}` : "Precio según cotización"}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
