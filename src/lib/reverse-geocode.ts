import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const CACHE_KEY = 'whale-app/geocode-cache';
// ~0.001 degrees is roughly 100m — plenty of precision for a "nearby
// city/area" label, and it lets sightings near each other share a cache hit.
const PRECISION = 3;

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

function formatAddress(address: Location.LocationGeocodedAddress): string {
  const city = address.city ?? address.subregion ?? address.district ?? undefined;
  const region = address.region ?? undefined;

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

  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const label = address ? formatAddress(address) : 'Unknown area';
    cache[key] = label;
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return label;
  } catch {
    return 'Unknown area';
  }
}
