/** Foto del producto o, si no tiene, un recuadro con sus iniciales. */
export function FotoProducto({ url, nombre, className = "" }: { url: string | null; nombre: string; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nombre} className={`object-cover ${className}`} />;
  }
  const ini = nombre.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return <div className={`grid place-items-center bg-crema-300 text-xl font-bold text-oro-700 ${className}`}>{ini}</div>;
}
