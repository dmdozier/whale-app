-- ============================================================
-- Whale Sightings App — Storage bucket for sighting photos
-- Run this once in the Supabase SQL editor (after schema.sql).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('sighting-photos', 'sighting-photos', true)
on conflict (id) do nothing;

-- Anyone can view sighting photos (matches the public "sightings are
-- viewable by everyone" policy on the sightings table).
create policy "Sighting photos are viewable by everyone"
  on storage.objects for select
  using (bucket_id = 'sighting-photos');

-- Users can only upload into a folder named after their own user id
-- (the app uploads to `${user.id}/${filename}`).
create policy "Users can upload their own sighting photos"
  on storage.objects for insert
  with check (
    bucket_id = 'sighting-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
