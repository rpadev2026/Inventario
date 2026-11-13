import type { MetadataRoute } from "next";

// Necesario para instalar la aplicación en la pantalla de inicio (en iPhone los avisos push solo funcionan así). Colores de tema.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inventario del Restaurant",
    short_name: "Inventario",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#047857",
    icons: [{ src: "/icono.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
