import { readFileSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { pool, q, q1 } from "@/lib/db";
import { CONFIG_INICIAL } from "@/lib/config";
import { identificar } from "@/modulos/clientas";
import { registrarSolicitudServicio } from "@/modulos/solicitudes";
import { procesarAviso } from "@/modulos/whatsapp/servicio";

/** Borra y vuelve a crear las 30 tablas con los datos mínimos. */
export async function reiniciarBase() {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await pool.query(readFileSync(path.resolve("db/schema.sql"), "utf8"));
  await q("INSERT INTO usuario_admin (usuario, hash_password, rol, activo) VALUES ('admin', $1, 'Administradora', true)", [await bcrypt.hash("prueba-123456", 4)]);
  for (const [k, v] of Object.entries(CONFIG_INICIAL)) await q("INSERT INTO configuracion VALUES ($1,$2,$3)", [k, v.valor, v.descripcion]);
  await q("INSERT INTO servicio (nombre, descripcion, activo) VALUES ('Maquillaje social','Piel, ojos y labios',true), ('Peinado','Recogidos',true), ('Servicio inactivo','x',false)");
  await q(`INSERT INTO curso (nombre, descripcion, modalidad, duracion_min, activo) VALUES
           ('Clase individual','Automaquillaje','individual',180,true), ('Curso grupal','Maquillaje social en grupo','grupal',180,true)`);
}

export const UID = 1;
export const horasDesdeAhora = (h: number) => new Date(Math.round((Date.now() + h * 3600_000) / 60_000) * 60_000);

let n = 1000;
let horaLibre = 400;
export async function clienta(acepta = true, numero?: string) {
  n++;
  // El nombre no admite números (RNF-04): el número de la clienta de prueba se escribe con letras.
  const letras = String(n).split("").map((d) => "abcdefghij"[Number(d)]).join("");
  return identificar(`Clienta Prueba${letras}`, numero ?? `8800${n}`, acepta);
}

export async function solicitudServicio(opc: { horas?: number; acepta?: boolean; numero?: string; domicilio?: boolean } = {}) {
  const c = await clienta(opc.acepta ?? true, opc.numero);
  const id = await registrarSolicitudServicio({
    clienteId: c.id, servicioId: 1, inicio: horasDesdeAhora(opc.horas ?? (horaLibre += 3)), fueraLocal: !!opc.domicilio, direccion: opc.domicilio ? "Barrio Sutiava, casa 12" : undefined,
  });
  return { id, cliente: c };
}

export const estado = async (id: number) => (await q1<{ estado: string }>("SELECT estado FROM solicitud_actividad WHERE id = $1", [id]))!.estado;
export const agendaActiva = (id: number) => q<{ estado: string; inicio: Date; fin: Date }>("SELECT estado, inicio, fin FROM actividad_agenda WHERE solicitud_id = $1 AND estado <> 'Liberada'", [id]);
export const ultimoMensaje = async (solicitudId: number) =>
  (await q1<{ id: number; id_externo: string; estado: string; enviado_en: Date | null; tipo: string }>(
    "SELECT id, id_externo, estado, enviado_en, tipo FROM mensaje_whatsapp WHERE solicitud_id = $1 ORDER BY id DESC LIMIT 1",
    [solicitudId],
  ))!;

/** Simula el aviso del webhook para el último mensaje de la solicitud. */
export async function aviso(solicitudId: number, estadoMeta: "sent" | "delivered" | "read" | "failed", ocurrido = new Date()) {
  const m = await ultimoMensaje(solicitudId);
  return procesarAviso({ idExterno: m.id_externo, estado: estadoMeta, ocurrido, idEvento: `${m.id_externo}:${estadoMeta}`, errorCodigo: estadoMeta === "failed" ? "131026" : undefined, errorDetalle: estadoMeta === "failed" ? "No entregable" : undefined });
}
