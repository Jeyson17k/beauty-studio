// Pruebas funcionales e de integración del flujo central (RF-01 a RF-18, RF-31 a RF-34).
// Cada prueba lleva el código de la matriz de pruebas (PF-xx) y el requerimiento que verifica.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "crypto";
import { q, q1, pool } from "@/lib/db";
import { identificar, solicitarCodigo, validarCodigo } from "@/modulos/clientas";
import { guardarCotizacion, registrarSolicitudServicio, rechazarOCancelar, registroDirecto, reprogramar } from "@/modulos/solicitudes";
import { enviarCotizacion, registrarEnvioManual, procesarAviso, vencerEnviosSinConfirmar } from "@/modulos/whatsapp/servicio";
import { cargarComprobante, declararExpiracion, registrarAtencion, registrarSaldo, validarAnticipoYConfirmar } from "@/modulos/pagos";
import { generarRecordatorios, vencerPlazos } from "@/modulos/planificador";
import { firmaValida } from "@/modulos/whatsapp/cliente";
import { agendaActiva, aviso, clienta, estado, horasDesdeAhora, reiniciarBase, solicitudServicio, UID, ultimoMensaje } from "./utilidades";

const imagen = () => new File([Buffer.from("89504e470d0a1a0a", "hex")], "comprobante.png", { type: "image/png" });

/** Lleva una solicitud hasta Pendiente de pago (cotiza, envía y simula el aviso «enviado»). */
async function hastaPendienteDePago(opc: Parameters<typeof solicitudServicio>[0] = {}, precio = 1300) {
  const s = await solicitudServicio(opc);
  await guardarCotizacion(UID, s.id, precio, 90, opc.domicilio ? 30 : null);
  await enviarCotizacion(UID, s.id);
  await aviso(s.id, "sent");
  return s;
}

async function hastaConfirmada(opc: Parameters<typeof solicitudServicio>[0] = {}) {
  const s = await hastaPendienteDePago(opc);
  const cp = await cargarComprobante(UID, s.id, imagen(), 130, new Date());
  await validarAnticipoYConfirmar(UID, cp);
  return s;
}

beforeAll(async () => {
  await reiniciarBase();
});

describe("Identificación de la clienta (RF-01)", () => {
  it("PF-01 · normaliza el WhatsApp, no pide correo y guarda la aceptación con fecha (RN-01.1, RN-01.2, RN-01.6)", async () => {
    const c = await identificar("Valeria Gómez", "8888-1234", true);
    expect(c.whatsapp).toBe("+50588881234");
    expect(c.acepta_whatsapp).toBe(true);
    expect(c.acepta_whatsapp_en).toBeInstanceOf(Date);
    const otra = await identificar("Valeria Gómez López", "+505 8888 1234", true);
    expect(otra.id).toBe(c.id); // el mismo número identifica a la misma clienta
  });

  it("PF-02 · rechaza nombre incompleto y número no válido", async () => {
    await expect(identificar("Ana", "88881234", true)).rejects.toThrow(/nombre y apellido/);
    await expect(identificar("Ana Ruiz", "123", true)).rejects.toThrow(/WhatsApp válido/);
  });
});

describe("Registro de solicitudes (RF-05, RF-07)", () => {
  it("PF-03 · la solicitud queda Pendiente de revisión y no bloquea horario (RN-07.8, RN-05.7)", async () => {
    const s = await solicitudServicio();
    expect(await estado(s.id)).toBe("Pendiente de revisión");
    expect(await agendaActiva(s.id)).toHaveLength(0);
    const n = await q1<{ n: number }>("SELECT count(*)::int AS n FROM notificacion WHERE entidad_id = $1 AND tipo = 'Solicitud nueva'", [s.id]);
    expect(n!.n).toBe(1); // RN-09.5
  });

  it("PF-04 · no acepta fechas pasadas (RN-05.1) ni domicilio sin dirección (RN-07.6) ni servicios inactivos (RN-03.3)", async () => {
    const c = await clienta();
    await expect(registrarSolicitudServicio({ clienteId: c.id, servicioId: 1, inicio: horasDesdeAhora(-2), fueraLocal: false })).rejects.toThrow(/RN-05.1/);
    await expect(registrarSolicitudServicio({ clienteId: c.id, servicioId: 1, inicio: horasDesdeAhora(30), fueraLocal: true })).rejects.toThrow(/RN-07.6/);
    await expect(registrarSolicitudServicio({ clienteId: c.id, servicioId: 3, inicio: horasDesdeAhora(30), fueraLocal: false })).rejects.toThrow(/no está disponible/);
  });
});

