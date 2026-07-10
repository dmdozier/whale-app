import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterMenuButton } from '@/components/filter-menu-button';
import { LogoutButton } from '@/components/logout-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLocationLabel } from '@/hooks/use-location-label';
import { usePendingSightingsCount } from '@/hooks/use-pending-count';
import { usePhotoViewer } from '@/hooks/use-photo-viewer';
import { recordBreadcrumb } from '@/lib/breadcrumbs';
import { DATE_FILTER_OPTIONS, matchesDateFilter, type DateFilter } from '@/lib/date-filter';
import { distanceInMiles, formatDistanceMiles } from '@/lib/distance';
import { DISTANCE_FILTER_OPTIONS, matchesDistanceFilter, type DistanceFilter } from '@/lib/distance-filter';
import { formatSightingExtras } from '@/lib/sighting-options';
import { formatRelativeTime } from '@/lib/sighting-time';
import { SORT_OPTIONS, type SortOption } from '@/lib/sort-option';
import { getCachedSpecies, setCachedSpecies } from '@/lib/species-cache';
import { supabase } from '@/lib/supabase';
import type { Sighting } from '@/types/sighting';
import type { Species } from '@/types/species';

// Clears the height of the top filter bar so the logout button doesn't
// overlap it. Taller than before (was 40) since the filter bar can now wrap
// to two rows (Sort, Distance/Date, and Species buttons together).
const LOGOUT_BUTTON_OFFSET = 76;

export default function ListScreen() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null);
  // Nearest-first by default with a 25mi radius, so a new user sees
  // relevant nearby recent activity rather than every sighting ever logged
  // (this table can grow to many users' worth of history). Most Recent
  // falls back to the previous default (date range, "All Time").
  const [sortOption, setSortOption] = useState<SortOption>('nearest');
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>('25');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [speciesId, setSpeciesId] = useState<number | null>(null);
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const pendingCount = usePendingSightingsCount();
  const { openPhoto } = usePhotoViewer();

  // Refetch whenever the List tab gains focus, so a sighting just logged
  // (or logged by someone else) shows up without needing to restart the app.
  useFocusEffect(
    useCallback(() => {
      recordBreadcrumb('list:focus:fetch:start');
      supabase
        .from('sightings')
        .select(
          'id, latitude, longitude, sighted_at, notes, photo_url, location_type, distance_estimate, species(id, common_name)',
        )
        .order('sighted_at', { ascending: false })
        // Defensive cap, matching the Map screen's fetch -- rendering an
        // unbounded number of rows gets expensive as the table grows across
        // many users. Sort/distance/date/species filters do the real work
        // of narrowing this down to what's relevant; this just bounds the
        // worst case.
        .limit(500)
        .then(({ data }) => {
          setSightings((data ?? []) as unknown as Sighting[]);
          recordBreadcrumb(`list:focus:fetch:success count=${data?.length ?? 0}`);
        });
    }, []),
  );

  // Show whatever species list is cached from the last successful fetch
  // right away, then refresh it from Supabase -- same pattern as the
  // species picker on the Log Sighting screen.
  useEffect(() => {
    getCachedSpecies().then(setSpeciesList);

    supabase
      .from('species')
      .select('id, common_name')
      .order('sort_order')
      .then(
        ({ data }) => {
          if (data) {
            setSpeciesList(data as Species[]);
            setCachedSpecies(data as Species[]);
          }
        },
        () => {},
      );
  }, []);

  // Used for both the "rough distance away" hint on each row and Nearest
  // sorting/the distance filter — if permission is denied or location can't
  // be resolved, rows just omit the distance and Nearest sort falls back to
  // the fetch's existing most-recent-first order until it resolves.
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

  const visibleSightings = useMemo(() => {
    const speciesMatched =
      speciesId === null ? sightings : sightings.filter((s) => s.species?.id === speciesId);

    if (sortOption === 'recent') {
      // Already ordered most-recent-first by the query; filtering preserves
      // that order.
      return speciesMatched.filter((s) => matchesDateFilter(s.sighted_at, dateFilter));
    }

    // Nearest: without a resolved location there's nothing to sort or
    // filter by distance yet, so just show the (recency-ordered) matches
    // rather than an empty list.
    if (!userLocation) {
      return speciesMatched;
    }
    return speciesMatched
      .map((sighting) => ({ sighting, distanceMiles: distanceInMiles(userLocation, sighting) }))
      .filter(({ distanceMiles }) => matchesDistanceFilter(distanceMiles, distanceFilter))
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .map(({ sighting }) => sighting);
  }, [sightings, sortOption, dateFilter, distanceFilter, speciesId, userLocation]);

  const speciesOptions = useMemo(
    () => [
      { value: null as number | null, label: 'All Species' },
      ...speciesList.map((species) => ({ value: species.id as number | null, label: species.common_name })),
    ],
    [speciesList],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.filterBarContainer}>
          <FilterMenuButton label="Sort" options={SORT_OPTIONS} value={sortOption} onChange={setSortOption} />
          {sortOption === 'nearest' ? (
            <FilterMenuButton
              label="Distance"
              options={DISTANCE_FILTER_OPTIONS}
              value={distanceFilter}
              onChange={setDistanceFilter}
            />
          ) : (
            <FilterMenuButton
              label="Filter"
              options={DATE_FILTER_OPTIONS}
              value={dateFilter}
              onChange={setDateFilter}
            />
          )}
          <FilterMenuButton
            label="Species"
            options={speciesOptions}
            value={speciesId}
            onChange={setSpeciesId}
          />
        </ThemedView>
        {pendingCount > 0 ? (
          <ThemedView type="backgroundElement" style={styles.pendingBanner}>
            <ThemedText type="small">
              📤 {pendingCount} sighting{pendingCount === 1 ? '' : 's'} saved offline, pending sync
            </ThemedText>
          </ThemedView>
        ) : null}
        <FlatList
          data={visibleSightings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedView style={styles.emptyState}>
              <ThemedText type="title" style={styles.emptyEmoji}>
                📋
              </ThemedText>
              <ThemedText type="subtitle">Recent Sightings</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                {sortOption === 'recent' && dateFilter === 'all' && speciesId === null
                  ? 'No sightings yet.'
                  : 'No sightings match your filters.'}
              </ThemedText>
            </ThemedView>
          }
          renderItem={({ item }) => (
            <SightingRow
              sighting={item}
              userLocation={userLocation}
              onPress={() => setSelectedSighting(item)}
              onPhotoPress={openPhoto}
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
          {selectedSighting ? (
            <SightingDetail
              sighting={selectedSighting}
              // Closes this local Modal before opening the shared photo
              // viewer, rather than leaving it open underneath. Two RN
              // Modals presented at once on iOS (one native view controller
              // stacked on another) is what caused the reported bug where
              // the photo viewer's close button became unreliable and the
              // List screen went completely unresponsive afterward -- see
              // use-photo-viewer.tsx for the other half of this (Map and
              // List used to each mount their own separate photo viewer).
              onPhotoPress={(photoUrl) => {
                setSelectedSighting(null);
                openPhoto(photoUrl);
              }}
            />
          ) : null}
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

function PhotoThumbnail({
  photoUrl,
  onPress,
}: {
  photoUrl: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!photoUrl}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.thumbnail} />
      ) : (
        <ThemedView type="backgroundSelected" style={styles.thumbnail}>
          <ThemedText style={styles.thumbnailPlaceholderIcon}>📷</ThemedText>
        </ThemedView>
      )}
    </Pressable>
  );
}

