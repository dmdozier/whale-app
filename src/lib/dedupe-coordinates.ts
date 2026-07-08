type Coordinate = { latitude: number; longitude: number };
type IdentifiedCoordinate = Coordinate & { id: string };

// ~0.11m of precision — close enough to treat as "the same point" given GPS
// noise, without accidentally merging two genuinely distinct nearby sightings.
const COORD_PRECISION = 6;
// ~4 meters at the equator — enough to give react-native-map-clustering
// numerically distinct coordinates to work with, without visibly
// misrepresenting where a sighting was logged.
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

// This app's own crash history (see BACKLOG.md and the disabled
// spiralEnabled/animationEnabled props in sightings-map.tsx) points at
// react-native-map-clustering being fragile specifically when many markers
// share the exact same coordinate — that's what spiralEnabled used to paper
// over, before it had to be disabled as a crash mitigation itself. Spreading
// exact-duplicate coordinates apart here means the clustering library never
// actually sees identical points in the first place, sidestepping whatever
// in its native rendering trips over that case, without re-enabling the
// feature already known to crash on its own.
//
// The offset for a given id is derived purely from a hash of that id, not
// from its position among other duplicates at the same spot. An earlier
// version based it on iteration order (effectively "the Nth time this
// coordinate has been seen so far in this call"), which meant an existing
// sighting's jittered coordinate could shift every time a new sighting was
// added at the same spot — since sightings are sorted newest-first, a new
// one always inserts at the front, bumping every later duplicate's index.
// That churn was also breaking the reverse-geocode cache (keyed on
// coordinate), forcing repeated real geocode lookups for sightings that
// had already been geocoded. Hashing the id instead means a sighting's
// jittered position — and therefore its geocode cache key — never changes
// no matter what else gets added to or removed from the list.
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
