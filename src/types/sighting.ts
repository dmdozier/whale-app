import type { DistanceEstimate, LocationType } from '@/lib/sighting-options';

export type Sighting = {
  id: string;
  latitude: number;
  longitude: number;
  sighted_at: string;
  notes: string | null;
  photo_url: string | null;
  species: { common_name: string } | null;
  location_type: LocationType | null;
  distance_estimate: DistanceEstimate | null;
};
