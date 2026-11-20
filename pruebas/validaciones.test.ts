// Pruebas de las validaciones de los formularios (RNF-04): datos con letras donde van números y al revés.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { normalizarWhatsApp } from "@/lib/telefono";
import { entero, leerNumero, monto, nombrePersona, textoConLetras } from "@/lib/validar";
import { identificar } from "@/modulos/clientas";
import { guardarProducto, registrarEntrada, registrarGasto } from "@/modulos/inventario";
import { crearPedido } from "@/modulos/pedidos";
import { guardarCotizacion, registrarSolicitudServicio } from "@/modulos/solicitudes";
import { clienta, horasDesdeAhora, reiniciarBase, solicitudServicio, UID } from "./utilidades";

beforeAll(() => reiniciarBase());
afterAll(() => pool.end());

describe("Nombre de la clienta", () => {
  it("PF-60 · acepta nombres con tildes, ñ, apóstrofo y guion", () => {
    expect(nombrePersona("  maría   josé  Núñez ")).toBe("maría josé Núñez");
    expect(nombrePersona("Ana O'Neill")).toBe("Ana O'Neill");
    expect(nombrePersona("Karla Pérez-López")).toBe("Karla Pérez-López");
  });
  it.each(["Ana 123", "12345678", "Ana Ruiz 2", "88881234 Ana"])("PF-61 · rechaza números en el nombre: «%s»", (n) => {
    expect(() => nombrePersona(n)).toThrow(/números/);
  });
  it.each(["Ana @Ruiz", "Ana_Ruiz Pérez", "Ana Ruiz!!", "<b>Ana</b> Ruiz"])("PF-62 · rechaza símbolos: «%s»", (n) => {
    expect(() => nombrePersona(n)).toThrow(/solo puede llevar letras/);
  });
  it.each(["Ana", "Ana R", "  "])("PF-63 · exige nombre y apellido: «%s»", (n) => {
    expect(() => nombrePersona(n)).toThrow();
  });
  it("PF-64 · identificarse con un nombre que lleva números no registra a la clienta", async () => {
    await expect(identificar("Lucía 2024", "8777 4444", true)).rejects.toThrow(/números/);
  });
});

describe("Número de WhatsApp", () => {
  it("PF-65 · acepta los formatos habituales de Nicaragua", () => {
    expect(normalizarWhatsApp("8888 1234")).toBe("+50588881234");
    expect(normalizarWhatsApp("8888-1234")).toBe("+50588881234");
    expect(normalizarWhatsApp("+505 5726 6176")).toBe("+50557266176");
    expect(normalizarWhatsApp("(505) 7777-1111")).toBe("+50577771111");
  });
  it.each(["abc88881234", "8888 12a4", "ochocientos", "8888*1234", "88+881234"])("PF-66 · rechaza letras o símbolos: «%s»", (w) => {
    expect(normalizarWhatsApp(w)).toBeNull();
  });
  it.each(["1234 5678", "0888 1234", "888 1234", "8888 12345", "+505 1888 1234"])("PF-67 · rechaza números nicaragüenses imposibles: «%s»", (w) => {
    expect(normalizarWhatsApp(w)).toBeNull();
  });
});

describe("Montos, cantidades y textos", () => {
  it("PF-68 · leerNumero solo acepta cifras", () => {
    expect(leerNumero("1,300.50")).toBe(1300.5);
    expect(leerNumero("1300")).toBe(1300);
    expect(leerNumero("12abc")).toBeNaN();
    expect(leerNumero("mil")).toBeNaN();
    expect(leerNumero("")).toBeNaN();
  });
  it("PF-69 · los montos deben ser positivos, con hasta dos decimales y dentro del tope", () => {
    expect(monto(1300.5, "el precio")).toBe(1300.5);
    expect(() => monto(NaN, "el precio")).toThrow(/números/);
    expect(() => monto(-5, "el precio")).toThrow(/mayor que cero/);
    expect(() => monto(0, "el precio")).toThrow(/mayor que cero/);
    expect(() => monto(10.555, "el precio")).toThrow(/dos decimales/);
    expect(() => monto(2_000_000, "el precio")).toThrow(/no puede pasar/);
    expect(monto(0, "el costo", { permitirCero: true })).toBe(0);
  });
  it("PF-70 · las cantidades son enteras y dentro del rango", () => {
    expect(entero(3, "la cantidad", 1, 99)).toBe(3);
    expect(() => entero(2.5, "la cantidad", 1, 99)).toThrow(/entero/);
    expect(() => entero(0, "la cantidad", 1, 99)).toThrow(/entre 1 y 99/);
  });
  it("PF-71 · un texto que debe decir algo no puede ser solo números o símbolos", () => {
    expect(textoConLetras("Compra de labiales", "el concepto", 3, 120)).toBe("Compra de labiales");
    expect(() => textoConLetras("12345", "el concepto", 3, 120)).toThrow(/palabras/);
    expect(() => textoConLetras("!!!???", "el motivo", 3, 120)).toThrow(/palabras/);
  });
});

describe("Formularios del sistema", () => {
  it("PF-72 · la dirección del domicilio no puede ser solo números", async () => {
    const c = await clienta();
    await expect(
      registrarSolicitudServicio({ clienteId: c.id, servicioId: 1, inicio: horasDesdeAhora(900), fueraLocal: true, direccion: "123456" }),
    ).rejects.toThrow(/palabras/);
  });
  it("PF-73 · el pedido con delivery exige una dirección con palabras", async () => {
    const c = await clienta();
    await expect(crearPedido(c.id, { entrega: "delivery", direccion: "00000" })).rejects.toThrow(/palabras/);
  });
  it("PF-74 · la cotización rechaza precios con más de dos decimales", async () => {
    const { id } = await solicitudServicio();
    await expect(guardarCotizacion(UID, id, 1300.555, 180, null)).rejects.toThrow(/dos decimales/);
  });
  it("PF-75 · el producto exige nombre con letras, precio válido y stock mínimo entero", async () => {
    const base = { categoria_id: 1, nombre: "Labial rojo", descripcion: null, foto_url: null, precio_venta: 250, stock_minimo: 2, visible_publico: true, activo: true };
    await expect(guardarProducto(UID, { ...base, nombre: "12345" })).rejects.toThrow(/palabras/);
    await expect(guardarProducto(UID, { ...base, precio_venta: NaN })).rejects.toThrow();
    await expect(guardarProducto(UID, { ...base, stock_minimo: 1.5 })).rejects.toThrow(/entero/);
  });
  it("PF-76 · la entrada de inventario rechaza cantidades decimales o desmedidas", async () => {
    await expect(registrarEntrada(UID, 1, 2.5, 100, "Compra")).rejects.toThrow(/entero/);
    await expect(registrarEntrada(UID, 1, 50_000, 100, "Compra")).rejects.toThrow(/entre 1 y 10000/);
  });
  it("PF-77 · el gasto rechaza concepto sin palabras y fechas futuras", async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    await expect(registrarGasto(UID, { categoriaId: 1, concepto: "999", monto: 100, fecha: hoy })).rejects.toThrow(/palabras/);
    await expect(registrarGasto(UID, { categoriaId: 1, concepto: "Luz del local", monto: 100, fecha: "2099-01-01" })).rejects.toThrow(/futuro/);
  });
});
