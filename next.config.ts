import type { NextConfig } from "next";

// Para abrir la app desde otro equipo (p. ej. un dev tunnel de VS Code): descomentar este bloque y
// las líneas comentadas dentro de nextConfig, y definir ORIGENES_PERMITIDOS.
// Hosts extra (p. ej. un dev tunnel de VS Code) desde los que se puede usar la app,
// separados por coma: ORIGENES_PERMITIDOS=abc123-3000.brs.devtunnels.ms
// const origenesPermitidos = (process.env.ORIGENES_PERMITIDOS ?? "")
//   .split(",")
//   .map((o) => o.trim())
//   .filter(Boolean);

const nextConfig: NextConfig = {
  serverExternalPackages: ["argon2"],
  // allowedDevOrigins: origenesPermitidos.map((o) => o.split(":")[0]),
  // // En desarrollo, VS Code agrega x-forwarded-host (el del túnel) incluso al abrir
  // // localhost:3000, así que ese origen local también debe estar permitido.
  // experimental: {
  //   serverActions: {
  //     allowedOrigins:
  //       process.env.NODE_ENV === "production" ? origenesPermitidos : ["localhost:3000", ...origenesPermitidos],
  //   },
  // },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // La Content-Security-Policy (con nonce por petición) se fija en proxy.ts.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
