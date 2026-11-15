import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nodemailer solo se carga al enviar correos reales (MAIL_MODE=smtp); no se empaqueta con el resto.
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
