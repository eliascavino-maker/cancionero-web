-- 6 · Señales del director en la Sala en vivo.
--
-- Reglas:
--   · Cada banda tiene su lista de señales: hasta 12, cada una con texto (1 a
--     24 letras), color '#rrggbb' y si vibra. Sin lista (null), la app usa las
--     de fábrica.
--   · Los miembros la leen con la banda. Solo el owner la cambia, con
--     set_live_signals; nadie escribe bands directo.
--   · Las señales y la cuenta regresiva en sí van por broadcast en el canal
--     privado 'live:<band_id>' (migración 5), como la posición: no pasan por
--     la base. Esta migración no toca Realtime.

/** La lista es válida: null, o de 1 a 12 señales bien formadas. */
create function private.valid_signals(s jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select s is null or (
    jsonb_typeof(s) = 'array'
    and jsonb_array_length(s) between 1 and 12
    and not exists (
      select 1 from jsonb_array_elements(s) e
      where case
        when jsonb_typeof(e) <> 'object' then true
        else jsonb_typeof(e -> 'text') is distinct from 'string'
          or length(trim(e ->> 'text')) not between 1 and 24
          or jsonb_typeof(e -> 'color') is distinct from 'string'
          or (e ->> 'color') !~ '^#[0-9a-fA-F]{6}$'
          or jsonb_typeof(coalesce(e -> 'vibrate', 'false')) <> 'boolean'
          or exists (select 1 from jsonb_object_keys(e) k where k not in ('text', 'color', 'vibrate'))
      end
    )
  )
$$;

alter table public.bands
  add column live_signals jsonb check (private.valid_signals(live_signals));

/**
 * Cambia las señales de la banda. Solo el owner. null vuelve a las de
 * fábrica. Guarda el texto sin espacios de más y el color en minúsculas.
 */
create function public.set_live_signals(band uuid, signals jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_account();
  perform private.require_owner(band);
  if not private.valid_signals(signals) then
    raise exception 'Señales inválidas: de 1 a 12, cada una con texto de 1 a 24 letras y color #rrggbb'
      using errcode = '22023';
  end if;
  update public.bands set live_signals = (
    select jsonb_agg(
      jsonb_build_object(
        'text', trim(e ->> 'text'),
        'color', lower(e ->> 'color'),
        'vibrate', coalesce((e ->> 'vibrate')::boolean, false)
      ) order by i)
    from jsonb_array_elements(signals) with ordinality as t(e, i)
  )
  where id = band;
end $$;

-- Las funciones nacen ejecutables por PUBLIC: se cierra y se abre solo a
-- authenticated (valid_signals también a service_role: lo usa el check).
revoke execute on function
  private.valid_signals(jsonb),
  public.set_live_signals(uuid, jsonb)
from public, anon;
grant execute on function private.valid_signals(jsonb) to authenticated, service_role;
grant execute on function public.set_live_signals(uuid, jsonb) to authenticated;
