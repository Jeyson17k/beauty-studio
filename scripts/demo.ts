// npm run db:demo → carga productos de ejemplo con existencias y una sesión grupal abierta para presentar el sistema.
// Son datos de demostración: el negocio registrará sus productos reales desde el panel.
import { readFileSync } from "fs";
import path from "path";

for (const archivo of [".env.local", ".env"]) {
  try {
    for (const linea of readFileSync(path.resolve(archivo), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

async function main() {
  const { q1, pool } = await import("../src/lib/db");
  const { guardarProducto, registrarEntrada } = await import("../src/modulos/inventario");
  const { programarSesion } = await import("../src/modulos/catalogo");
  const uid = (await q1<{ id: number }>("SELECT id FROM usuario_admin WHERE usuario = 'admin'"))!.id;
  const cat = async (n: string) => (await q1<{ id: number }>("SELECT id FROM categoria_producto WHERE nombre = $1", [n]))!.id;
  const productos: [string, string, string, number, number, number, number][] = [
    ["Base líquida mate (ejemplo)", "Maquillaje", "Cobertura media, acabado mate.", 650, 2, 6, 380],
    ["Paleta de sombras nude (ejemplo)", "Maquillaje", "12 tonos neutros.", 900, 2, 4, 520],
    ["Labial líquido (ejemplo)", "Maquillaje", "Larga duración.", 320, 3, 10, 150],
    ["Pestañas postizas (ejemplo)", "Accesorios", "Efecto natural, reutilizables.", 250, 5, 3, 90],
    ["Fijador de maquillaje (ejemplo)", "Cuidado de la piel", "Spray de 100 ml.", 480, 2, 5, 260],
    ["Spray texturizante (ejemplo)", "Cabello", "Para recogidos y ondas.", 420, 2, 0, 230],
  ];
  for (const [nombre, categoria, descripcion, precio, minimo, stock, costo] of productos) {
    const existe = await q1("SELECT 1 FROM producto WHERE nombre = $1", [nombre]);
    if (existe) continue;
    const id = await guardarProducto(uid, { categoria_id: await cat(categoria), nombre, descripcion, foto_url: null, precio_venta: precio, stock_minimo: minimo, visible_publico: true, activo: true });
    if (stock > 0) await registrarEntrada(uid, id, stock, costo, "Inventario inicial de demostración");
  }
  const grupal = await q1<{ id: number }>("SELECT id FROM curso WHERE modalidad = 'grupal' AND activo LIMIT 1");
  const yaHay = await q1("SELECT 1 FROM sesion_curso s JOIN curso c ON c.id = s.curso_id WHERE c.modalidad = 'grupal' AND s.inicio > now()");
  if (grupal && !yaHay) {
    const d = new Date(Date.now() + 9 * 86_400_000);
    const inicio = new Date(`${d.toISOString().slice(0, 10)}T09:00:00-06:00`);
    await programarSesion(uid, grupal.id, inicio, 6, true);
  }
  console.log("✔ Datos de demostración cargados (6 productos de ejemplo y una sesión grupal abierta).");
  await pool.end();
}
main().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
