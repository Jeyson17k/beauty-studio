import { Formulario } from "@/componentes/Formulario";
import { CamposIdentificacion } from "@/componentes/CamposPublicos";
import { accionIdentificarse } from "../acciones";

export const metadata = { title: "Identificarse" };

// P07 Identificarse (CU-01)
export default async function Identificarse({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const { siguiente } = await searchParams;
  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-bold">Identifícate</h1>
      <p className="mt-1 text-sm text-gris-600">Usaremos tu nombre y tu WhatsApp en esta visita para que no tengas que escribirlos otra vez.</p>
      <div className="tarjeta mt-5 p-4">
        <Formulario accion={accionIdentificarse} boton="Continuar" botonAncho>
          <input type="hidden" name="siguiente" value={siguiente ?? "/"} />
          <CamposIdentificacion conTitulo={false} />
        </Formulario>
      </div>
    </div>
  );
}
