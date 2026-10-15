// Firma el token del rol de base de datos de la aplicación (`app_servidor`, migración 0030).
//
// El JWT Secret del proyecto es MÁS poderoso que service_role (permite firmar un token de cualquier rol), por eso NO se guarda en
// el despliegue: se usa una sola vez, aquí, en su máquina, y solo el token resultante va a SUPABASE_APP_TOKEN.
//
// Uso (PowerShell):  $env:SUPABASE_JWT_SECRET = "<JWT Secret>"; npm run token:app -- [años]
//   (JWT Secret: Panel de Supabase → Project Settings → API → JWT Settings → «Legacy JWT secret»). Años por defecto: 10.
// Luego:  Remove-Item Env:SUPABASE_JWT_SECRET   y   poner el token en SUPABASE_APP_TOKEN (y la clave anon en SUPABASE_ANON_KEY).
import { SignJWT } from "jose";

const secreto = process.env.SUPABASE_JWT_SECRET;
if (!secreto || secreto.length < 32) throw new Error("Defina SUPABASE_JWT_SECRET (el JWT Secret del proyecto) en esta sesión");
const anios = Number(process.argv[2] ?? 10);
if (!Number.isFinite(anios) || anios < 1 || anios > 20) throw new Error("Años: un número entre 1 y 20");

const token = await new SignJWT({ role: "app_servidor" })
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setIssuer("supabase")
  .setIssuedAt()
  .setExpirationTime(`${Math.round(anios * 365)}d`)
  .sign(new TextEncoder().encode(secreto));

console.log(token);
console.error(`\nToken del rol app_servidor, válido ${anios} año(s). Guárdelo como SUPABASE_APP_TOKEN; no el JWT Secret.`);
