// MOD-01 Identificación y clientas (CU-01, CU-05, CU-06; RF-01, RF-18).
// La clienta se identifica con nombre y WhatsApp, sin correo ni contraseña (RN-01.1).
// El historial solo se abre con un código de un solo uso enviado por WhatsApp (RN-01.4, RN-18.6 a RN-18.11).
import crypto from "crypto";
import { q, q1, tx } from "@/lib/db";
import { ReglaError } from "@/lib/errores";
import { leerConfig } from "@/lib/config";
import { normalizarWhatsApp } from "@/lib/telefono";
import { COD } from "./estados";
import { despachar } from "./whatsapp/servicio";
import { plantillaCodigo } from "./whatsapp/plantillas";

export type Clienta = { id: string; nombre: string; whatsapp: string; acepta_whatsapp: boolean; acepta_whatsapp_en: Date | null };

export function validarNombre(nombre: string): string {
  const n = (nombre || "").replace(/\s+/g, " ").trim();
  if (n.length < 3 || n.length > 100 || !/\p{L}/u.test(n)) throw new ReglaError("Escribe tu nombre completo (3 a 100 caracteres).");
  if (!n.includes(" ")) throw new ReglaError("Escribe tu nombre y apellido.");
  return n;
}

/** Registra o actualiza a la clienta por su número (RN-01.2) y guarda la aceptación de mensajes con su fecha (RN-01.6). */
export async function identificar(nombre: string, whatsapp: string, acepta: boolean, db = undefined as Parameters<typeof q1>[2]): Promise<Clienta> {
  const n = validarNombre(nombre);
  const w = normalizarWhatsApp(whatsapp);
  if (!w) throw new ReglaError("Escribe un número de WhatsApp válido (8 dígitos en Nicaragua o con código de país).");
  const r = await q1<Clienta>(
    `INSERT INTO cliente (nombre, whatsapp, acepta_whatsapp, acepta_whatsapp_en, activo)
     VALUES ($1, $2, $3, CASE WHEN $3 THEN now() END, true)
     ON CONFLICT (whatsapp) DO UPDATE SET
       nombre = EXCLUDED.nombre,
       acepta_whatsapp = EXCLUDED.acepta_whatsapp,
       acepta_whatsapp_en = CASE WHEN EXCLUDED.acepta_whatsapp AND NOT cliente.acepta_whatsapp THEN now()
                                 WHEN EXCLUDED.acepta_whatsapp THEN cliente.acepta_whatsapp_en ELSE NULL END,
       activo = true
     RETURNING id, nombre, whatsapp, acepta_whatsapp, acepta_whatsapp_en`,
    [n, w, acepta],
    db,
  );
  return r!;
}

export const clientaPorId = (id: string) => q1<Clienta>("SELECT id, nombre, whatsapp, acepta_whatsapp, acepta_whatsapp_en FROM cliente WHERE id = $1", [id]);

const huella = (codigo: string) =>
  crypto.createHmac("sha256", process.env.SESSION_SECRET || "solo-desarrollo").update(codigo).digest("hex");

/** CU-05: la clienta pide el código para ver su historial. Solicitarlo equivale a aceptar ese mensaje (RN-18.7). */
export async function solicitarCodigo(whatsapp: string): Promise<{ ok: boolean; mensaje: string }> {
  const w = normalizarWhatsApp(whatsapp);
  if (!w) throw new ReglaError("Escribe un número de WhatsApp válido.");
  const cfg = await leerConfig();
  const generico = "Si el número está registrado, te enviamos un código por WhatsApp. Escríbelo abajo.";
  const preparado = await tx(async (c) => {
    const cli = await q1<{ id: string }>("SELECT id FROM cliente WHERE whatsapp = $1 AND activo FOR UPDATE", [w], c);
    if (!cli) return null; // no se revela si el número existe (RN-02.3)
    const recientes = await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM codigo_verificacion WHERE cliente_id = $1 AND solicitado_en > now() - interval '1 hour'",
      [cli.id],
      c,
    );
    if ((recientes?.n ?? 0) >= Number(cfg.codigo_max_hora)) throw new ReglaError("Pediste demasiados códigos. Inténtalo dentro de una hora", "RN-18.8");
    await q("UPDATE codigo_verificacion SET estado = 'Vencido' WHERE cliente_id = $1 AND estado IN ('Solicitado','Enviado')", [cli.id], c);
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const p = plantillaCodigo(codigo, Number(cfg.codigo_vigencia_min));
    const m = await q1<{ id: number }>(
      "INSERT INTO mensaje_whatsapp (cliente_id, tipo, plantilla, estado, origen) VALUES ($1,'Código de verificación',$2,'En cola','API') RETURNING id",
      [cli.id, p.nombre],
      c,
    );
    await q(
      `INSERT INTO codigo_verificacion (cliente_id, mensaje_id, codigo_hash, solicitado_en, expira_en, intentos, estado)
       VALUES ($1, $2, $3, now(), now() + make_interval(mins => $4), 0, 'Solicitado')`,
      [cli.id, m!.id, huella(codigo), Number(cfg.codigo_vigencia_min)],
      c,
    );
    return { mensajeId: m!.id, plantilla: p };
  });
  if (!preparado) return { ok: true, mensaje: generico };
  const r = await despachar(preparado.mensajeId, w, preparado.plantilla);
  if (!r.ok) return { ok: false, mensaje: "No fue posible verificar tu identidad por WhatsApp. Puedes consultar a Andrea por WhatsApp (RN-18.10)." };
  return { ok: true, mensaje: generico };
}

