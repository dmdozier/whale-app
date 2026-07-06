import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { LogoutButton } from '@/components/logout-button';
import { SightingsMap } from '@/components/sightings-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Sighting } from '@/types/sighting';

export default function MapScreen() {
  const [sightings, setSightings] = useState<Sighting[]>([]);

  // Refetch whenever the Map tab gains focus, so a sighting just logged
  // (or logged by someone else) shows up without needing to restart the app.
  useFocusEffect(
    useCallback(() => {
      supabase
        .from('sightings')
        .select('id, latitude, longitude, sighted_at, notes, species(common_name)')
        .order('sighted_at', { ascending: false })
        .then(({ data }) => setSightings((data ?? []) as unknown as Sighting[]));
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SightingsMap sightings={sightings} />

      <LogoutButton />

      <Pressable style={styles.fab} onPress={() => router.push('/log-sighting')}>
        <ThemedText style={styles.fabText}>I saw one 🐋</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.five,
    alignSelf: 'center',
    backgroundColor: '#208AEF',
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  fabText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
