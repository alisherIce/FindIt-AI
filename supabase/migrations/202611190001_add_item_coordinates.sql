-- Add precise Google Maps coordinates to lost/found reports.
alter table public.items
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.items
  drop constraint if exists items_coordinates_pair_check;

alter table public.items
  add constraint items_coordinates_pair_check
  check (
    (latitude is null and longitude is null)
    or
    (latitude between -90 and 90 and longitude between -180 and 180)
  );

create index if not exists items_country_coordinates_idx
  on public.items (country, latitude, longitude)
  where status = 'active';
