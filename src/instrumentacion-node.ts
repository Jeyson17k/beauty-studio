import { ejecutarTareas } from "./modulos/planificador";

const g = globalThis as unknown as { __bsPlanificador?: NodeJS.Timeout };
if (process.env.PLANIFICADOR !== "off" && !g.__bsPlanificador) {
  const tick = () => ejecutarTareas().catch((e) => console.error("[planificador]", e));
  g.__bsPlanificador = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
  console.log("[planificador] activo: revisa envíos, plazos, códigos y recordatorios cada minuto");
}
