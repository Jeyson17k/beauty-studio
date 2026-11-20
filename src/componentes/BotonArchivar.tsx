"use client";
// Botón del centro de solicitudes: archiva (o restaura) una solicitud rechazada, cancelada o expirada.
import { Formulario } from "./Formulario";
import { accionArchivarSolicitud } from "@/app/panel/acciones";

export function BotonArchivar({ id, restaurar = false }: { id: number; restaurar?: boolean }) {
  return (
    <Formulario
      accion={accionArchivarSolicitud}
      boton={restaurar ? "Restaurar" : "Archivar"}
      claseBoton="btn-borde px-3 py-1 text-xs"
      confirmar={restaurar ? undefined : `¿Archivar la solicitud #${id}? Dejará de verse en la lista; se conserva en «Archivadas».`}
    >
      <input type="hidden" name="solicitud_id" value={id} />
      {restaurar && <input type="hidden" name="archivar" value="no" />}
    </Formulario>
  );
}