describe("Cotización y envío por WhatsApp (RF-10, RF-11, RF-33)", () => {
  it("PF-05 · calcula anticipo del 10 % y saldo, sin apartar horario (RN-10.3, RN-10.4)", async () => {
    const s = await solicitudServicio();
    await guardarCotizacion(UID, s.id, 1300, 90, null);
    const c = await q1<{ anticipo: number; saldo: number }>("SELECT anticipo, saldo FROM cotizacion WHERE solicitud_id = $1 AND vigente", [s.id]);
    expect(c).toEqual({ anticipo: 130, saldo: 1170 });
    expect(await agendaActiva(s.id)).toHaveLength(0);
    expect(await estado(s.id)).toBe("Pendiente de revisión");
  });

  it("PF-06 · sin aceptación de mensajes no envía por la API (RN-01.6, RN-11.10)", async () => {
    const s = await solicitudServicio({ acepta: false });
    await guardarCotizacion(UID, s.id, 900, 60, null);
    await expect(enviarCotizacion(UID, s.id)).rejects.toThrow(/envío manual/);
    expect(await agendaActiva(s.id)).toHaveLength(0);
  });

  it("PF-07 · al enviar aparta provisionalmente y deja el mensaje en cola; el plazo no inicia (RN-11.4, RN-11.5)", async () => {
    const s = await solicitudServicio();
    await guardarCotizacion(UID, s.id, 1300, 90, null);
    const r = await enviarCotizacion(UID, s.id);
    expect(r.ok).toBe(true);
    expect(await estado(s.id)).toBe("Cotización en envío");
    const ag = await agendaActiva(s.id);
    expect(ag).toHaveLength(1);
    expect(ag[0].estado).toBe("Provisional");
    expect((new Date(ag[0].fin).getTime() - new Date(ag[0].inicio).getTime()) / 60000).toBe(90);
    const m = await ultimoMensaje(s.id);
    expect(m.estado).toBe("En cola");
    expect(m.id_externo).toMatch(/^wamid\./);
    const sol = await q1<{ plazo_pago_hasta: Date | null }>("SELECT plazo_pago_hasta FROM solicitud_actividad WHERE id = $1", [s.id]);
    expect(sol!.plazo_pago_hasta).toBeNull();
  });

  it("PF-08 · el aviso «enviado» pasa a Pendiente de pago y el plazo vence 24 h después de ese aviso (RN-11.5, RN-12.1)", async () => {
    const s = await solicitudServicio();
    await guardarCotizacion(UID, s.id, 1300, 90, null);
    await enviarCotizacion(UID, s.id);
    const enviado = new Date(Date.now() - 5 * 60_000);
    await aviso(s.id, "sent", enviado);
    expect(await estado(s.id)).toBe("Pendiente de pago");
    const sol = await q1<{ plazo_pago_hasta: Date }>("SELECT plazo_pago_hasta FROM solicitud_actividad WHERE id = $1", [s.id]);
    expect(new Date(sol!.plazo_pago_hasta).getTime() - enviado.getTime()).toBe(24 * 3600_000);
  });

  it("PF-09 · avisos repetidos o fuera de orden no duplican efectos ni retroceden el estado (RN-11.8, RN-33.3)", async () => {
    const s = await solicitudServicio();
    await guardarCotizacion(UID, s.id, 1300, 90, null);
    await enviarCotizacion(UID, s.id);
    const t = new Date(Date.now() - 60_000);
    expect(await aviso(s.id, "delivered", t)).toBe("procesado"); // llega antes que «sent»
    expect(await estado(s.id)).toBe("Pendiente de pago");
    expect(await aviso(s.id, "sent", new Date(t.getTime() - 1000))).toBe("procesado");
    expect(await aviso(s.id, "sent")).toBe("duplicado");
    const m = await ultimoMensaje(s.id);
    expect(m.estado).toBe("Entregado"); // no retrocede a Enviado
    const ev = await q1<{ n: number }>("SELECT count(*)::int AS n FROM evento_mensaje_whatsapp WHERE mensaje_id = $1", [m.id]);
    expect(ev!.n).toBe(2);
  });

  it("PF-10 · un envío fallido libera el apartado, vuelve a revisión y alerta al negocio (RN-11.6, RN-09.7)", async () => {
    const s = await solicitudServicio();
    await guardarCotizacion(UID, s.id, 1300, 90, null);
    await enviarCotizacion(UID, s.id);
    await aviso(s.id, "failed");
    expect(await estado(s.id)).toBe("Pendiente de revisión");
    expect(await agendaActiva(s.id)).toHaveLength(0);
    expect((await ultimoMensaje(s.id)).estado).toBe("Fallido");
    const n = await q1<{ n: number }>("SELECT count(*)::int AS n FROM notificacion WHERE entidad_id = $1 AND tipo = 'Envío fallido'", [s.id]);
    expect(n!.n).toBe(1);
    // se conserva la cotización y se puede reintentar
    await enviarCotizacion(UID, s.id);
    expect(await estado(s.id)).toBe("Cotización en envío");
  });

  it("PF-11 · sin aviso de envío dentro de 15 minutos el planificador lo marca fallido (RN-11.6)", async () => {
    const s = await solicitudServicio();
    await guardarCotizacion(UID, s.id, 1300, 90, null);
    await enviarCotizacion(UID, s.id);
    await q("UPDATE mensaje_whatsapp SET creado_en = now() - interval '16 minutes' WHERE solicitud_id = $1", [s.id]);
    await vencerEnviosSinConfirmar();
    expect(await estado(s.id)).toBe("Pendiente de revisión");
    const m = await ultimoMensaje(s.id);
    expect(m.estado).toBe("Fallido");
  });

  it("PF-12 · un segundo clic no genera otro mensaje ni otra reserva (RN-11.8)", async () => {
    const s = await solicitudServicio();
    await guardarCotizacion(UID, s.id, 1300, 90, null);
    await enviarCotizacion(UID, s.id);
    await expect(enviarCotizacion(UID, s.id)).rejects.toThrow(/ya se está enviando/);
    const n = await q1<{ n: number }>("SELECT count(*)::int AS n FROM mensaje_whatsapp WHERE solicitud_id = $1", [s.id]);
    expect(n!.n).toBe(1);
    expect(await agendaActiva(s.id)).toHaveLength(1);
  });

  it("PF-13 · no se aparta un horario que se cruza con otra actividad (RN-05.8, RN-11.4)", async () => {
    const a = await hastaPendienteDePago({ horas: 72 });
    const b = await solicitudServicio({ horas: 72.5 }); // empieza 30 min después; la primera dura 90 min
    await guardarCotizacion(UID, b.id, 800, 60, null);
    await expect(enviarCotizacion(UID, b.id)).rejects.toThrow(/se cruza con otra actividad/);
    expect(await estado(b.id)).toBe("Pendiente de revisión");
    expect(await ultimoMensaje(b.id).catch(() => null)).toBeNull(); // no se envió ningún mensaje
    expect(await estado(a.id)).toBe("Pendiente de pago");
  });

  it("PF-14 · el envío manual inicia el plazo con la hora registrada por el negocio (RN-11.7, RN-12.1)", async () => {
    const s = await solicitudServicio({ acepta: false });
    await guardarCotizacion(UID, s.id, 1000, 60, null);
    const enviado = new Date(Date.now() - 30_000);
    const plazo = await registrarEnvioManual(UID, s.id, enviado);
    expect(plazo.getTime() - enviado.getTime()).toBe(24 * 3600_000);
    expect(await estado(s.id)).toBe("Pendiente de pago");
    expect((await agendaActiva(s.id))[0].estado).toBe("Provisional");
    await expect(registrarEnvioManual(UID, s.id, new Date())).rejects.toThrow();
  });

  it("PF-15 · el servicio a domicilio suma el traslado al intervalo (RN-05.12)", async () => {
    const s = await solicitudServicio({ domicilio: true, horas: 100 });
    await expect(guardarCotizacion(UID, s.id, 1500, 90, null)).rejects.toThrow(/traslado/);
    await guardarCotizacion(UID, s.id, 1500, 90, 40);
    await enviarCotizacion(UID, s.id);
    const ag = (await agendaActiva(s.id))[0];
    expect((new Date(ag.fin).getTime() - new Date(ag.inicio).getTime()) / 60000).toBe(130);
  });
});

