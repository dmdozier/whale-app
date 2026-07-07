import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Species } from '@/types/species';

const SPECIES_CACHE_KEY = 'whale-app/species-cache';

export async function getCachedSpecies(): Promise<Species[]> {
  const raw = await AsyncStorage.getItem(SPECIES_CACHE_KEY);
  return raw ? (JSON.parse(raw) as Species[]) : [];
}

export async function setCachedSpecies(species: Species[]) {
  await AsyncStorage.setItem(SPECIES_CACHE_KEY, JSON.stringify(species));
}
