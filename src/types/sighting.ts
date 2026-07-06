export type Sighting = {
  id: string;
  latitude: number;
  longitude: number;
  sighted_at: string;
  notes: string | null;
  species: { common_name: string } | null;
};