describe("Plazo, comprobante y confirmación (RF-12 a RF-15, RF-34)", () => {
  it("PF-16 · al vencer las 24 h pasa a Plazo vencido sin liberar la reserva (RN-12.4, RN-12.5)", async () => {
    const s = await hastaPendienteDePago({ horas: 120 });
    await q("UPDATE solicitud_actividad SET plazo_pago_hasta = now() - interval '1 minute' WHERE id = $1", [s.id]);
    await vencerPlazos();
    expect(await estado(s.id)).toBe("Plazo vencido pendiente de revisión");
    expect(await agendaActiva(s.id)).toHaveLength(1);
  });

  it("PF-17 · un pago hecho dentro del plazo se valida después del vencimiento y confirma (RN-13.6, RN-15.3)", async () => {
    const s = await hastaPendienteDePago({ horas: 130 });
    await q("UPDATE solicitud_actividad SET plazo_pago_hasta = now() - interval '1 hour' WHERE id = $1", [s.id]);
    await vencerPlazos();
    const cp = await cargarComprobante(UID, s.id, imagen(), 130, new Date(Date.now() - 2 * 3600_000));
    await validarAnticipoYConfirmar(UID, cp);
    expect(await estado(s.id)).toBe("Confirmada");
    expect((await agendaActiva(s.id))[0].estado).toBe("Confirmada");
  });

  it("PF-18 · un pago fuera de plazo no confirma; la expiración libera la reserva (RN-15.3, RN-15.4, RN-15.6)", async () => {
    const s = await hastaPendienteDePago({ horas: 140 });
    await q("UPDATE solicitud_actividad SET plazo_pago_hasta = now() - interval '3 hours' WHERE id = $1", [s.id]);
    await vencerPlazos();
    const cp = await cargarComprobante(UID, s.id, imagen(), 130, new Date(Date.now() - 60 * 60_000));
    await expect(validarAnticipoYConfirmar(UID, cp)).rejects.toThrow(/después del plazo/);
    await declararExpiracion(UID, s.id, "Sin pago dentro del plazo");
    expect(await estado(s.id)).toBe("Expirada");
    expect(await agendaActiva(s.id)).toHaveLength(0);
    const r = await q1<{ revisada_en: Date }>("SELECT revisada_en FROM solicitud_actividad WHERE id = $1", [s.id]);
    expect(r!.revisada_en).toBeInstanceOf(Date);
  });

  it("PF-19 · un comprobante por menos del anticipo no confirma (RN-13.5)", async () => {
    const s = await hastaPendienteDePago({ horas: 150 });
    const cp = await cargarComprobante(UID, s.id, imagen(), 100, new Date());
    await expect(validarAnticipoYConfirmar(UID, cp)).rejects.toThrow(/no cubre el anticipo/);
    expect(await estado(s.id)).toBe("Pendiente de pago");
  });

  it("PF-20 · confirmar mantiene el intervalo, registra el anticipo y envía el aviso; su fallo no revierte (RN-14.7, RN-34.3)", async () => {
    const s = await hastaConfirmada({ horas: 160 });
    expect(await estado(s.id)).toBe("Confirmada");
    const pago = await q1<{ tipo: string; monto: number }>("SELECT tipo, monto FROM pago WHERE solicitud_id = $1", [s.id]);
    expect(pago).toEqual({ tipo: "Anticipo", monto: 130 });
    const m = await ultimoMensaje(s.id);
    expect(m.tipo).toBe("Aviso de confirmación");
    await aviso(s.id, "failed");
    expect(await estado(s.id)).toBe("Confirmada");
    expect((await agendaActiva(s.id))[0].estado).toBe("Confirmada");
  });
});

