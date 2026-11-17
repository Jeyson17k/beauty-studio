import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nodemailer solo se carga al enviar correos reales (MAIL_MODE=smtp); no se empaqueta con el resto.
  serverExternalPackages: ["nodemailer"],
  // Las acciones de servidor aceptan por defecto 1 MB; las fotos y comprobantes admiten hasta 8 MB.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
