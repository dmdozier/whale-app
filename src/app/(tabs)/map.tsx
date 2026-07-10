import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateFilterButton } from '@/components/date-filter-button';
import { LogoutButton } from '@/components/logout-button';
import { SightingsMap } from '@/components/sightings-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePendingSightingsCount } from '@/hooks/use-pending-count';
import { recordBreadcrumb } from '@/lib/breadcrumbs';
import { matchesDateFilter, type DateFilter } from '@/lib/date-filter';
import { supabase } from '@/lib/supabase';
import type { Sighting } from '@/types/sighting';

// Clears the height of the top filter bar so the logout button doesn't
// overlap it.
const LOGOUT_BUTTON_OFFSET = 40;

export default function MapScreen() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  // Defaults to the last hour rather than all time -- reduces visual
  // clutter and rendering/clustering cost, especially during repeated
  // same-spot test saves that otherwise stack up indefinitely on the map.
  const [dateFilter, setDateFilter] = useState<DateFilter>('hour');
  const pendingCount = usePendingSightingsCount();

  // Refetch whenever the Map tab gains focus, so a sighting just logged
  // (or logged by someone else) shows up without needing to restart the app.
  //
  // Deliberately delayed: focus fires the instant expo-router's navigation
  // state updates, which per breadcrumb timing is only ~20ms after
  // router.back() is called from the Log Sighting modal — almost certainly
  // before iOS's own modal-dismiss transition animation has actually
  // finished playing. That means the refetch, the resulting re-render, and
  // react-native-map-clustering remounting/updating markers (all
  // comparatively heavy native work) were racing that transition
  // animation. A crash reproducing consistently right after this exact
  // sequence, regardless of what was actually saved, points at that race
  // rather than anything about the saved data itself. Neither
  // react-navigation nor react-native-screens register their transition
  // animations with InteractionManager, so runAfterInteractions wouldn't
  // actually wait for it — a fixed delay past a typical iOS modal-dismiss
  // duration is the more reliable way to test this.
  useFocusEffect(
    useCallback(() => {
      recordBreadcrumb('map:focus:fetch:scheduled');
      const timeout = setTimeout(() => {
        recordBreadcrumb('map:focus:fetch:start');
        supabase
          .from('sightings')
          .select(
            'id, latitude, longitude, sighted_at, notes, photo_url, location_type, distance_estimate, species(id, common_name)',
          )
          .order('sighted_at', { ascending: false })
          // Defensive cap: rendering/clustering an unbounded number of pins
          // gets expensive (and, per known react-native-map-clustering issues,
          // crash-prone) as the table grows. The most recent 500 sightings is
          // already far more than useful to look at on a map at once.
          .limit(500)
          .then(({ data }) => {
            setSightings((data ?? []) as unknown as Sighting[]);
            recordBreadcrumb(`map:focus:fetch:success count=${data?.length ?? 0}`);
          });
      }, 500);
      return () => clearTimeout(timeout);
    }, []),
  );

  const filteredSightings = sightings.filter((sighting) =>
    matchesDateFilter(sighting.sighted_at, dateFilter),
  );

  return (
    <ThemedView style={styles.container}>
      <SightingsMap sightings={filteredSightings} />

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
