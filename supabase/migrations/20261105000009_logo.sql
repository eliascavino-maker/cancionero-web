-- 9 · Logo de la banda, en Storage.
--
-- Reglas:
--   · Bucket privado band-logos: cada banda tiene su carpeta <band_id>/.
--     Solo PNG, JPG o WebP (nada de SVG, que puede llevar código), hasta 512 KB.
--   · Los miembros lo ven (con URL firmada); solo el owner lo sube, lo cambia
--     o lo borra.
--   · bands.logo_path dice cuál es el logo vigente. Lo cambia el owner con
--     set_band_logo; nadie escribe bands directo.

alter table public.bands
  add column logo_path text,
  add constraint bands_logo_path check (
    logo_path is null
    or (starts_with(logo_path, id::text || '/') and logo_path ~ '^[0-9a-f-]{36}/logo-[0-9]{1,16}\.(png|jpg|webp)$'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('band-logos', 'band-logos', false, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

/** La banda dueña de un archivo de band-logos (su primera carpeta), o null. */
create function private.logo_band(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
    then split_part(object_name, '/', 1)::uuid
  end
$$;

create policy band_logos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'band-logos' and not private.is_anon() and private.is_member(private.logo_band(name)));

create policy band_logos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'band-logos' and private.is_owner(private.logo_band(name)));

create policy band_logos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'band-logos' and private.is_owner(private.logo_band(name)))
  with check (bucket_id = 'band-logos' and private.is_owner(private.logo_band(name)));

create policy band_logos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'band-logos' and private.is_owner(private.logo_band(name)));

/** El owner pone el logo (ya subido a su carpeta) o lo saca con null. */
create function public.set_band_logo(band uuid, path text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_account();
  perform private.require_owner(band);
  update public.bands set logo_path = path where id = band;
end $$;

revoke execute on function private.logo_band(text) from public, anon;
grant execute on function private.logo_band(text) to authenticated;
revoke execute on function public.set_band_logo(uuid, text) from public, anon;
grant execute on function public.set_band_logo(uuid, text) to authenticated;
