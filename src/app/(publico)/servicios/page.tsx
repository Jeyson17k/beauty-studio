import Link from "next/link";
import Image from "next/image";
import { serviciosActivos } from "@/modulos/catalogo";
import { moneda } from "@/lib/tiempo";
import { EncabezadoPagina } from "@/componentes/publico";

export const dynamic = "force-dynamic";
export const metadata = { title: "Servicios" };

// P02 Servicios (solo los activos, RN-03.3)
export default async function Servicios() {
  const servicios = await serviciosActivos();
  return (
    <div>
      <EncabezadoPagina
        titulo="Servicios de belleza"
        subtitulo="El precio final lo define Andrea en tu cotización, según el trabajo, las fotos de referencia y el lugar."
      />
      <div className="contenedor grid gap-5 py-8 sm:grid-cols-2 md:py-12 lg:grid-cols-3">
        {servicios.map((s) => (
          <Link key={s.id} href={`/servicios/${s.id}`} className="group tarjeta flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
            {s.imagen_url && (
              <div className="relative">
                <Image src={s.imagen_url} alt="" width={444} height={312} className="h-52 w-full object-cover" />
                <span className="cinta oro-degradado absolute bottom-3 left-0 py-1 pl-3 pr-6 text-xs font-semibold text-negro-950">
                  {s.precio_base ? `Desde ${moneda(s.precio_base)}` : "Precio según cotización"}
                </span>
              </div>
            )}
            <div className="flex flex-1 flex-col p-5">
              <p className="font-titulo text-xl font-semibold uppercase tracking-wide">{s.nombre}</p>
              <p className="mt-1 flex-1 text-sm text-gris-600">{s.descripcion}</p>
              {!s.imagen_url && (
                <p className="mt-2 text-xs font-semibold text-oro-700">{s.precio_base ? `Desde ${moneda(s.precio_base)}` : "Precio según cotización"}</p>
              )}
              <p className="mt-4 text-sm font-semibold text-oro-700 group-hover:underline">Ver detalle →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
