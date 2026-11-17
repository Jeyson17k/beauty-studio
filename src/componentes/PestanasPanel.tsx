import Link from "next/link";

// Pestañas dentro de un apartado del panel (por ejemplo «Pedidos e inventario» o «Ventas y gastos»).
export function PestanasPanel({ pestanas, activa }: { pestanas: [href: string, texto: string][]; activa: string }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2 border-b border-linea-200 bg-white px-6 pb-3 pt-3 text-sm lg:px-8">
      {pestanas.map(([href, texto]) => (
        <Link
          key={href}
          href={href}
          role="tab"
          aria-selected={href === activa}
          className={`rounded-full border px-4 py-1.5 font-semibold ${
            href === activa ? "border-oro-700 bg-negro-900 text-oro-200" : "border-linea-200 bg-white text-gris-600 hover:border-oro-700"
          }`}
        >
          {texto}
        </Link>
      ))}
    </div>
  );
}

export const PESTANAS_INVENTARIO: [string, string][] = [
  ["/panel/pedidos", "Pedidos"],
  ["/panel/productos", "Productos e inventario"],
];
export const PESTANAS_FINANZAS: [string, string][] = [
  ["/panel/ventas", "Ventas"],
  ["/panel/gastos", "Gastos"],
  ["/panel/reportes", "Reportes"],
];
