import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateFilterButton } from '@/components/date-filter-button';
import { LogoutButton } from '@/components/logout-button';
import { PhotoViewerModal } from '@/components/photo-viewer-modal';
import { SightingsMap } from '@/components/sightings-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePendingSightingsCount } from '@/hooks/use-pending-count';
import { matchesDateFilter, type DateFilter } from '@/lib/date-filter';
import { supabase } from '@/lib/supabase';
import type { Sighting } from '@/types/sighting';

// Clears the height of the top filter bar so the logout button doesn't
// overlap it.
const LOGOUT_BUTTON_OFFSET = 40;

export default function MapScreen() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const pendingCount = usePendingSightingsCount();

  // Refetch whenever the Map tab gains focus, so a sighting just logged
  // (or logged by someone else) shows up without needing to restart the app.
  useFocusEffect(
    useCallback(() => {
      supabase
        .from('sightings')
        .select('id, latitude, longitude, sighted_at, notes, photo_url, species(common_name)')
        .order('sighted_at', { ascending: false })
        .then(({ data }) => setSightings((data ?? []) as unknown as Sighting[]));
    }, []),
  );

  const filteredSightings = sightings.filter((sighting) =>
    matchesDateFilter(sighting.sighted_at, dateFilter),
  );

  return (
    <ThemedView style={styles.container}>
      <SightingsMap sightings={filteredSightings} onPhotoPress={setViewingPhotoUrl} />

      <SafeAreaView edges={['top']} style={styles.filterBarSafeArea}>
        <DateFilterButton value={dateFilter} onChange={setDateFilter} />
      </SafeAreaView>

      <LogoutButton topOffset={LOGOUT_BUTTON_OFFSET} />

      {pendingCount > 0 ? (
        <ThemedView type="backgroundElement" style={styles.pendingBanner}>
          <ThemedText type="small">
            📤 {pendingCount} sighting{pendingCount === 1 ? '' : 's'} pending sync
          </ThemedText>
        </ThemedView>
      ) : null}

      <Pressable style={styles.fab} onPress={() => router.push('/log-sighting')}>
        <ThemedText style={styles.fabText}>I saw one 🐋</ThemedText>
      </Pressable>

      <PhotoViewerModal photoUrl={viewingPhotoUrl} onClose={() => setViewingPhotoUrl(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBarSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: Spacing.three,
  },
  pendingBanner: {
    position: 'absolute',
    bottom: Spacing.five + 64,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
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
