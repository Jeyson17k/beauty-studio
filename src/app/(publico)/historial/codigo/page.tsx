import Link from "next/link";
import { Formulario } from "@/componentes/Formulario";
import { Aviso } from "@/componentes/ui";
import { modoWhatsApp } from "@/modulos/whatsapp/cliente";
import { accionValidarCodigo } from "../../acciones";
import { EncabezadoPagina } from "@/componentes/publico";

export const metadata = { title: "Ingresar código" };

// P12 Historial: ingresar código (CU-06)
export default async function IngresarCodigo({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  return (
    <div>
      <EncabezadoPagina titulo="Escribe tu código" subtitulo="Si el número está registrado, te enviamos un código por WhatsApp." />
      <div className="contenedor max-w-xl py-8 md:py-12">
      {modoWhatsApp() === "simulado" && (
        <div className="mb-5">
          <Aviso tono="warn">Entorno de prueba: el código se ve en el panel de Andrea, en «Mensajes» → bandeja simulada.</Aviso>
        </div>
      )}
      <div className="tarjeta p-5 md:p-7">
        <Formulario accion={accionValidarCodigo} boton="Ver mi historial" botonAncho>
          <input type="hidden" name="whatsapp" value={w ?? ""} />
          <label className="block">
            <span className="etiqueta-campo">Código de 6 dígitos</span>
            <input name="codigo" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="campo text-center text-2xl tracking-[0.5em]" />
          </label>
        </Formulario>
      </div>
      <Link href="/historial" className="mt-4 inline-block text-sm font-semibold text-oro-700">
        Pedir otro código
      </Link>
      </div>
    </div>
  );
}
