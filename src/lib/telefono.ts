// Normaliza números de WhatsApp a formato internacional (+505XXXXXXXX). RN-01.2.
export function normalizarWhatsApp(entrada: string): string | null {
  const digitos = (entrada || "").replace(/[^\d+]/g, "");
  let d = digitos.startsWith("+") ? digitos.slice(1) : digitos;
  if (d.startsWith("00")) d = d.slice(2);
  if (/^\d{8}$/.test(d)) d = `505${d}`; // número local de Nicaragua
  if (!/^\d{10,15}$/.test(d)) return null;
  return `+${d}`;
}

export function mostrarWhatsApp(e164: string): string {
  const m = /^\+505(\d{4})(\d{4})$/.exec(e164);
  return m ? `+505 ${m[1]}-${m[2]}` : e164;
}

/** Enlace wa.me con texto preparado para el envío manual (RN-11.7). */
export function enlaceWhatsApp(e164: string, texto: string): string {
  return `https://wa.me/${e164.replace("+", "")}?text=${encodeURIComponent(texto)}`;
}
