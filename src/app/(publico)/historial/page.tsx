import { redirect } from "next/navigation";
import { Formulario } from "@/componentes/Formulario";
import { sesionClienta, sesionHistorial } from "@/lib/sesion";
import { mostrarWhatsApp } from "@/lib/telefono";
import { accionPedirCodigo } from "../acciones";
import { EncabezadoPagina } from "@/componentes/publico";

export const dynamic = "force-dynamic";
export const metadata = { title: "Historial" };

// P11 Historial: pedir código (CU-05). Nombre y teléfono no dan acceso (RN-01.4).
export default async function PedirCodigo() {
  if (await sesionHistorial()) redirect("/historial/mi");
  const clienta = await sesionClienta();
  return (
    <div>
      <EncabezadoPagina
        titulo="Mi historial"
        subtitulo="Para proteger tus datos, te enviaremos un código de 6 dígitos por WhatsApp. Pedir el código equivale a aceptar recibir ese mensaje."
      />
      <div className="contenedor max-w-xl py-8 md:py-12">
      <div className="tarjeta p-5 md:p-7">
        <Formulario accion={accionPedirCodigo} boton="Enviarme el código" botonAncho>
          <label className="block">
            <span className="etiqueta-campo">Número de WhatsApp</span>
            <input name="whatsapp" required inputMode="tel" maxLength={20} pattern=" *\+?[0-9 \(\)\-.]{8,20} *" title="Escribe un número de WhatsApp con dígitos, por ejemplo 8888 1234." defaultValue={clienta ? mostrarWhatsApp(clienta.whatsapp) : ""} className="campo" placeholder="8888 8888" />
          </label>
        </Formulario>
      </div>
      <p className="mt-4 text-xs text-gris-600">El código vence en 10 minutos y permite 3 intentos. Puedes pedir hasta 5 códigos por hora.</p>
      </div>
    </div>
  );
}
