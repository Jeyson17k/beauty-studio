// Uso:
//   npm run db:crear      → crea las 31 tablas del modelo físico (db/schema.sql)
//   npm run db:semilla    → carga los datos iniciales (Andrea, servicios, cursos, configuración)
//   npm run db:reiniciar  → BORRA todo, vuelve a crear las tablas y carga los datos iniciales (solo en pruebas)
import { readFileSync } from "fs";
import path from "path";
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { CONFIG_INICIAL } from "../src/lib/config";

function cargarEnv() {
  for (const archivo of [".env.local", ".env"]) {
    try {
      for (const linea of readFileSync(path.resolve(archivo), "utf8").split(/\r?\n/)) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      /* el archivo puede no existir */
    }
  }
}

async function crear(c: Client) {
  const sql = readFileSync(path.resolve("db/schema.sql"), "utf8");
  await c.query(sql);
  console.log("✔ Tablas creadas (31).");
}

async function migrar(c: Client) {
  await c.query(readFileSync(path.resolve("db/migraciones.sql"), "utf8"));
  console.log("✔ Cambios del modelo aplicados (correo de recuperación y códigos por correo).");
}

async function semilla(c: Client) {
  const pass = process.env.ADMIN_PASSWORD || "BeautyStudio2026!";
  await c.query(
    `INSERT INTO usuario_admin (usuario, hash_password, rol, activo) VALUES ('andrea', $1, 'Administradora', true)
     ON CONFLICT (usuario) DO NOTHING`,
    [await bcrypt.hash(pass, 10)],
  );
  // Correo de recuperación (opcional): ADMIN_EMAIL. Andrea también puede registrarlo desde Configuración.
  const correo = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (correo) await c.query("UPDATE usuario_admin SET correo = $1 WHERE usuario = 'andrea' AND correo IS NULL", [correo]);
  for (const [clave, v] of Object.entries(CONFIG_INICIAL)) {
    await c.query("INSERT INTO configuracion (clave, valor, descripcion) VALUES ($1,$2,$3) ON CONFLICT (clave) DO NOTHING", [clave, v.valor, v.descripcion]);
  }
  const servicios = [
    ["Maquillaje social", "Piel, ojos y labios para eventos de día o de noche.", "/img/svc_makeup.jpg"],
    ["Maquillaje de novia", "Maquillaje de larga duración para el día de tu boda, con prueba previa.", "/img/svc_makeup2.jpg"],
    ["Peinado", "Recogidos, ondas y semirrecogidos.", "/img/svc_hair.jpg"],
    ["Maquillaje y peinado", "Combinación de maquillaje social y peinado.", "/img/svc_hair2.jpg"],
  ];
  for (const [nombre, descripcion, img] of servicios) {
    await c.query("INSERT INTO servicio (nombre, descripcion, precio_base, imagen_url, activo) VALUES ($1,$2,NULL,$3,true) ON CONFLICT (nombre) DO NOTHING", [nombre, descripcion, img]);
  }
  await c.query(
    `INSERT INTO curso (nombre, descripcion, modalidad, duracion_min, precio_base, activo) VALUES
     ('Clase individual de automaquillaje', 'Aprende a maquillarte para el día a día y para eventos. Una sesión de 3 horas con Andrea.', 'individual', 180, NULL, true),
     ('Curso grupal de maquillaje social', 'Técnicas de piel, ojos y labios en grupo pequeño. Sesión de 3 horas.', 'grupal', 180, NULL, true)
     ON CONFLICT (nombre) DO NOTHING`,
  );
  const categoriasGasto = ["Costo de servicios y cursos", "Transporte", "Servicios básicos", "Alquiler", "Publicidad", "Otros gastos operativos"];
  for (const n of categoriasGasto) await c.query("INSERT INTO categoria_gasto (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING", [n]);
  const categoriasProducto = ["Maquillaje", "Cuidado de la piel", "Cabello", "Accesorios"];
  for (const n of categoriasProducto) await c.query("INSERT INTO categoria_producto (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING", [n]);
  console.log("✔ Datos iniciales cargados. Usuario del panel: andrea · contraseña: la de ADMIN_PASSWORD.");
}

async function main() {
  cargarEnv();
  const accion = process.argv[2];
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    if (accion === "reiniciar") {
      await c.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      await crear(c);
      await semilla(c);
    } else if (accion === "crear") {
      const existe = await c.query("SELECT to_regclass('public.solicitud_actividad') AS t");
      if (existe.rows[0].t) {
        console.log("Las tablas ya existen; sus datos no se tocan. Usa db:reiniciar para empezar de cero.");
        await migrar(c);
      } else await crear(c);
    } else if (accion === "semilla") await semilla(c);
    else console.log("Acciones: crear | semilla | reiniciar");
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
