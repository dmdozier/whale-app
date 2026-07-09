type Coordinate = { latitude: number; longitude: number };
type IdentifiedCoordinate = Coordinate & { id: string };

// ~0.11m of precision — close enough to treat as "the same point" given GPS
// noise, without accidentally merging two genuinely distinct nearby sightings.
const COORD_PRECISION = 6;
// ~14-16m at mid-latitudes — large enough that jittered duplicates clear
// supercluster's clustering radius at an achievable zoom level (~17-18),
// rather than requiring the very edge of what a real MapView can zoom to.
// See the comment on jitterDuplicateCoordinates for how this was picked.
const JITTER_DEGREES = 0.00015;
// The golden angle — the standard increment for spacing N points around a
// spiral (Vogel's model / sunflower phyllotaxis), giving close-to-optimal,
// evenly-spaced packing with a real minimum-gap guarantee between any two
// points, unlike assigning each point an independent random-ish angle and
// radius (which can, by chance, land two points close together).
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function coordKey(coordinate: Coordinate): string {
  return `${coordinate.latitude.toFixed(COORD_PRECISION)},${coordinate.longitude.toFixed(COORD_PRECISION)}`;
}

// Two sightings at the exact same (or near-identical) coordinate can never
// be spatially separated by clustering, no matter how far you zoom in —
// within supercluster's clustering radius, they're always considered part
// of the same cluster. Repeated test saves (or a phone returning a cached
// GPS reading) commonly produce exact or near-duplicates, and without
// this, a cluster made up of them gets permanently stuck: tapping it to
// zoom in just keeps re-clustering the same points, with supercluster
// eventually reporting there's no further zoom level (even at its
// configured max) that would separate them. Spreading duplicates apart
// gives clustering real, distinct coordinates to resolve down to.
//
// Each duplicate's position in the spiral is its index in a *stable sort*
// of its group's ids (not raw array order, and not a hash of the id
// alone). A hash-based angle+radius per id is simpler but doesn't
// guarantee any minimum distance between two particular points — two ids
// can hash to similar angles and radii and end up close together anyway,
// which is exactly what happened here (points still clustered even after
// jittering). The spiral formula (radius growing with sqrt(index), angle
// advancing by the golden angle each step) has a real, well-established
// minimum-gap guarantee between consecutive points. Sorting by id to get
// a stable index means a given sighting's slot only shifts if a
// newly-added duplicate happens to sort earlier than it alphabetically —
// a much smaller blast radius than the original array-order-based version
// (which shifted literally every existing duplicate's position, and
// therefore its reverse-geocode cache key, on every new save at the same
// spot).
//
// Returns a same-length, same-order array — callers zip it back up with
// whatever list of items the coordinates came from.
export function jitterDuplicateCoordinates(items: IdentifiedCoordinate[]): Coordinate[] {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const key = coordKey(item);
    const group = groups.get(key);
    if (group) {
      group.push(item.id);
    } else {
      groups.set(key, [item.id]);
    }
  }
  for (const group of groups.values()) {
    group.sort();
  }

  return items.map((item) => {
    const key = coordKey(item);
    const group = groups.get(key)!;
    if (group.length <= 1) {
      return { latitude: item.latitude, longitude: item.longitude };
    }

    const index = group.indexOf(item.id);
    if (index === 0) {
      return { latitude: item.latitude, longitude: item.longitude };
    }

    const angle = index * GOLDEN_ANGLE;
    const radius = JITTER_DEGREES * Math.sqrt(index);
    return {
      latitude: item.latitude + radius * Math.cos(angle),
      longitude: item.longitude + radius * Math.sin(angle),
    };
  });
}
