type Coordinate = { latitude: number; longitude: number };

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
// Returns a same-length, same-order array — callers zip it back up with
// whatever list of items the coordinates came from.
export function jitterDuplicateCoordinates(coordinates: Coordinate[]): Coordinate[] {
  const occurrences = new Map<string, number>();

  return coordinates.map((coordinate) => {
    const key = `${coordinate.latitude.toFixed(COORD_PRECISION)},${coordinate.longitude.toFixed(COORD_PRECISION)}`;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);

    if (occurrence === 0) {
      return coordinate;
    }

    // Radius grows with sqrt(occurrence) so points spread evenly by area
    // rather than crowding near the center; the golden-angle increment
    // means no two occurrences ever land at the same angle, so — combined
    // with the strictly-increasing radius — no two jittered points can ever
    // coincide, no matter how many duplicates there are at one spot.
    const angle = occurrence * GOLDEN_ANGLE;
    const radius = JITTER_DEGREES * Math.sqrt(occurrence);
    return {
      latitude: coordinate.latitude + radius * Math.cos(angle),
      longitude: coordinate.longitude + radius * Math.sin(angle),
    };
  });
}