function SightingRow({
  sighting,
  userLocation,
  onPress,
  onPhotoPress,
}: {
  sighting: Sighting;
  userLocation: { latitude: number; longitude: number } | null;
  onPress: () => void;
  onPhotoPress: (photoUrl: string) => void;
}) {
  const locationLabel = useLocationLabel({
    latitude: sighting.latitude,
    longitude: sighting.longitude,
  });
  const distanceLabel = userLocation
    ? formatDistanceMiles(distanceInMiles(userLocation, sighting))
    : null;
  const extras = formatSightingExtras(sighting);

  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <PhotoThumbnail
        photoUrl={sighting.photo_url}
        onPress={() => sighting.photo_url && onPhotoPress(sighting.photo_url)}
      />
      <Pressable style={styles.rowText} onPress={onPress}>
        <ThemedText type="smallBold">{sighting.species?.common_name ?? 'Species not noted'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatRelativeTime(sighting.sighted_at)} · {locationLabel ?? 'Locating…'}
          {distanceLabel ? ` · ${distanceLabel}` : ''}
        </ThemedText>
        {extras ? (
          <ThemedText type="small" themeColor="textSecondary">
            {extras}
          </ThemedText>
        ) : null}
      </Pressable>
    </ThemedView>
  );
}

function SightingDetail({
  sighting,
  onPhotoPress,
}: {
  sighting: Sighting;
  onPhotoPress: (photoUrl: string) => void;
}) {
  const locationLabel = useLocationLabel({
    latitude: sighting.latitude,
    longitude: sighting.longitude,
  });

  const extras = formatSightingExtras(sighting);

  return (
    <ThemedView type="backgroundElement" style={styles.modalCard}>
      <ThemedText type="smallBold">{sighting.species?.common_name ?? 'Species not noted'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatRelativeTime(sighting.sighted_at)} · {locationLabel ?? 'Locating…'}
      </ThemedText>
      {extras ? (
        <ThemedText type="small" themeColor="textSecondary">
          {extras}
        </ThemedText>
      ) : null}
      {sighting.notes ? <ThemedText type="small" style={styles.modalNotes}>{sighting.notes}</ThemedText> : null}
      {sighting.photo_url ? (
        <Pressable onPress={() => onPhotoPress(sighting.photo_url!)} style={styles.modalPhotoButton}>
          <Image source={{ uri: sighting.photo_url }} style={styles.modalPhoto} />
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBarContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderIcon: {
    fontSize: 20,
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
  modalPhotoButton: {
    marginTop: Spacing.two,
  },
  modalPhoto: {
    width: '100%',
    height: 160,
    borderRadius: Spacing.two,
  },
});