describe("Cancelación, reprogramación y cierre (RF-16, RF-31, RF-32)", () => {
  it("PF-21 · cancelar libera el intervalo y conserva el anticipo (RN-16.1, RN-16.3, RN-16.6)", async () => {
    const s = await hastaConfirmada({ horas: 170 });
    await expect(rechazarOCancelar(UID, s.id, "", "clienta")).rejects.toThrow(/motivo/);
    await rechazarOCancelar(UID, s.id, "La clienta no puede asistir", "clienta");
    expect(await estado(s.id)).toBe("Cancelada");
    expect(await agendaActiva(s.id)).toHaveLength(0);
    const p = await q1<{ n: number }>("SELECT count(*)::int AS n FROM pago WHERE solicitud_id = $1", [s.id]);
    expect(p!.n).toBe(1);
  });

  it("PF-22 · reprogramar asegura el nuevo horario, conserva el anticipo y la fecha original (RN-32.2 a RN-32.5)", async () => {
    const otra = await hastaConfirmada({ horas: 200 });
    const s = await hastaConfirmada({ horas: 180 });
    const original = (await agendaActiva(s.id))[0].inicio;
    await expect(reprogramar(UID, s.id, "Choque", { inicio: horasDesdeAhora(200.5) })).rejects.toThrow(/se cruza/);
    expect((await agendaActiva(s.id))[0].inicio).toEqual(original); // la reserva original sigue
    await reprogramar(UID, s.id, "La clienta pidió otra hora", { inicio: horasDesdeAhora(181) }); // se solapa solo consigo misma
    const ag = await agendaActiva(s.id);
    expect(ag).toHaveLength(1);
    expect(new Date(ag[0].inicio).getTime()).toBe(horasDesdeAhora(181).getTime());
    const r = await q1<{ inicio_original: Date; estado: string }>("SELECT inicio_original, estado FROM reprogramacion WHERE solicitud_id = $1", [s.id]);
    expect(r).toEqual({ inicio_original: original, estado: "Aceptada" });
    expect(await estado(s.id)).toBe("Confirmada");
    expect(await estado(otra.id)).toBe("Confirmada");
  });

  it("PF-23 · la atención no se registra antes de la hora; el saldo cierra solo con pago completo (RN-31.2 a RN-31.4)", async () => {
    const s = await hastaConfirmada({ horas: 210 });
    await expect(registrarAtencion(UID, s.id, "Realizada")).rejects.toThrow(/todavía no ha empezado/);
    await q("UPDATE solicitud_actividad SET inicio_solicitado = now() - interval '2 hours' WHERE id = $1", [s.id]);
    await registrarAtencion(UID, s.id, "Realizada");
    await expect(registrarSaldo(UID, s.id, 2000)).rejects.toThrow(/supera el saldo/);
    const parcial = await registrarSaldo(UID, s.id, 1000);
    expect(parcial).toEqual({ cerrada: false, saldoRestante: 170 });
    expect(await estado(s.id)).toBe("Realizada");
    const fin = await registrarSaldo(UID, s.id, 170);
    expect(fin.cerrada).toBe(true);
    expect(await estado(s.id)).toBe("Cerrada");
  });

  it("PF-24 · la inasistencia retiene el anticipo (RN-31.6)", async () => {
    const s = await hastaConfirmada({ horas: 220 });
    await q("UPDATE solicitud_actividad SET inicio_solicitado = now() - interval '1 hour' WHERE id = $1", [s.id]);
    await registrarAtencion(UID, s.id, "No asistida");
    const r = await q1<{ estado: string; motivo_cierre: string }>("SELECT estado, motivo_cierre FROM solicitud_actividad WHERE id = $1", [s.id]);
    expect(r!.estado).toBe("No asistida");
    expect(r!.motivo_cierre).toMatch(/retenido/);
  });

  it("PF-25 · el registro directo sigue las mismas reglas: sin anticipo validado no se confirma (RN-17.5, RN-17.7)", async () => {
    const id = await registroDirecto(UID, { nombre: "Karla Mena", whatsapp: "8777 1111", acepta: true, tipo: "servicio", servicioId: 2, inicio: horasDesdeAhora(230) });
    expect(await estado(id)).toBe("Pendiente de revisión");
    const r = await q1<{ registro_directo: boolean }>("SELECT registro_directo FROM solicitud_actividad WHERE id = $1", [id]);
    expect(r!.registro_directo).toBe(true);
    await guardarCotizacion(UID, id, 700, 60, null);
    await expect(validarAnticipoYConfirmar(UID, 999999)).rejects.toThrow();
    expect(await estado(id)).toBe("Pendiente de revisión");
  });
});

