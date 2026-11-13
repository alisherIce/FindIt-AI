-- FindIt AI: shared lost-and-found database and public item-photo storage.
-- Run this file once in Supabase SQL Editor.

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('lost', 'found')),
  title text not null check (char_length(title) between 2 and 120),
  category text not null,
  campus text not null,
  country text not null default 'South Korea',
  location text not null,
  description text not null default '',
  image_path text not null,
  status text not null default 'active' check (status in ('active', 'resolved')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists items_active_created_at_idx
  on public.items (created_at desc)
  where status = 'active';

create index if not exists items_owner_created_at_idx
  on public.items (owner_id, created_at desc);

alter table public.items enable row level security;

drop policy if exists "Anyone can view active reports" on public.items;
create policy "Anyone can view active reports"
  on public.items for select
  using (status = 'active' or owner_id = auth.uid());

drop policy if exists "Signed-in users can create their own reports" on public.items;
create policy "Signed-in users can create their own reports"
  on public.items for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Owners can update their own reports" on public.items;
create policy "Owners can update their own reports"
  on public.items for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners can delete their own reports" on public.items;
create policy "Owners can delete their own reports"
  on public.items for delete
  to authenticated
  using (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-photos',
  'item-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Public can view item photos" on storage.objects;
create policy "Public can view item photos"
  on storage.objects for select
  using (bucket_id = 'item-photos');

drop policy if exists "Users can upload photos into their own folder" on storage.objects;
create policy "Users can upload photos into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update photos in their own folder" on storage.objects;
create policy "Users can update photos in their own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete photos in their own folder" on storage.objects;
create policy "Users can delete photos in their own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
