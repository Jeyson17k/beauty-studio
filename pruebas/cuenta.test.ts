// Pruebas del correo de recuperación y de los códigos de un solo uso (recuperar y cambiar la contraseña).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { q, q1, pool } from "@/lib/db";
import {
  consumirCodigo, enviarCodigo, fijarPassword, fijarUsuario, gastarClaveEmergencia, generarClaveEmergencia, guardarCorreo, MAX_INTENTOS, MAX_POR_HORA, normalizarCorreo, normalizarUsuario, ocultarCorreo, recordarUsuario, tieneClaveEmergencia, validarPasswordNueva, verificarClaveEmergencia, validarUsuarioNuevo,
} from "@/modulos/cuenta";
import { validarCredenciales } from "@/modulos/seguridad";
import { reiniciarBase, UID } from "./utilidades";

beforeAll(async () => {
  process.env.MAIL_MODE = "simulado";
  await reiniciarBase();
});
afterAll(() => pool.end());
beforeEach(() => q("DELETE FROM codigo_cuenta"));

const pedir = async (p: "recuperar" | "cambiar" | "correo" | "usuario" = "cambiar", destino = "andrea@ejemplo.com") => (await enviarCodigo(UID, p, destino)).codigo!;

describe("Correo y códigos de la cuenta de Andrea", () => {
  it("PF-44 · el correo se normaliza, se valida y se muestra oculto", () => {
    expect(normalizarCorreo("  Andrea@Ejemplo.COM ")).toBe("andrea@ejemplo.com");
    expect(() => normalizarCorreo("sin-arroba")).toThrow(/correo válido/);
    expect(ocultarCorreo("andrea@gmail.com")).toBe("an****@gmail.com");
  });

  it("PF-45 · un código correcto sirve una sola vez y no se guarda en claro", async () => {
    const cod = await pedir();
    const fila = await q1<{ codigo_hash: string }>("SELECT codigo_hash FROM codigo_cuenta");
    expect(fila!.codigo_hash).not.toContain(cod);
    expect(await consumirCodigo(UID, "cambiar", cod)).toEqual({ destino: "andrea@ejemplo.com" });
    await expect(consumirCodigo(UID, "cambiar", cod)).rejects.toThrow(/ya no sirve/);
  });

  it("PF-46 · el código de un propósito no sirve para otro", async () => {
    const cod = await pedir("recuperar");
    await expect(consumirCodigo(UID, "cambiar", cod)).rejects.toThrow(/ya no sirve/);
    await expect(consumirCodigo(UID, "recuperar", cod)).resolves.toBeTruthy();
  });

  it("PF-47 · pedir un código nuevo anula el anterior", async () => {
    const viejo = await pedir();
    const nuevo = await pedir();
    await expect(consumirCodigo(UID, "cambiar", viejo)).rejects.toThrow();
    await expect(consumirCodigo(UID, "cambiar", nuevo)).resolves.toBeTruthy();
  });

  it("PF-48 · un código vencido se rechaza", async () => {
    const cod = await pedir();
    await q("UPDATE codigo_cuenta SET expira_en = now() - interval '1 minute'");
    await expect(consumirCodigo(UID, "cambiar", cod)).rejects.toThrow(/venció/);
  });

  it(`PF-49 · ${MAX_INTENTOS} intentos fallidos bloquean el código, aunque después se escriba el correcto`, async () => {
    const cod = await pedir();
    const malo = cod === "000000" ? "111111" : "000000";
    for (let i = 1; i < MAX_INTENTOS; i++) await expect(consumirCodigo(UID, "cambiar", malo)).rejects.toThrow(/Código incorrecto/);
    await expect(consumirCodigo(UID, "cambiar", malo)).rejects.toThrow(/demasiadas veces/);
    await expect(consumirCodigo(UID, "cambiar", cod)).rejects.toThrow(/ya no sirve/);
  });

  it("PF-50 · se piden como máximo 5 códigos por hora", async () => {
    for (let i = 0; i < MAX_POR_HORA; i++) await pedir();
    await expect(enviarCodigo(UID, "cambiar", "andrea@ejemplo.com")).rejects.toThrow(/demasiados códigos/);
  });

  it("PF-51 · la contraseña nueva exige 10 caracteres y que coincidan", () => {
    expect(() => validarPasswordNueva("corta", "corta")).toThrow(/10 caracteres/);
    expect(() => validarPasswordNueva("una-clave-larga-1", "otra-clave-larga-2")).toThrow(/no coinciden/);
    expect(() => validarPasswordNueva("una-clave-larga-1", "una-clave-larga-1")).not.toThrow();
  });

  it("PF-52 · tras confirmar el código se puede entrar con la contraseña nueva y no con la vieja", async () => {
    await consumirCodigo(UID, "cambiar", await pedir());
    await fijarPassword(UID, "una-clave-nueva-2026", "cambiar");
    expect(await validarCredenciales("andrea", "una-clave-nueva-2026")).toMatchObject({ usuario: "andrea" });
    expect(await validarCredenciales("andrea", "prueba-123456")).toBeNull();
    expect((await q1<{ n: number }>("SELECT count(*)::int AS n FROM auditoria WHERE accion = 'Cambiar contraseña por correo'"))!.n).toBe(1);
    await q("UPDATE usuario_admin SET hash_password = $1 WHERE id = $2", [await bcrypt.hash("prueba-123456", 4), UID]);
  });

  it("PF-53 · el correo confirmado se guarda y no puede repetirse en otra cuenta", async () => {
    const cod = await pedir("correo", "nuevo@ejemplo.com");
    const { destino } = await consumirCodigo(UID, "correo", cod);
    await guardarCorreo(UID, destino);
    expect((await q1<{ correo: string }>("SELECT correo FROM usuario_admin WHERE id = $1", [UID]))!.correo).toBe("nuevo@ejemplo.com");
    await q("INSERT INTO usuario_admin (usuario, hash_password, rol, activo) VALUES ('otra', 'x', 'Administradora', true)");
    await expect(guardarCorreo(2, "nuevo@ejemplo.com")).rejects.toThrow(/ya está registrado/);
  });

  it("PF-55 · el usuario nuevo se valida, no puede repetirse y se cambia solo con el código del correo", async () => {
    expect(normalizarUsuario("  Andrea.Paola ")).toBe("andrea.paola");
    expect(() => normalizarUsuario("ab")).toThrow(/4 a 30/);
    expect(() => normalizarUsuario("con espacio")).toThrow(/4 a 30/);
    await q("INSERT INTO usuario_admin (usuario, hash_password, rol, activo) VALUES ('ocupado', 'x', 'Administradora', true) ON CONFLICT DO NOTHING");
    await expect(validarUsuarioNuevo(UID, "Ocupado")).rejects.toThrow(/ya está en uso/);
    await expect(validarUsuarioNuevo(UID, "andrea")).rejects.toThrow(/actual/);
    await consumirCodigo(UID, "usuario", await pedir("usuario"));
    expect(await fijarUsuario(UID, "andrea.paola")).toBe("andrea.paola");
    expect(await validarCredenciales("andrea.paola", "prueba-123456")).toMatchObject({ uid: UID });
    expect(await validarCredenciales("andrea", "prueba-123456")).toBeNull();
    expect((await q1<{ n: number }>("SELECT count(*)::int AS n FROM auditoria WHERE accion = 'Cambiar nombre de usuario por correo'"))!.n).toBe(1);
    await q("UPDATE usuario_admin SET usuario = 'andrea' WHERE id = $1", [UID]);
  });

  it("PF-56 · «olvidé mi usuario» envía el usuario al correo y cuenta contra el límite por hora", async () => {
    const r = await recordarUsuario(UID, "andrea", "andrea@ejemplo.com");
    expect(r).toMatchObject({ simulado: true, usuario: "andrea" });
    for (let i = 1; i < MAX_POR_HORA; i++) await recordarUsuario(UID, "andrea", "andrea@ejemplo.com");
    await expect(recordarUsuario(UID, "andrea", "andrea@ejemplo.com")).rejects.toThrow(/demasiados envíos/);
    await expect(consumirCodigo(UID, "recordar", "000000")).rejects.toThrow(/ya no sirve/);
  });

  it("PF-59 · la clave de emergencia permite registrar un correo nuevo sin el correo viejo y se gasta al usarla", async () => {
    await guardarCorreo(UID, "viejo@ejemplo.com");
    const clave = await generarClaveEmergencia(UID);
    expect(clave).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    const fila = await q1<{ clave_emergencia_hash: string }>("SELECT clave_emergencia_hash FROM usuario_admin WHERE id = $1", [UID]);
    expect(fila!.clave_emergencia_hash).not.toContain(clave.replace(/-/g, ""));
    expect(await tieneClaveEmergencia(UID)).toBe(true);
    await expect(verificarClaveEmergencia("andrea", "AAAA-AAAA-AAAA-AAAA")).rejects.toThrow(/no son correctos/);
    await expect(verificarClaveEmergencia("nadie", clave)).rejects.toThrow(/no son correctos/);
    expect(await verificarClaveEmergencia(" Andrea ", clave.toLowerCase().replace(/-/g, " "))).toBe(UID); // tolera minúsculas y separadores
    const cod = await pedir("correo", "nuevo@ejemplo.com");
    expect(await consumirCodigo(UID, "correo", cod)).toEqual({ destino: "nuevo@ejemplo.com" });
    await guardarCorreo(UID, "nuevo@ejemplo.com");
    await gastarClaveEmergencia(UID);
    await expect(verificarClaveEmergencia("andrea", clave)).rejects.toThrow(/no son correctos/);
    expect(await tieneClaveEmergencia(UID)).toBe(false);
    const nueva = await generarClaveEmergencia(UID);
    expect(nueva).not.toBe(clave);
    await expect(verificarClaveEmergencia("andrea", clave)).rejects.toThrow();
    await q("UPDATE usuario_admin SET correo = NULL, clave_emergencia_hash = NULL WHERE id = $1", [UID]);
  });
});
