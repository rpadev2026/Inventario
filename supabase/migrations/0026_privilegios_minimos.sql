-- Auditoría S08 (defensa en profundidad): anon y authenticated no deben poder usar nada de public.
-- La aplicación solo usa service_role en el servidor; hasta ahora eso se cumplía porque cada migración
-- recordaba hacer `revoke`, mientras que los privilegios por defecto de Supabase conceden acceso a TODO
-- lo que se crea. Aquí se retiran esos privilegios por defecto y los que quedaban en secuencias.

-- Lo que se cree desde ahora (como postgres) nace sin acceso para anon/authenticated; service_role lo conserva.
alter default privileges for role postgres revoke all on tables from anon, authenticated;
alter default privileges for role postgres revoke all on sequences from anon, authenticated;
alter default privileges for role postgres revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
-- PostgreSQL concede EXECUTE a PUBLIC en toda función nueva (anon lo hereda): también se retira por defecto.
alter default privileges for role postgres revoke execute on functions from public;

-- Lo que ya existe: las secuencias (identidades) conservaban USAGE; se refuerzan tablas y funciones.
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
