"use client";

import { useEffect } from "react";
import { cerrarPorInactividad } from "@/app/login/actions";

const CLAVE = "inventario:ultima-actividad"; // compartida entre pestañas: la actividad en una cuenta para todas
const EVENTOS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;
const ESCRITURA_MS = 1000; // como máximo una marca por segundo

/**
 * Cierra la sesión tras `minutos` sin actividad del usuario (mouse, teclado, scroll o toque), en todas las pestañas abiertas.
 * La marca vive en localStorage; un reloj revisa cada pocos segundos y también al volver a la pestaña o despertar el equipo.
 * El servidor lo exige igualmente en `proxy.ts` (este componente solo hace que la pantalla se cierre sin esperar a la siguiente petición).
 */
export default function Inactividad({ minutos }: { minutos: number }) {
  useEffect(() => {
    const limite = minutos * 60_000;
    let local = Date.now();
    let escrita = 0;
    let cerrando = false;
    const marcar = () => {
      local = Date.now();
      if (local - escrita < ESCRITURA_MS) return;
      escrita = local;
      try { localStorage.setItem(CLAVE, String(local)); } catch { /* sin almacenamiento: queda la marca de esta pestaña */ }
    };
    const ultima = () => {
      try { return Math.max(local, Number(localStorage.getItem(CLAVE)) || 0); } catch { return local; }
    };
    const revisar = () => {
      if (cerrando || Date.now() - ultima() <= limite) return;
      cerrando = true;
      // Revoca los tokens y borra la cookie; pase lo que pase (red, sesión ya vencida) se vuelve al ingreso.
      cerrarPorInactividad().catch(() => {}).finally(() => window.location.replace("/login?cierre=inactividad") /* carga completa: borra de la memoria lo que había en pantalla */);
    };
    marcar();
    for (const e of EVENTOS) window.addEventListener(e, marcar, { passive: true, capture: true });
    const reloj = setInterval(revisar, Math.min(5000, Math.max(1000, limite / 4)));
    document.addEventListener("visibilitychange", revisar);
    window.addEventListener("focus", revisar);
    return () => {
      for (const e of EVENTOS) window.removeEventListener(e, marcar, { capture: true });
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", revisar);
      window.removeEventListener("focus", revisar);
    };
  }, [minutos]);
  return null;
}
