import Link from "next/link";
import { catalogoPublico, categoriasProducto } from "@/modulos/inventario";
import { moneda } from "@/lib/tiempo";
import { Vacio } from "@/componentes/ui";
import { FotoProducto } from "@/componentes/FotoProducto";
import { EncabezadoPagina } from "@/componentes/publico";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catálogo" };

// P14 Catálogo (CU-07, RF-20): productos activos con búsqueda y filtro; sin existencias exactas (RN-20.3).
export default async function Catalogo({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const sp = await searchParams;
  const [lista, cats] = await Promise.all([catalogoPublico({ texto: sp.q, categoria: Number(sp.cat) || undefined }), categoriasProducto()]);
  return (
    <div>
      <EncabezadoPagina titulo="Productos de belleza" subtitulo="Arma tu pedido y envíaselo a Andrea por WhatsApp. Retiro en el local o delivery.">
        <form className="mt-5 flex max-w-xl gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Buscar producto" className="campo mt-0 border-white/20 bg-white/10 text-white placeholder:text-white/50" />
          <button className="btn oro-degradado px-5 text-negro-950">Buscar</button>
        </form>
      </EncabezadoPagina>
      <div className="contenedor py-6 md:py-10">
        <div className="flex gap-2 overflow-x-auto pb-1 text-sm">
          <Link href="/catalogo" className={`whitespace-nowrap rounded-full border px-4 py-1.5 ${!sp.cat ? "border-negro-900 bg-negro-900 text-oro-200" : "border-linea-200 bg-white"}`}>
            Todos
          </Link>
          {cats.map((c) => (
            <Link
              key={c.id}
              href={`/catalogo?cat=${c.id}`}
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 ${sp.cat === String(c.id) ? "border-negro-900 bg-negro-900 text-oro-200" : "border-linea-200 bg-white"}`}
            >
              {c.nombre}
            </Link>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {lista.length === 0 && (
            <div className="col-span-full">
              <Vacio>No hay productos con esa búsqueda.</Vacio>
            </div>
          )}
          {lista.map((p) => (
            <Link key={p.id} href={`/catalogo/${p.id}`} className="group tarjeta overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
              <FotoProducto url={p.foto_url} nombre={p.nombre} className="h-36 w-full md:h-48" />
              <div className="p-3 md:p-4">
                <p className="text-[11px] uppercase tracking-wider text-gris-600">{p.categoria}</p>
                <p className="font-semibold leading-tight">{p.nombre}</p>
                <p className="mt-1.5 font-titulo text-lg font-semibold text-oro-700">{moneda(p.precio_venta)}</p>
                {p.agotado && <p className="text-xs font-semibold text-error-700">Agotado por ahora</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
