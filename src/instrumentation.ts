// MOD-11: inicia el planificador dentro del servidor Node.js (cada 60 s).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentacion-node");
  }
}
