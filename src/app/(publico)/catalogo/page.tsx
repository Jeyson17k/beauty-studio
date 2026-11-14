import Link from "next/link";
import { catalogoPublico, categoriasProducto } from "@/modulos/inventario";
import { moneda } from "@/lib/tiempo";
import { Vacio } from "@/componentes/ui";
import { FotoProducto } from "@/componentes/FotoProducto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catálogo" };

// P14 Catálogo (CU-07, RF-20): productos activos con búsqueda y filtro; sin existencias exactas (RN-20.3).
export default async function Catalogo({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const sp = await searchParams;
  const [lista, cats] = await Promise.all([catalogoPublico({ texto: sp.q, categoria: Number(sp.cat) || undefined }), categoriasProducto()]);
  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-bold">Productos de belleza</h1>
      <form className="mt-4 flex gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Buscar producto" className="campo mt-0" />
        <button className="btn-primario px-4">Buscar</button>
      </form>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm">
        <Link href="/catalogo" className={`whitespace-nowrap rounded-full border px-3 py-1 ${!sp.cat ? "border-oro-700 bg-crema-300" : "border-linea-200 bg-white"}`}>
          Todos
        </Link>
        {cats.map((c) => (
          <Link key={c.id} href={`/catalogo?cat=${c.id}`} className={`whitespace-nowrap rounded-full border px-3 py-1 ${sp.cat === String(c.id) ? "border-oro-700 bg-crema-300" : "border-linea-200 bg-white"}`}>
            {c.nombre}
          </Link>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {lista.length === 0 && (
          <div className="col-span-2">
            <Vacio>No hay productos con esa búsqueda.</Vacio>
          </div>
        )}
        {lista.map((p) => (
          <Link key={p.id} href={`/catalogo/${p.id}`} className="tarjeta overflow-hidden">
            <FotoProducto url={p.foto_url} nombre={p.nombre} className="h-32 w-full" />
            <div className="p-3">
              <p className="text-xs text-gris-600">{p.categoria}</p>
              <p className="font-semibold leading-tight">{p.nombre}</p>
              <p className="mt-1 text-sm font-bold text-oro-700">{moneda(p.precio_venta)}</p>
              {p.agotado && <p className="text-xs font-semibold text-error-700">Agotado por ahora</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
