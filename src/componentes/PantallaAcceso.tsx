import Image from "next/image";
import type { ReactNode } from "react";
import { datosNegocio } from "@/lib/negocio";

/** Marco compartido del inicio de sesión y de la recuperación de la cuenta: una tarjeta con una imagen de la marca y el formulario. */
export async function PantallaAcceso({ children }: { children: ReactNode }) {
  const negocio = await datosNegocio();
  return (
    <div className="acc-crema relative grid min-h-dvh place-items-center px-4 py-8 text-texto-900">
      <div className="w-full max-w-[1020px]">
        <div className="acc-subir acc-tarjeta-crema grid overflow-hidden rounded-[2rem] md:min-h-[580px] md:grid-cols-[0.46fr_0.54fr]">
          {/* Imagen de la marca */}
          <div className="relative h-72 bg-[#f3f3f1] md:h-auto">
            <Image src="/img/neutro_retrato.jpg" alt="" fill priority sizes="(min-width: 768px) 470px, 100vw" className="object-cover" />
            <div className="absolute inset-x-0 top-0 hidden flex-col gap-1.5 p-8 md:flex">
              <span className="font-titulo text-xs font-medium uppercase tracking-[0.42em] text-oro-300">Panel</span>
              <span className="font-titulo text-4xl font-semibold uppercase leading-none text-white">{negocio.nombre}</span>
            </div>
          </div>

          {/* Formulario */}
          <div className="flex flex-col justify-center p-7 sm:p-10 md:px-12">
            <p className="font-titulo text-xs font-medium uppercase tracking-[0.38em] text-oro-700">Panel de administración</p>
            <div className="mt-2">{children}</div>
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-gris-600">Acceso solo para la administración{negocio.ciudad ? ` · ${negocio.ciudad}` : ""}</p>
      </div>
    </div>
  );
}
