import Link from "next/link";
import { EncabezadoPanel } from "@/componentes/ui";

export const metadata = { title: "Registrar por una clienta" };

const OPCIONES = [
  { href: "/panel/solicitudes/nueva?tipo=servicio", titulo: "Cita de servicio", texto: "Maquillaje, peinado o ambos. Eliges el día y la hora y el sistema revisa la agenda.", icono: "💄" },
  { href: "/panel/solicitudes/nueva?tipo=curso", titulo: "Curso o clase", texto: "Clase individual o lugar en una sesión grupal, con el cupo controlado.", icono: "🎓" },
  { href: "/panel/pedidos/nuevo", titulo: "Pedido de productos", texto: "Para entrega o retiro. Queda pendiente de confirmar, como un pedido de la página.", icono: "🛍️" },
  { href: "/panel/ventas", titulo: "Venta en el local", texto: "La clienta paga y se lleva el producto en el momento.", icono: "🧾" },
];

// Andrea registra por la clienta lo mismo que ella haría desde la página (por si no puede entrar o prefiere WhatsApp).
export default function Registrar() {
  return (
    <>
      <EncabezadoPanel titulo="Registrar por una clienta" />
      <div className="max-w-4xl space-y-5 p-5 lg:p-8">
        <p className="text-sm text-gris-600">
          Para clientas que no pueden entrar a la página, te escribieron por WhatsApp o están contigo. Aplican las mismas reglas de siempre: anticipo del 10 %, plazo de 24 horas y confirmación tuya.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {OPCIONES.map((o) => (
            <Link key={o.href} href={o.href} className="tarjeta flex gap-4 p-5 transition hover:border-oro-700">
              <span className="text-3xl" aria-hidden>
                {o.icono}
              </span>
              <span>
                <span className="block font-bold">{o.titulo}</span>
                <span className="mt-1 block text-sm text-gris-600">{o.texto}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
