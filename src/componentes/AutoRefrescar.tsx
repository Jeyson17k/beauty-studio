"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Vuelve a consultar la página mientras se espera el aviso de WhatsApp. */
export function AutoRefrescar({ segundos = 3 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
