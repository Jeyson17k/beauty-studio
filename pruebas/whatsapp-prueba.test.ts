// Número de prueba de WhatsApp y estado «Pendiente de pago» en el calendario.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { bandejaSimulada, numeroPrueba } from "@/modulos/whatsapp/cliente";
import { enviarCotizacion } from "@/modulos/whatsapp/servicio";
import { plantillaPrueba } from "@/modulos/whatsapp/plantillas";
import { enviarPlantilla } from "@/modulos/whatsapp/cliente";
import { datosCalendario } from "@/modulos/agenda";
import { guardarCotizacion } from "@/modulos/solicitudes";
import { reiniciarBase, solicitudServicio, UID } from "./utilidades";

beforeAll(async () => {
  process.env.WHATSAPP_MODE = "simulado";
  process.env.WHATSAPP_SIM_AUTO = "off";
  process.env.STORAGE_DIR = "./almacenamiento-pruebas";
  await reiniciarBase();
});
afterAll(() => pool.end());

describe("WhatsApp de prueba y calendario", () => {
  it("PF-57 · con número de prueba, todo mensaje llega a ese número y no al de la clienta", async () => {
    process.env.WHATSAPP_NUMERO_PRUEBA = "5726 6176";
    expect(numeroPrueba()).toBe("+50557266176");
    await enviarPlantilla("+50588001234", plantillaPrueba());
    expect(bandejaSimulada()[0]).toMatchObject({ para: "+50588001234", destino: "+50557266176" });
    process.env.WHATSAPP_NUMERO_PRUEBA = "";
    expect(numeroPrueba()).toBeNull();
    await enviarPlantilla("+50588001234", plantillaPrueba());
    expect(bandejaSimulada()[0].destino).toBe("+50588001234");
  });

  it("PF-58 · la cita con cotización enviada aparece «Pendiente de pago» (E1) para el negocio y para el público, sin datos personales", async () => {
    const { id } = await solicitudServicio();
    await guardarCotizacion(UID, id, 800, 60, null);
    await enviarCotizacion(UID, id);
    const admin = await datosCalendario(true);
    const publico = await datosCalendario(false);
    expect(admin.filter((c) => c.t === "e")).toHaveLength(1);
    expect(admin.find((c) => c.t === "e")!.e).toMatch(/pendiente de pago/);
    expect(publico).toHaveLength(1);
    expect(publico[0].t).toBe("e");
    expect(publico[0].e).toBeUndefined(); // sin datos personales (RN-05.6)
  });
});
