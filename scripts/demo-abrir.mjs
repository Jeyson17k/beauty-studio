// Enciende el sistema y, cuando está listo, abre el navegador en el inicio de sesión de Andrea (para la demostración).
// Uso: npm run demo
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");
const hijo = spawn(process.execPath, [next, "dev"], { stdio: ["inherit", "pipe", "inherit"], env: { ...process.env, FORCE_COLOR: "1" } });

let direccion = "";
let abierto = false;

function abrir(url) {
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    const p = spawn(cmd, args, { stdio: "ignore", detached: true });
    p.on("error", () => console.log(`\n>> Abre esta dirección en el navegador: ${url}\n`));
    p.unref();
  } catch {
    console.log(`\n>> Abre esta dirección en el navegador: ${url}\n`);
  }
}

hijo.stdout.on("data", (trozo) => {
  const texto = trozo.toString();
  process.stdout.write(texto);
  const m = texto.match(/Local:\s+(http:\/\/localhost:\d+)/);
  if (m) direccion = m[1];
  if (!abierto && direccion && /Ready/.test(texto)) {
    abierto = true;
    const url = `${direccion}/panel/login`;
    console.log(`\n>> Abriendo ${url}\n`);
    abrir(url);
  }
});

const cerrar = () => hijo.kill();
process.on("SIGINT", cerrar);
process.on("SIGTERM", cerrar);
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
