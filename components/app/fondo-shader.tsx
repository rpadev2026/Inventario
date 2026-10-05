"use client";
import { useSyncExternalStore } from "react";
import { MeshGradient } from "@paper-design/shaders-react";

/*
 * Fondo animado de la pantalla de ingreso (excepción aprobada a «sin degradados» solo para el login).
 * Paleta de la marca «Pizarra y esmeralda»: los hex repiten variables de app/tema.css, porque el shader
 * recibe los colores como texto y no puede leer variables CSS.
 *   claro : --side-bg #0f172a · --primary-hover #065f46 · --primary #047857 · --side-active #34d399
 *   oscuro: --side-bg #080d19 · #0f172a · --primary-hover #065f46 · --primary #10b981
 * Parámetros de movimiento tal como el ejemplo original (speed 1). Si el rendimiento no es bueno, bajar SPEED a 0.
 */
const PALETA_CLARA = ["#0f172a", "#065f46", "#047857", "#34d399"];
const PALETA_OSCURA = ["#080d19", "#0f172a", "#065f46", "#10b981"];
const SPEED = 1;

/** Preferencia del sistema (modo oscuro, reducir movimiento) que se actualiza si el usuario la cambia. */
function useMediaQuery(consulta: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(consulta);
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    () => window.matchMedia(consulta).matches,
    () => false, // en el servidor: modo claro y con movimiento
  );
}

export default function FondoShader() {
  const oscuro = useMediaQuery("(prefers-color-scheme: dark)");
  const reducirMovimiento = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    // Capa decorativa detrás del contenido: no recibe clics ni la lee un lector de pantalla.
    <div aria-hidden="true" className="fixed inset-0 -z-10 pointer-events-none">
      <MeshGradient
        style={{ width: "100%", height: "100%" }}
        distortion={0.8}
        swirl={0.1}
        offsetX={0}
        offsetY={0}
        scale={1}
        rotation={0}
        speed={reducirMovimiento ? 0 : SPEED}
        colors={oscuro ? PALETA_OSCURA : PALETA_CLARA}
      />
    </div>
  );
}
