// Genera el par de claves VAPID de los avisos push. Uso:  npm run gen:vapid
// La clave PRIVADA no se comparte ni se sube al repositorio: va solo a .env.local y a las variables del despliegue.
import webpush from "web-push";

const k = webpush.generateVAPIDKeys();
console.log("Copie estas líneas a .env.local y a las variables de entorno del despliegue:\n");
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${k.privateKey}`);
console.log("VAPID_SUBJECT=mailto:su-correo@ejemplo.cl   # un correo de contacto o la URL de la aplicación");