describe("Historial con código de verificación (RF-18)", () => {
  it("PF-26 · guarda solo la huella, permite 3 intentos y abre el historial con el código correcto (RN-18.8, RN-18.9, RN-18.11)", async () => {
    const c = await identificar("Lucía Pérez", "8666 2222", true);
    await solicitarCodigo("8666 2222");
    const cod = await q1<{ id: number; codigo_hash: string; estado: string; mensaje_id: number }>("SELECT id, codigo_hash, estado, mensaje_id FROM codigo_verificacion WHERE cliente_id = $1", [c.id]);
    expect(cod!.codigo_hash).toHaveLength(64);
    expect(cod!.estado).toBe("Solicitado");
    await expect(validarCodigo("8666 2222", "123456")).rejects.toThrow(/todavía se está enviando/); // solo un código Enviado se valida
    const m = await q1<{ id_externo: string }>("SELECT id_externo FROM mensaje_whatsapp WHERE id = $1", [cod!.mensaje_id]);
    await procesarAviso({ idExterno: m!.id_externo, estado: "sent", ocurrido: new Date(), idEvento: `${m!.id_externo}:sent` });
    // se reconstruye el código a partir de la huella (solo posible en la prueba, probando las 10^6 opciones)
    const secreto = process.env.SESSION_SECRET!;
    let codigo = "";
    for (let i = 0; i < 1_000_000 && !codigo; i++) {
      const c6 = String(i).padStart(6, "0");
      if (crypto.createHmac("sha256", secreto).update(c6).digest("hex") === cod!.codigo_hash) codigo = c6;
    }
    const malo = codigo === "000000" ? "111111" : "000000";
    await expect(validarCodigo("8666 2222", malo)).rejects.toThrow(/quedan 2/);
    const ok = await validarCodigo("8666 2222", codigo);
    expect(ok.id).toBe(c.id);
    await expect(validarCodigo("8666 2222", codigo)).rejects.toThrow(/ya no se puede usar/); // un solo uso
  });

  it("PF-27 · bloquea el código al tercer intento fallido y limita 5 solicitudes por hora (RN-18.8)", async () => {
    await identificar("Rosa López", "8555 3333", true);
    await solicitarCodigo("8555 3333");
    const m = await q1<{ id_externo: string }>(
      "SELECT m.id_externo FROM mensaje_whatsapp m JOIN cliente c ON c.id = m.cliente_id WHERE c.whatsapp = '+50585553333' ORDER BY m.id DESC LIMIT 1",
    );
    await procesarAviso({ idExterno: m!.id_externo, estado: "sent", ocurrido: new Date(), idEvento: `${m!.id_externo}:sent` });
    await expect(validarCodigo("8555 3333", "000001")).rejects.toThrow(/quedan 2/);
    await expect(validarCodigo("8555 3333", "000002")).rejects.toThrow(/quedan 1/);
    await expect(validarCodigo("8555 3333", "000003")).rejects.toThrow(/Superaste/);
    const e = await q1<{ estado: string }>("SELECT v.estado FROM codigo_verificacion v JOIN cliente c ON c.id = v.cliente_id WHERE c.whatsapp = '+50585553333' ORDER BY v.id DESC LIMIT 1");
    expect(e!.estado).toBe("Bloqueado");
    for (let i = 0; i < 4; i++) await solicitarCodigo("8555 3333");
    await expect(solicitarCodigo("8555 3333")).rejects.toThrow(/demasiados códigos/);
  });

  it("PF-28 · un número no registrado recibe la misma respuesta (no se revela si existe) (RN-02.3)", async () => {
    const r = await solicitarCodigo("8444 0000");
    expect(r.ok).toBe(true);
    expect(r.mensaje).toMatch(/Si el número está registrado/);
  });
});

