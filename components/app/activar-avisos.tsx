"use client";

import { useEffect, useState } from "react";
import { suscribirPush, desuscribirPush } from "@/app/(app)/push/actions";
import { claveAplicacion, debeResuscribir, estadoAvisos, mensajeErrorAvisos, reasignarSuscripcion, type EstadoAvisos } from "@/lib/push-cliente";

const TEXTO: Record<EstadoAvisos, string> = {
  "no-soportado": "Este navegador no permite avisos. Pruebe con Chrome, Edge, Firefox o Safari actualizado.",
  "ios-sin-instalar": "En iPhone y iPad, agregue esta aplicación a la pantalla de inicio (botón Compartir → «Agregar a inicio») y ábrala desde ahí para recibir avisos.",
  bloqueado: "Los avisos están bloqueados en este navegador. Permítalos en la configuración del sitio y vuelva a intentarlo.",
  "sin-configurar": "Los avisos todavía no están configurados en el servidor. Pida al administrador que los habilite.",
  inactivo: "Reciba un aviso en este dispositivo cuando llegue una solicitud o se resuelva la suya.",
  activo: "Los avisos están activados en este dispositivo.",
};

const DESACTIVADO = "inventario:avisos-desactivados"; // la persona eligió «Desactivar avisos» en este navegador: no se re-suscribe sola
const leerDesactivado = () => { try { return localStorage.getItem(DESACTIVADO) === "1"; } catch { return false; } };
const marcarDesactivado = (v: boolean) => { try { if (v) localStorage.setItem(DESACTIVADO, "1"); else localStorage.removeItem(DESACTIVADO); } catch { /* sin almacenamiento */ } };

/** Registra el worker, suscribe al navegador y guarda la suscripción en el servidor (el permiso ya debe estar concedido). Lanza si algo falla. */
async function suscribirDispositivo(clavePublica: string) {
  await navigator.serviceWorker.register("/sw.js");
  const reg = await navigator.serviceWorker.ready;
  const opciones = { userVisibleOnly: true, applicationServerKey: claveAplicacion(clavePublica) as BufferSource };
  let sub: PushSubscription;
  try {
    sub = await reg.pushManager.subscribe(opciones);
  } catch (e) {
    // Una suscripción hecha con otra clave (p. ej. se regeneraron las claves VAPID) bloquea la nueva: se descarta y se reintenta una vez.
    if ((e as { name?: string }).name !== "InvalidStateError") throw e;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    sub = await reg.pushManager.subscribe(opciones);
  }
  const j = sub.toJSON();
  const r = await suscribirPush({ endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth });
  if (r.error) { await sub.unsubscribe(); throw Object.assign(new Error(r.error), { esDeNegocio: true }); }
}

/** Botón «Activar avisos» del Inicio: pide el permiso solo al tocarlo y guarda la suscripción de ESTE dispositivo. */
export default function ActivarAvisos({ clavePublica }: { clavePublica?: string }) {
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const soportado = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const esIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      let suscrito = false;
      if (soportado) {
        try {
          const registro = await navigator.serviceWorker.getRegistration("/sw.js");
          const sub = registro ? await registro.pushManager.getSubscription() : null;
          suscrito = !!sub;
          // Dispositivo compartido: la suscripción pasa a quien tiene la sesión abierta ahora (si no, seguiría avisando a la persona anterior).
          if (sub && Notification.permission === "granted") await reasignarSuscripcion(sub, suscribirPush);
        } catch { /* sin registro todavía */ }
      }
      const datos = { soportado, esIos, instalada, permiso: soportado ? Notification.permission : "default" as const, configurado: !!clavePublica, suscrito };
      // El navegador perdió la suscripción pero el permiso sigue concedido: se suscribe en silencio (si falla, queda el botón).
      if (debeResuscribir({ ...datos, desactivadoPorUsuario: leerDesactivado() })) {
        try { await suscribirDispositivo(clavePublica!); datos.suscrito = true; } catch (e) { console.error("[avisos] no se pudo re-suscribir:", e); }
      }
      if (vivo) setEstado(estadoAvisos(datos));
    })();
    return () => { vivo = false; };
  }, [clavePublica]);

  async function activar() {
    setError(""); setOcupado(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") { setEstado(permiso === "denied" ? "bloqueado" : "inactivo"); return; }
      await suscribirDispositivo(clavePublica!);
      marcarDesactivado(false);
      setEstado("activo");
    } catch (e) {
      console.error("[avisos] no se pudo activar:", e); // la causa real queda en la consola del navegador (F12)
      setError((e as { esDeNegocio?: boolean }).esDeNegocio ? (e as Error).message : mensajeErrorAvisos(e));
    } finally { setOcupado(false); }
  }

  async function desactivar() {
    setError(""); setOcupado(true);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration("/sw.js"))?.pushManager.getSubscription();
      if (sub) {
        const r = await desuscribirPush({ endpoint: sub.endpoint });
        if (r.error) { setError(r.error); return; }
        await sub.unsubscribe();
      }
      marcarDesactivado(true); // la persona lo eligió: no se vuelve a suscribir sola
      setEstado("inactivo");
    } catch {
      setError("No se pudo desactivar los avisos. Intente nuevamente.");
    } finally { setOcupado(false); }
  }

  return (
    <section className="card space-y-2" aria-labelledby="titulo-avisos">
      <h2 id="titulo-avisos" className="section-title">Avisos en este dispositivo</h2>
      <p className="text-sm text-muted" aria-live="polite">{estado ? TEXTO[estado] : "Comprobando…"}</p>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {estado === "inactivo" && <button type="button" className="btn btn-primary" onClick={activar} disabled={ocupado}>{ocupado ? "Activando…" : "Activar avisos"}</button>}
      {estado === "activo" && <button type="button" className="btn btn-secondary" onClick={desactivar} disabled={ocupado}>{ocupado ? "Desactivando…" : "Desactivar avisos"}</button>}
    </section>
  );
}
