// Normaliza números de WhatsApp a formato internacional (+505XXXXXXXX). RN-01.2.
export function normalizarWhatsApp(entrada: string): string | null {
  const bruto = (entrada || "").trim();
  // Solo se aceptan dígitos y los separadores habituales; letras u otros símbolos invalidan el número.
  if (!bruto || /[^\d\s+().-]/.test(bruto) || (bruto.match(/\+/g) ?? []).length > 1 || (bruto.includes("+") && !bruto.startsWith("+"))) return null;
  const digitos = bruto.replace(/[^\d+]/g, "");
  let d = digitos.startsWith("+") ? digitos.slice(1) : digitos;
  if (d.startsWith("00")) d = d.slice(2);
  if (/^\d{8}$/.test(d)) d = `505${d}`; // número local de Nicaragua
  if (!/^\d{10,15}$/.test(d)) return null;
  // Nicaragua: 8 dígitos después del 505; los números válidos empiezan en 2 (fijos) o 5, 7 y 8 (celulares).
  if (d.startsWith("505") && !/^505[2578]\d{7}$/.test(d)) return null;
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
