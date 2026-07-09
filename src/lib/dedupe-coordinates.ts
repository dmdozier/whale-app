type Coordinate = { latitude: number; longitude: number };
type IdentifiedCoordinate = Coordinate & { id: string };

// ~0.11m of precision — close enough to treat as "the same point" given GPS
// noise, without accidentally merging two genuinely distinct nearby sightings.
const COORD_PRECISION = 6;
// ~4 meters at the equator — enough to give clustering numerically distinct
// coordinates to work with, without visibly misrepresenting where a
// sighting was logged.
const JITTER_DEGREES = 0.00004;
// The golden angle — the standard increment for spacing N points around a
// spiral (Vogel's model / sunflower phyllotaxis) without any two ever
// landing at the same angle, however many points there are.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function coordKey(coordinate: Coordinate): string {
  return `${coordinate.latitude.toFixed(COORD_PRECISION)},${coordinate.longitude.toFixed(COORD_PRECISION)}`;
}

// A simple, deterministic string hash (no cryptographic properties needed —
// just needs to spread different ids across a wide range consistently).
function stableHash(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// Two sightings at the exact same coordinate can never be spatially
// separated by clustering, no matter how far you zoom in — the distance
// between them is zero, so they're always within any cluster radius of
// each other. Repeated test saves (or a phone returning a cached GPS
// reading) commonly produce exact duplicates, and without this, a cluster
// made up entirely of duplicate coordinates gets permanently stuck: tapping
// it to zoom in just keeps re-clustering the same points forever, with no
// way to ever reach the individual pins underneath. Spreading duplicates
// apart by a few meters gives clustering real, distinct coordinates to
// resolve down to.
//
// The offset for a given id is derived purely from a hash of that id, not
// from its position among other duplicates at the same spot — so a
// sighting's jittered coordinate (and the reverse-geocode cache key
// derived from it) stays stable no matter what else gets added to or
// removed from the list, rather than shifting every time a new sighting
// lands at the same spot.
//
// Returns a same-length, same-order array — callers zip it back up with
// whatever list of items the coordinates came from.
export function jitterDuplicateCoordinates(items: IdentifiedCoordinate[]): Coordinate[] {
  const groupSizes = new Map<string, number>();
  for (const item of items) {
    const key = coordKey(item);
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
  }

  return items.map((item) => {
    const key = coordKey(item);
    if ((groupSizes.get(key) ?? 0) <= 1) {
      return { latitude: item.latitude, longitude: item.longitude };
    }

    const hash = stableHash(item.id);
    const angle = (hash % 5000) * GOLDEN_ANGLE;
    const radius = JITTER_DEGREES * (1 + (hash % 12));
    return {
      latitude: item.latitude + radius * Math.cos(angle),
      longitude: item.longitude + radius * Math.sin(angle),
    };
  });
}
