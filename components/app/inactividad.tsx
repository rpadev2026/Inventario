"use client";

import { useEffect } from "react";
import { intervaloLatidoMs } from "@/lib/auth/inactividad";

const CLAVE = "inventario:ultima-actividad"; // compartida entre pestañas: la actividad en una cuenta para todas
const EVENTOS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;
const ESCRITURA_MS = 1000; // como máximo una marca por segundo
const LATIDO = "/api/sesion/actividad";

/**
 * Cierra la sesión tras `minutos` sin actividad del usuario (mouse, teclado, scroll o toque), en todas las pestañas abiertas.
 * - La marca de actividad vive en localStorage; un reloj la revisa cada pocos segundos y también al volver a la pestaña o al despertar el equipo.
 * - Mientras el usuario está activo, avisa al servidor (`/api/sesion/actividad`, como mucho cada `intervaloLatidoMs`): sin ese aviso el servidor
 *   solo vería «sin peticiones» y echaría a quien lleva minutos escribiendo un formulario. Si el aviso vuelve rechazado, la sesión ya no vale.
 * - El servidor lo exige igualmente en `proxy.ts`; este componente solo hace que la pantalla se cierre sin esperar a la siguiente petición.
 */
export default function Inactividad({ minutos }: { minutos: number }) {
  useEffect(() => {
    const limite = minutos * 60_000;
    const cadaLatido = intervaloLatidoMs(minutos);
    let local = Date.now();
    let escrita = 0;
    let ultimoLatido = 0;
    let latiendo = false;
    let cerrando = false;
    const cerrar = () => {
      if (cerrando) return;
      cerrando = true;
      window.location.replace("/login?cierre=inactividad"); // carga completa: borra de la memoria lo que había en pantalla (el servidor borra la cookie vencida)
    };
    const latir = () => {
      if (latiendo || cerrando) return;
      latiendo = true;
      ultimoLatido = Date.now();
      fetch(LATIDO, { method: "POST", credentials: "same-origin", cache: "no-store", keepalive: true })
        .then((r) => { if (r.redirected || r.status === 401) cerrar(); })
        .catch(() => { /* sin red: no es motivo para cerrar; el servidor decide en la siguiente petición */ })
        .finally(() => { latiendo = false; });
    };
    const marcar = () => {
      local = Date.now();
      if (local - ultimoLatido >= cadaLatido) latir();
      if (local - escrita < ESCRITURA_MS) return;
      escrita = local;
      try { localStorage.setItem(CLAVE, String(local)); } catch { /* sin almacenamiento: queda la marca de esta pestaña */ }
    };
    const ultima = () => {
      try { return Math.max(local, Number(localStorage.getItem(CLAVE)) || 0); } catch { return local; }
    };
    const revisar = () => {
      if (!cerrando && Date.now() - ultima() > limite) cerrar();
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
