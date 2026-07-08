-- ============================================================
-- Adds the optional "location type" and "distance estimate" fields
-- to a sightings table that was already provisioned from schema.sql
-- before these columns existed. Run this once in the Supabase SQL
-- editor against your existing project — schema.sql itself has also
-- been updated to include these columns for anyone provisioning a
-- fresh database from scratch.
-- ============================================================

alter table sightings
  add column location_type text check (location_type in ('sea', 'land')),
  add column distance_estimate text check (distance_estimate in ('near', 'medium', 'far'));
