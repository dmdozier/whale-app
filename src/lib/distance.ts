const EARTH_RADIUS_MILES = 3958.8;

type Coords = { latitude: number; longitude: number };

export function distanceInMiles(from: Coords, to: Coords) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

export function formatDistanceMiles(miles: number) {
  if (miles < 0.1) {
    return 'Nearby';
  }
  if (miles < 10) {
    return `${miles.toFixed(1)} mi away`;
  }
  return `${Math.round(miles)} mi away`;
}
