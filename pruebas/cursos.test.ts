// Pruebas de cursos individuales y grupales (RF-04, RF-08, RN-04.x, RN-08.x, RN-14.8).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { q, q1, pool } from "@/lib/db";
import { cancelarSesion, programarSesion } from "@/modulos/catalogo";
import { guardarCotizacion, registrarSolicitudCurso } from "@/modulos/solicitudes";
import { enviarCotizacion } from "@/modulos/whatsapp/servicio";
import { cargarComprobante, validarAnticipoYConfirmar } from "@/modulos/pagos";
import { cuposDisponibles } from "@/modulos/agenda";
import { aviso, clienta, estado, horasDesdeAhora, reiniciarBase, solicitudServicio, UID } from "./utilidades";

const imagen = () => new File([Buffer.from("89504e47", "hex")], "c.png", { type: "image/png" });
const GRUPAL = 2;
const INDIVIDUAL = 1;

beforeAll(reiniciarBase);
afterAll(() => pool.end());

async function inscribir(sesionId: number) {
  const c = await clienta();
  const id = await registrarSolicitudCurso({ clienteId: c.id, cursoId: GRUPAL, sesionId });
  await guardarCotizacion(UID, id, 1500, 0, null);
  await enviarCotizacion(UID, id);
  await aviso(id, "sent");
  return id;
}

describe("Cursos grupales e individuales", () => {
  it("PF-30 · habilitar una sesión aparta su intervalo completo de 3 horas (RN-04.4, RN-04.8, RN-04.9)", async () => {
    const sid = await programarSesion(UID, GRUPAL, horasDesdeAhora(50), 2, true);
    const ag = await q<{ inicio: Date; fin: Date; estado: string }>("SELECT inicio, fin, estado FROM actividad_agenda WHERE sesion_id = $1", [sid]);
    expect(ag).toHaveLength(1);
    expect((new Date(ag[0].fin).getTime() - new Date(ag[0].inicio).getTime()) / 3600_000).toBe(3);
    expect((await q1<{ estado: string }>("SELECT estado FROM sesion_curso WHERE id = $1", [sid]))!.estado).toBe("Abierta");
    // un servicio no puede usar ese intervalo (RN-05.4)
    const s = await solicitudServicio({ horas: 51 });
    await guardarCotizacion(UID, s.id, 900, 60, null);
    await expect(enviarCotizacion(UID, s.id)).rejects.toThrow(/se cruza/);
  });

  it("PF-31 · cada inscripción aparta un cupo sin crear otro intervalo y no se supera la capacidad (RN-08.6 a RN-08.9, RN-14.8)", async () => {
    const sid = await programarSesion(UID, GRUPAL, horasDesdeAhora(60), 2, true);
    const a = await inscribir(sid);
    expect(await cuposDisponibles(pool, sid)).toBe(1);
    const b = await inscribir(sid);
    expect((await q1<{ estado: string }>("SELECT estado FROM sesion_curso WHERE id = $1", [sid]))!.estado).toBe("Llena");
    const c = await clienta();
    await expect(registrarSolicitudCurso({ clienteId: c.id, cursoId: GRUPAL, sesionId: sid })).rejects.toThrow(/inscripciones|cupos/);
    const cp = await cargarComprobante(UID, a, imagen(), 150, new Date());
    await validarAnticipoYConfirmar(UID, cp);
    expect(await estado(a)).toBe("Confirmada");
    const n = await q1<{ n: number }>("SELECT count(*)::int AS n FROM actividad_agenda WHERE sesion_id = $1 OR solicitud_id IN ($2, $3)", [sid, a, b]);
    expect(n!.n).toBe(1);
  });

  it("PF-32 · cancelar la sesión libera su intervalo y cancela las inscripciones (RN-04.10)", async () => {
    const sid = await programarSesion(UID, GRUPAL, horasDesdeAhora(70), 3, true);
    const a = await inscribir(sid);
    const canceladas = await cancelarSesion(UID, sid, "Andrea enfermó");
    expect(canceladas).toBe(1);
    expect(await estado(a)).toBe("Cancelada");
    const ag = await q1<{ estado: string }>("SELECT estado FROM actividad_agenda WHERE sesion_id = $1", [sid]);
    expect(ag!.estado).toBe("Liberada");
  });

  it("PF-33 · la clase individual ocupa su propio intervalo de 3 horas al enviar la cotización (RN-04.6, RN-10.7)", async () => {
    const c = await clienta();
    const id = await registrarSolicitudCurso({ clienteId: c.id, cursoId: INDIVIDUAL, inicio: horasDesdeAhora(80) });
    await guardarCotizacion(UID, id, 2000, 0, null);
    const cot = await q1<{ duracion_min: number; anticipo: number }>("SELECT duracion_min, anticipo FROM cotizacion WHERE solicitud_id = $1", [id]);
    expect(cot).toEqual({ duracion_min: 180, anticipo: 200 });
    await enviarCotizacion(UID, id);
    const ag = await q<{ inicio: Date; fin: Date }>("SELECT inicio, fin FROM actividad_agenda WHERE solicitud_id = $1 AND estado = 'Provisional'", [id]);
    expect((new Date(ag[0].fin).getTime() - new Date(ag[0].inicio).getTime()) / 3600_000).toBe(3);
  });

  it("PF-34 · no se mezcla servicio y curso en una solicitud (RN-06.4)", async () => {
    const c = await clienta();
    await expect(
      q("INSERT INTO solicitud_actividad (cliente_id, tipo, servicio_id, sesion_id, fuera_local, estado) VALUES ($1,'curso',1,NULL,false,'Pendiente de revisión')", [c.id]),
    ).rejects.toThrow();
  });
});
