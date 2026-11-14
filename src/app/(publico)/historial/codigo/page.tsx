import Link from "next/link";
import { Formulario } from "@/componentes/Formulario";
import { Aviso } from "@/componentes/ui";
import { modoWhatsApp } from "@/modulos/whatsapp/cliente";
import { accionValidarCodigo } from "../../acciones";

export const metadata = { title: "Ingresar código" };

// P12 Historial: ingresar código (CU-06)
export default async function IngresarCodigo({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-bold">Escribe tu código</h1>
      <p className="mt-1 text-sm text-gris-600">Si el número está registrado, te enviamos un código por WhatsApp.</p>
      {modoWhatsApp() === "simulado" && (
        <div className="mt-4">
          <Aviso tono="warn">Entorno de prueba: el código se ve en el panel de Andrea, en «Mensajes» → bandeja simulada.</Aviso>
        </div>
      )}
      <div className="tarjeta mt-5 p-4">
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
  );
}
