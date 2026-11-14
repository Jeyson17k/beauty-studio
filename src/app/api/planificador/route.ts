// Permite ejecutar el planificador desde un cron externo en el VPS: POST con encabezado Authorization: Bearer CRON_SECRET.
import { NextRequest, NextResponse } from "next/server";
import { ejecutarTareas } from "@/modulos/planificador";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(await ejecutarTareas());
}
