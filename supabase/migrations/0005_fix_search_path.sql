-- Fija el search_path del trigger de modificación (advertencia del linter de Supabase)
-- y le quita permisos de ejecución a los roles públicos.
alter function public.set_modificacion() set search_path = public;
revoke all on function public.set_modificacion() from public, anon, authenticated;
