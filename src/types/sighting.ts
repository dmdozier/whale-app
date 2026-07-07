export type Sighting = {
  id: string;
  latitude: number;
  longitude: number;
  sighted_at: string;
  notes: string | null;
  photo_url: string | null;
  species: { common_name: string } | null;
};
