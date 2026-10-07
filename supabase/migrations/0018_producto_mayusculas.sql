-- El código y el nombre de un producto se guardan siempre en MAYÚSCULA (sin espacios en los extremos; un código
-- vacío queda null). Así los únicos de "Codigo" y "Nombre" ya no distinguen mayúsculas.
create or replace function normalizar_producto() returns trigger
language plpgsql set search_path = public as $$
begin
  new."Codigo" := upper(nullif(btrim(new."Codigo"), ''));
  new."Nombre" := upper(btrim(new."Nombre"));
  return new;
end $$;
revoke all on function normalizar_producto() from public, anon, authenticated;
create trigger trg_normalizar_producto before insert or update on "Productos"
  for each row execute function normalizar_producto();

-- Productos que ya existen: se reescriben para que el trigger los normalice.
update "Productos" set "Codigo" = "Codigo", "Nombre" = "Nombre";
