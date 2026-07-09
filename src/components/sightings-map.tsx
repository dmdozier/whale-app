import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';

import { useLocationLabel } from '@/hooks/use-location-label';
import { recordBreadcrumb } from '@/lib/breadcrumbs';
import { jitterDuplicateCoordinates } from '@/lib/dedupe-coordinates';
import { formatSightingExtras } from '@/lib/sighting-options';
import { formatRelativeTime, isRecentSighting } from '@/lib/sighting-time';
import type { Sighting } from '@/types/sighting';

const DEFAULT_REGION: Region = {
  latitude: 47.6062,
  longitude: -122.3321,
  latitudeDelta: 4,
  longitudeDelta: 4,
};

export function SightingsMap({
  sightings,
  onPhotoPress,
}: {
  sightings: Sighting[];
  onPhotoPress: (photoUrl: string) => void;
}) {
  // react-native-map-clustering only computes clusters on mount (from
  // whatever region it starts at) and when the map reports a region change.
  // Rendering it at DEFAULT_REGION and then imperatively animating to the
  // user's location doesn't reliably fire that region-change callback, so
  // clusters were stuck reflecting the wrong (far more zoomed-out) region
  // until the user manually panned or pinched. Resolving the real starting
  // region before the map ever mounts avoids that entirely.
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  // Bumped on every successful location fetch so the key below changes,
  // forcing a fresh mount of the map. That's what actually makes it
  // re-center — react-native-maps only reads `initialRegion` once per
  // mount, and updating the prop on an already-mounted map does nothing.
  const [mapKey, setMapKey] = useState(0);

  // Expo Router keeps tab screens mounted when you switch away from them,
  // so a plain mount-only effect here only ever ran once for the lifetime
  // of the app. Use useFocusEffect so the location is re-fetched and the
  // map re-centered every time the Map tab is opened or regains focus, not
  // just the very first time.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setInitialRegion((current) => current ?? DEFAULT_REGION);
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        setInitialRegion({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
        setMapKey((key) => key + 1);
      })().catch(() => setInitialRegion((current) => current ?? DEFAULT_REGION));
    }, []),
  );

  // Fires after every render commits (no dependency array) — narrows down
  // whether a crash happens before React finishes reconciling this
  // component's JS-side tree, or later, when the native side actually
  // creates/lays out the corresponding map/marker views (a separate,
  // asynchronously-batched step that this breadcrumb can't see into).
  useEffect(() => {
    recordBreadcrumb(`SightingsMap:render:committed count=${sightings.length} mapKey=${mapKey}`);
  });

  if (!initialRegion) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  // See dedupe-coordinates.ts: sightings logged from the same spot (the
  // norm when testing repeatedly, or at a popular viewing location) share
  // an exact coordinate, which is suspected to be what crashes this
  // library's native rendering when a new one is added to that cluster.
  // Spreading duplicates apart by a few meters means it never sees an exact
  // match in the first place.
  const jitteredCoordinates = jitterDuplicateCoordinates(
    sightings.map((sighting) => ({
      id: sighting.id,
      latitude: sighting.latitude,
      longitude: sighting.longitude,
    })),
  );

  // TEMPORARY DIAGNOSTIC: react-native-map-clustering swapped out for a
  // plain MapView, with no clustering at all. Every "markers/Callouts
  // updating" theory we could instrument from JS has been tried and ruled
  // out by breadcrumb evidence, but the clustering library's own
  // cluster-bubble rendering is entirely opaque to those breadcrumbs —
  // it's third-party native code with no hook point for us to log
  // anything from, and it already has a crash history in this exact app
  // (this file used to disable its spiralEnabled/animationEnabled props
  // for exactly that reason). If the crash stops with this in place, that
  // conclusively points at the clustering library; if it doesn't, we can
  // rule clustering out entirely with much more confidence than more
  // guessing would give us. Revert to ClusteredMapView (git history has
  // the exact prior version, including those props) once this test tells
  // us which way to go.
  return (
    <MapView key={mapKey} style={styles.map} initialRegion={initialRegion} showsUserLocation>
      {sightings.map((sighting, index) => (
        <SightingMarker
          key={sighting.id}
          sighting={sighting}
          onPhotoPress={onPhotoPress}
          coordinate={jitteredCoordinates[index]}
        />
      ))}
    </MapView>
  );
}

function SightingMarker({
  sighting,
  coordinate,
  onPhotoPress,
}: {
  sighting: Sighting;
  coordinate: { latitude: number; longitude: number };
  onPhotoPress: (photoUrl: string) => void;
}) {
  const recent = isRecentSighting(sighting.sighted_at);
  const locationLabel = useLocationLabel(coordinate);
  const extras = formatSightingExtras(sighting);

  // Fires once this marker has mounted. Sightings are ordered newest-first,
  // so a just-saved sighting is always the first child rendered — if the
  // trail is missing this marker's id specifically (while older markers'
  // ids are present), that points at something particular to this sighting
  // rather than a generic issue with marker count.
  useEffect(() => {
    recordBreadcrumb(
      `SightingMarker:mounted id=${sighting.id} location_type=${sighting.location_type} distance_estimate=${sighting.distance_estimate}`,
    );
  }, [sighting.id, sighting.location_type, sighting.distance_estimate]);

  // useLocationLabel resolves asynchronously after mount and updates this
  // Callout's content from a "Locating…" placeholder to the real address —
  // a second render/commit for this exact marker that nothing was tracking
  // before this. Its absence would mean the crash happens somewhere in
  // that update, not the initial mount.
  useEffect(() => {
    if (locationLabel !== null) {
      recordBreadcrumb(`SightingMarker:locationLabel:committed id=${sighting.id}`);
    }
  }, [sighting.id, locationLabel]);

  return (
    <Marker
      coordinate={coordinate}
      pinColor={recent ? '#208AEF' : '#9AA0A6'}
      opacity={recent ? 1 : 0.55}>
      <Callout onPress={() => sighting.photo_url && onPhotoPress(sighting.photo_url)}>
        <View style={styles.callout}>
          {sighting.photo_url ? (
            <Image source={{ uri: sighting.photo_url }} style={styles.calloutPhoto} />
          ) : null}
          <Text style={styles.calloutTitle}>
            {sighting.species?.common_name ?? 'Species not noted'}
          </Text>
          <Text style={styles.calloutSubtitle}>
            {formatRelativeTime(sighting.sighted_at)} · {locationLabel ?? 'Locating…'}
          </Text>
          {extras ? <Text style={styles.calloutSubtitle}>{extras}</Text> : null}
          {sighting.notes ? <Text style={styles.calloutNotes}>{sighting.notes}</Text> : null}
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callout: {
    minWidth: 160,
    maxWidth: 240,
    gap: 2,
  },
  calloutPhoto: {
    width: '100%',
    height: 90,
    borderRadius: 6,
    marginBottom: 4,
  },
  calloutTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: '#1A1A1A',
  },
  calloutSubtitle: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  calloutNotes: {
    fontSize: 12,
    color: '#1A1A1A',
    marginTop: 4,
  },
});