describe("Recordatorios (RF-19)", () => {
  it("PF-43 · genera un solo recordatorio en el panel para citas confirmadas próximas y ninguno para canceladas (RN-19.1, RN-19.3, RN-19.4)", async () => {
    const s = await hastaConfirmada({ horas: 10 });
    const c = await hastaConfirmada({ horas: 12 });
    await rechazarOCancelar(UID, c.id, "Prueba de recordatorio", "negocio");
    await generarRecordatorios();
    await generarRecordatorios();
    const n = await q<{ mensaje: string }>("SELECT mensaje FROM notificacion WHERE tipo = 'Recordatorio'");
    expect(n).toHaveLength(1);
    expect(n[0].mensaje).toMatch(/Maquillaje social/);
    expect(s.cliente.nombre).toBeTruthy();
  });
});

describe("Seguridad del webhook (RNF-04, RNF-09)", () => {
  it("PF-29 · acepta solo avisos firmados con el secreto de la aplicación", () => {
    process.env.WHATSAPP_APP_SECRET = "secreto-de-prueba";
    const cuerpo = JSON.stringify({ entry: [] });
    const firma = "sha256=" + crypto.createHmac("sha256", "secreto-de-prueba").update(cuerpo).digest("hex");
    expect(firmaValida(cuerpo, firma)).toBe(true);
    expect(firmaValida(cuerpo, "sha256=" + "0".repeat(64))).toBe(false);
    expect(firmaValida(cuerpo + " ", firma)).toBe(false);
    expect(firmaValida(cuerpo, null)).toBe(false);
    delete process.env.WHATSAPP_APP_SECRET;
  });
});

afterAll(() => pool.end());
