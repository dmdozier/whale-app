import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateFilterButton } from '@/components/date-filter-button';
import { LogoutButton } from '@/components/logout-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLocationLabel } from '@/hooks/use-location-label';
import { usePendingSightingsCount } from '@/hooks/use-pending-count';
import { matchesDateFilter, type DateFilter } from '@/lib/date-filter';
import { distanceInMiles, formatDistanceMiles } from '@/lib/distance';
import { formatRelativeTime } from '@/lib/sighting-time';
import { supabase } from '@/lib/supabase';
import type { Sighting } from '@/types/sighting';

// Clears the height of the top filter bar so the logout button doesn't
// overlap it.
const LOGOUT_BUTTON_OFFSET = 40;

export default function ListScreen() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const pendingCount = usePendingSightingsCount();

  // Refetch whenever the List tab gains focus, so a sighting just logged
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

  // Used only for the "rough distance away" hint on each row — if permission
  // is denied or location can't be resolved, rows just omit the distance.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    })().catch(() => {});
  }, []);

  const filteredSightings = sightings.filter((sighting) =>
    matchesDateFilter(sighting.sighted_at, dateFilter),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.filterBarContainer}>
          <DateFilterButton value={dateFilter} onChange={setDateFilter} />
        </ThemedView>
        {pendingCount > 0 ? (
          <ThemedView type="backgroundElement" style={styles.pendingBanner}>
            <ThemedText type="small">
              📤 {pendingCount} sighting{pendingCount === 1 ? '' : 's'} saved offline, pending sync
            </ThemedText>
          </ThemedView>
        ) : null}
        <FlatList
          data={filteredSightings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedView style={styles.emptyState}>
              <ThemedText type="title" style={styles.emptyEmoji}>
                📋
              </ThemedText>
              <ThemedText type="subtitle">Recent Sightings</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                {dateFilter === 'all' ? 'No sightings yet.' : 'No sightings in this time range.'}
              </ThemedText>
            </ThemedView>
          }
          renderItem={({ item }) => (
            <SightingRow
              sighting={item}
              userLocation={userLocation}
              onPress={() => setSelectedSighting(item)}
            />
          )}
        />
      </SafeAreaView>

      <LogoutButton topOffset={LOGOUT_BUTTON_OFFSET} />

      <Pressable style={styles.fab} onPress={() => router.push('/log-sighting')}>
        <ThemedText style={styles.fabText}>I saw one 🐋</ThemedText>
      </Pressable>

      <Modal
        visible={selectedSighting !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSighting(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedSighting(null)}>
          {selectedSighting ? <SightingDetail sighting={selectedSighting} /> : null}
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

function SightingRow({
  sighting,
  userLocation,
  onPress,
}: {
  sighting: Sighting;
  userLocation: { latitude: number; longitude: number } | null;
  onPress: () => void;
}) {
  const locationLabel = useLocationLabel({
    latitude: sighting.latitude,
    longitude: sighting.longitude,
  });
  const distanceLabel = userLocation
    ? formatDistanceMiles(distanceInMiles(userLocation, sighting))
    : null;

  return (
    <Pressable onPress={onPress}>
      <ThemedView type="backgroundElement" style={styles.row}>
        <ThemedText type="smallBold">{sighting.species?.common_name ?? 'Species not noted'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatRelativeTime(sighting.sighted_at)} · {locationLabel ?? 'Locating…'}
          {distanceLabel ? ` · ${distanceLabel}` : ''}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function SightingDetail({ sighting }: { sighting: Sighting }) {
  const locationLabel = useLocationLabel({
    latitude: sighting.latitude,
    longitude: sighting.longitude,
  });

  return (
    <ThemedView type="backgroundElement" style={styles.modalCard}>
      <ThemedText type="smallBold">{sighting.species?.common_name ?? 'Species not noted'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatRelativeTime(sighting.sighted_at)} · {locationLabel ?? 'Locating…'}
      </ThemedText>
      {sighting.notes ? <ThemedText type="small" style={styles.modalNotes}>{sighting.notes}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBarContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  pendingBanner: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  safeArea: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    padding: Spacing.four,
    paddingBottom: Spacing.six + Spacing.four,
    gap: Spacing.two,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  emptyEmoji: {
    fontSize: 56,
    lineHeight: 64,
  },
  centerText: {
    textAlign: 'center',
  },
  row: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: 2,
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
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  modalNotes: {
    marginTop: Spacing.two,
  },
});
