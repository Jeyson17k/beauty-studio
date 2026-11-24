// Pruebas de archivar solicitudes rechazadas, canceladas o expiradas (centro de solicitudes).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q1 } from "@/lib/db";
import { archivarSolicitud, listarSolicitudes, rechazarOCancelar } from "@/modulos/solicitudes";
import { reiniciarBase, solicitudServicio, UID } from "./utilidades";

beforeAll(reiniciarBase);
afterAll(() => pool.end());

describe("Archivar solicitudes", () => {
  it("PF-AR1 · una solicitud rechazada se archiva: sale de la lista, aparece en «Archivadas» y no se borra nada", async () => {
    const { id } = await solicitudServicio();
    await rechazarOCancelar(UID, id, "No hay disponibilidad ese día", "negocio");
    expect((await listarSolicitudes()).some((f) => f.id === id)).toBe(true);
    await archivarSolicitud(UID, id);
    expect((await listarSolicitudes()).some((f) => f.id === id)).toBe(false);
    expect((await listarSolicitudes({ archivadas: true })).some((f) => f.id === id)).toBe(true);
    const fila = await q1<{ estado: string; motivo_cierre: string }>("SELECT estado, motivo_cierre FROM solicitud_actividad WHERE id = $1", [id]);
    expect(fila).toMatchObject({ estado: "Rechazada", motivo_cierre: "No hay disponibilidad ese día" });
    const aud = await q1<{ n: number }>("SELECT count(*)::int AS n FROM auditoria WHERE entidad = 'solicitud_actividad' AND entidad_id = $1 AND accion = 'Archivar solicitud'", [id]);
    expect(aud!.n).toBe(1);
  });

  it("PF-AR2 · una solicitud archivada se puede restaurar", async () => {
    const { id } = await solicitudServicio();
    await rechazarOCancelar(UID, id, "No hay disponibilidad ese día", "negocio");
    await archivarSolicitud(UID, id);
    await archivarSolicitud(UID, id, false);
    expect((await listarSolicitudes()).some((f) => f.id === id)).toBe(true);
    expect((await listarSolicitudes({ archivadas: true })).some((f) => f.id === id)).toBe(false);
  });

  it("PF-AR3 · una solicitud que sigue en trámite no se puede archivar", async () => {
    const { id } = await solicitudServicio();
    await expect(archivarSolicitud(UID, id)).rejects.toThrow(/Solo se archivan/);
    expect((await listarSolicitudes()).some((f) => f.id === id)).toBe(true);
  });
});
