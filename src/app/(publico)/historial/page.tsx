import { redirect } from "next/navigation";
import { Formulario } from "@/componentes/Formulario";
import { sesionClienta, sesionHistorial } from "@/lib/sesion";
import { mostrarWhatsApp } from "@/lib/telefono";
import { accionPedirCodigo } from "../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Historial" };

// P11 Historial: pedir código (CU-05). Nombre y teléfono no dan acceso (RN-01.4).
export default async function PedirCodigo() {
  if (await sesionHistorial()) redirect("/historial/mi");
  const clienta = await sesionClienta();
  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-bold">Mi historial</h1>
      <p className="mt-1 text-sm text-gris-600">
        Para proteger tus datos, te enviaremos un código de 6 dígitos por WhatsApp. Pedir el código equivale a aceptar recibir ese mensaje.
      </p>
      <div className="tarjeta mt-5 p-4">
        <Formulario accion={accionPedirCodigo} boton="Enviarme el código" botonAncho>
          <label className="block">
            <span className="etiqueta-campo">Número de WhatsApp</span>
            <input name="whatsapp" required inputMode="tel" defaultValue={clienta ? mostrarWhatsApp(clienta.whatsapp) : ""} className="campo" placeholder="8888 8888" />
          </label>
        </Formulario>
      </div>
      <p className="mt-4 text-xs text-gris-600">El código vence en 10 minutos y permite 3 intentos. Puedes pedir hasta 5 códigos por hora.</p>
    </div>
  );
}