/** CU-06: valida el código. Un solo uso, vigencia de 10 min y 3 intentos (RN-18.8, RN-18.11). */
export async function validarCodigo(whatsapp: string, codigo: string): Promise<Clienta> {
  const w = normalizarWhatsApp(whatsapp);
  const limpio = (codigo || "").replace(/\D/g, "");
  if (!w || limpio.length !== 6) throw new ReglaError("Escribe el código de 6 dígitos.");
  const cfg = await leerConfig();
  const resultado = await tx(async (c) => {
    const cod = await q1<{ id: number; cliente_id: string; codigo_hash: string; expira_en: Date; intentos: number; estado: string }>(
      `SELECT v.id, v.cliente_id, v.codigo_hash, v.expira_en, v.intentos, v.estado FROM codigo_verificacion v JOIN cliente c ON c.id = v.cliente_id
       WHERE c.whatsapp = $1 ORDER BY v.solicitado_en DESC LIMIT 1 FOR UPDATE OF v`,
      [w],
      c,
    );
    if (!cod) return { error: "El código no es válido. Pide uno nuevo." };
    if (cod.estado === COD.SOLICITADO) return { error: "El código todavía se está enviando. Espera unos segundos e inténtalo de nuevo." };
    if (cod.estado !== COD.ENVIADO) return { error: "Ese código ya no se puede usar. Pide uno nuevo." };
    if (new Date(cod.expira_en) < new Date()) {
      await q("UPDATE codigo_verificacion SET estado = 'Vencido' WHERE id = $1", [cod.id], c);
      return { error: "El código venció. Pide uno nuevo." };
    }
    const a = Buffer.from(cod.codigo_hash, "hex");
    const b = Buffer.from(huella(limpio), "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      const intentos = cod.intentos + 1;
      const bloqueado = intentos >= Number(cfg.codigo_intentos);
      await q("UPDATE codigo_verificacion SET intentos = $2, estado = $3 WHERE id = $1", [cod.id, intentos, bloqueado ? COD.BLOQUEADO : COD.ENVIADO], c);
      return { error: bloqueado ? "Superaste los intentos permitidos. Pide un código nuevo." : `Código incorrecto. Te quedan ${Number(cfg.codigo_intentos) - intentos} intento(s).` };
    }
    await q("UPDATE codigo_verificacion SET estado = 'Validado', usado_en = now() WHERE id = $1", [cod.id], c);
    return { clienteId: cod.cliente_id };
  });
  if ("error" in resultado) throw new ReglaError(resultado.error!);
  return (await clientaPorId(resultado.clienteId!))!;
}

export type FilaHistorial = {
  id: number; tipo: string; actividad: string; inicio: Date | null; estado: string; precio_total: number | null; anticipo: number | null; pagado: number; fuera_local: boolean; creado_en: Date;
};

/** RF-18: historial de solo lectura de la clienta (fecha, hora, actividad, precio y estado). */
export async function historial(clienteId: string): Promise<FilaHistorial[]> {
  return q<FilaHistorial>(
    `SELECT s.id, s.tipo, COALESCE(sv.nombre, cu.nombre) AS actividad, COALESCE(s.inicio_solicitado, ses.inicio) AS inicio, s.estado,
            co.precio_total, co.anticipo, s.fuera_local, s.creado_en,
            COALESCE((SELECT sum(p.monto) FROM pago p WHERE p.solicitud_id = s.id), 0)::numeric AS pagado
     FROM solicitud_actividad s
     LEFT JOIN servicio sv ON sv.id = s.servicio_id
     LEFT JOIN sesion_curso ses ON ses.id = s.sesion_id LEFT JOIN curso cu ON cu.id = ses.curso_id
     LEFT JOIN cotizacion co ON co.solicitud_id = s.id AND co.vigente
     WHERE s.cliente_id = $1 ORDER BY COALESCE(s.inicio_solicitado, ses.inicio) DESC NULLS LAST, s.creado_en DESC`,
    [clienteId],
  );
}
