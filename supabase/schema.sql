-- ============================================================
-- Whale Sightings App — Supabase Schema
-- ============================================================

-- Enable extension for UUID generation
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- Species lookup table (keeps species names consistent)
-- ------------------------------------------------------------
create table species (
  id serial primary key,
  common_name text not null unique,
  sort_order int default 0
);

insert into species (common_name, sort_order) values
  ('Humpback Whale', 1),
  ('Gray Whale', 2),
  ('Orca (Killer Whale)', 3),
  ('Blue Whale', 4),
  ('Minke Whale', 5),
  ('Fin Whale', 6),
  ('Dolphin', 7),
  ('Not Sure', 99);

-- ------------------------------------------------------------
-- Sightings table (the core data)
-- ------------------------------------------------------------
create table sightings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  species_id int references species(id),
  latitude double precision not null,
  longitude double precision not null,
  sighted_at timestamptz not null default now(),   -- when the whale was actually seen
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),   -- when the row was inserted
  client_id text                                    -- optional: id generated on-device, helps de-dupe on sync retries
);

-- Index for map queries (recent sightings, geographic bounds)
create index idx_sightings_sighted_at on sightings (sighted_at desc);
create index idx_sightings_location on sightings (latitude, longitude);
create unique index idx_sightings_client_id on sightings (user_id, client_id) where client_id is not null;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table sightings enable row level security;

-- Everyone (including anonymous, if you allow that) can read all sightings
create policy "Sightings are viewable by everyone"
  on sightings for select
  using (true);

-- Users can only insert their own sightings
create policy "Users can insert their own sightings"
  on sightings for insert
  with check (auth.uid() = user_id);

-- Users can only update/delete their own sightings
create policy "Users can update their own sightings"
  on sightings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own sightings"
  on sightings for delete
  using (auth.uid() = user_id);

-- Species table is public read-only
alter table species enable row level security;
create policy "Species are viewable by everyone"
  on species for select
  using (true);

-- ------------------------------------------------------------
-- Storage bucket for sighting photos
-- ------------------------------------------------------------
-- Run this separately via Supabase dashboard or storage API:
-- create bucket "sighting-photos" with public read access,
-- authenticated write access restricted to the uploading user's folder.
