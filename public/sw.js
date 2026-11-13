// Service worker de los avisos push. Sin dependencias: se sirve tal cual desde /sw.js (público, ver proxy.ts).
// Misma regla que lib/push-url.ts (hay una prueba que las compara): solo se abren rutas internas.
function rutaInterna(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !url.includes("\\") ? url : "/";
}

self.addEventListener("push", (event) => {
  let datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch { datos = {}; }
  const titulo = typeof datos.titulo === "string" && datos.titulo ? datos.titulo : "Inventario del Restaurant";
  event.waitUntil(self.registration.showNotification(titulo, {
    body: typeof datos.cuerpo === "string" ? datos.cuerpo : "",
    tag: typeof datos.tag === "string" ? datos.tag : undefined, // la misma solicitud reemplaza su aviso anterior
    data: { url: rutaInterna(datos.url) },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = rutaInterna(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const v of ventanas) {
      if ("focus" in v && "navigate" in v) { await v.focus(); await v.navigate(destino); return; }
    }
    await self.clients.openWindow(rutaInterna(destino));
  })());
});
