import { Formulario } from "@/componentes/Formulario";
import { CamposIdentificacion } from "@/componentes/CamposPublicos";
import { accionIdentificarse } from "../acciones";
import { EncabezadoPagina } from "@/componentes/publico";

export const metadata = { title: "Identificarse" };

// P07 Identificarse (CU-01)
export default async function Identificarse({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const { siguiente } = await searchParams;
  return (
    <div>
      <EncabezadoPagina titulo="Identifícate" subtitulo="Usaremos tu nombre y tu WhatsApp en esta visita para que no tengas que escribirlos otra vez." />
      <div className="contenedor max-w-xl py-8 md:py-12">
      <div className="tarjeta p-5 md:p-7">
        <Formulario accion={accionIdentificarse} boton="Continuar" botonAncho>
          <input type="hidden" name="siguiente" value={siguiente ?? "/"} />
          <CamposIdentificacion conTitulo={false} />
        </Formulario>
      </div>
      </div>
    </div>
  );
}
