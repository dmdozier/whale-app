import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { recordBreadcrumb } from '@/lib/breadcrumbs';

const CACHE_KEY = 'whale-app/geocode-cache';
// ~0.0001 degrees is roughly 11m. Labels can now resolve down to street/
// landmark level, so the cache grid needs to be tight enough that two
// distinct nearby addresses don't collapse into the same cached label.
const PRECISION = 4;

let memoryCache: Record<string, string> | null = null;

async function loadCache(): Promise<Record<string, string>> {
  if (!memoryCache) {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    memoryCache = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  }
  return memoryCache;
}

function cacheKeyFor(latitude: number, longitude: number) {
  return `${latitude.toFixed(PRECISION)},${longitude.toFixed(PRECISION)}`;
}

// Apple's CLGeocoder (what reverseGeocodeAsync wraps on iOS) is documented
// as not supporting overlapping geocode requests — the constraint is on
// the shared system geocoding service, not on reusing one CLGeocoder
// instance, so creating a fresh instance per call (which the native side
// already does) doesn't sidestep it. Every Map marker independently calls
// getLocationLabel on mount, so a data refresh that mounts/updates several
// markers at once — e.g. right after saving a new sighting — can fire
// several of these concurrently. Chaining every actual (non-cached) call
// through this queue means only one reverseGeocodeAsync call is ever in
// flight at a time, app-wide.
let geocodeQueue: Promise<unknown> = Promise.resolve();

function formatAddress(address: Location.LocationGeocodedAddress): string {
  const streetAddress =
    [address.streetNumber, address.street].filter(Boolean).join(' ') || undefined;
  // `name` is a named landmark/POI when the geocoder recognizes one at this
  // spot (e.g. "Alki Beach Park") — but for plain addresses it's often just
  // the street address again, so only treat it as a landmark when it differs.
  const landmark = address.name && address.name !== streetAddress ? address.name : undefined;

  const specific = landmark ?? streetAddress ?? address.district ?? undefined;
  const city = address.city ?? address.subregion ?? undefined;
  const region = address.region ?? undefined;

  if (specific && city) {
    return `${specific}, ${city}`;
  }
  if (specific) {
    return specific;
  }
  if (city && region) {
    return `${city}, ${region}`;
  }
  return city ?? region ?? address.country ?? 'Unknown area';
}

export async function getLocationLabel(latitude: number, longitude: number): Promise<string> {
  const cache = await loadCache();
  const key = cacheKeyFor(latitude, longitude);

  if (cache[key]) {
    return cache[key];
  }

  // A cache hit resolves near-instantly (no native call at all), but a miss
  // means an actual native reverseGeocodeAsync round-trip — worth knowing
  // which one is happening here, since jittering duplicate coordinates
  // means sightings that used to always hit the cache (identical
  // coordinate to every other test from the same spot) can now miss.
  const result = geocodeQueue.then(async () => {
    recordBreadcrumb(`getLocationLabel:cache-miss:start key=${key}`);
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      recordBreadcrumb(`getLocationLabel:cache-miss:success key=${key}`);
      const label = address ? formatAddress(address) : 'Unknown area';
      cache[key] = label;
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return label;
    } catch (error) {
      recordBreadcrumb(`getLocationLabel:cache-miss:error key=${key} error=${error}`);
      return 'Unknown area';
    }
  });
  geocodeQueue = result.catch(() => {});
  return result;
}
