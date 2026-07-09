import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';
import Supercluster from 'supercluster';

import { useLocationLabel } from '@/hooks/use-location-label';
import { recordBreadcrumb } from '@/lib/breadcrumbs';
import { jitterDuplicateCoordinates } from '@/lib/dedupe-coordinates';
import { regionDeltaForZoomLevel, zoomLevelForRegion } from '@/lib/map-zoom';
import { formatSightingExtras } from '@/lib/sighting-options';
import { formatRelativeTime, isRecentSighting } from '@/lib/sighting-time';
import type { Sighting } from '@/types/sighting';

const DEFAULT_REGION: Region = {
  latitude: 47.6062,
  longitude: -122.3321,
  latitudeDelta: 4,
  longitudeDelta: 4,
};

// react-native-map-clustering's own native rendering was confirmed (by
// direct on-device testing) to be the cause of a crash that took a long
// investigation to isolate — it reliably reproduced right as new marker
// data landed, and stopped entirely once that library was swapped out for
// a plain MapView. Its underlying clustering math (supercluster, a pure-JS
// library with no native/rendering code of its own) was never implicated,
// so clustering is reimplemented here directly on top of supercluster,
// with our own plain Marker/Callout rendering — the same clustering
// behavior, with no third-party native rendering layer in the way.
type SightingPointProperties = { sightingId: string };

export function SightingsMap({
  sightings,
  onPhotoPress,
}: {
  sightings: Sighting[];
  onPhotoPress: (photoUrl: string) => void;
}) {
  const mapRef = useRef<MapView>(null);

  // Clusters need to be computed for whatever region the map is actually
  // showing (initialRegion is only read once, at mount, by react-native-maps
  // itself — it doesn't reflect panning/zooming). Kept as separate state
  // from initialRegion, and updated in three places: alongside
  // initialRegion below, from onRegionChangeComplete as the user
  // interacts with the map, and directly when animating to a tapped
  // cluster (see handleClusterPress) rather than relying solely on
  // onRegionChangeComplete, which doesn't reliably fire after
  // animateToRegion.
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
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
          setVisibleRegion((current) => current ?? DEFAULT_REGION);
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        const region: Region = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };
        setInitialRegion(region);
        setVisibleRegion(region);
        setMapKey((key) => key + 1);
      })().catch(() => {
        setInitialRegion((current) => current ?? DEFAULT_REGION);
        setVisibleRegion((current) => current ?? DEFAULT_REGION);
      });
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

  const clusterIndex = useMemo(() => {
    // The old crash was in react-native-map-clustering's own native
    // rendering at high zoom, not in supercluster's clustering math (its
    // own dedicated crash mitigation, capping maxZoom at 17, doesn't apply
    // to our own plain Marker/Callout rendering) — confirmed via a
    // standalone test that supercluster itself handles many same-spot
    // points without issue well past that. maxZoom just bounds how deep
    // the cluster hierarchy is precomputed, so 20 (the max real-world
    // useful zoom) lets tightly-packed clusters fully expand when zoomed
    // all the way in, rather than getting stuck a level or two up.
    const index = new Supercluster<SightingPointProperties>({ maxZoom: 20 });
    // Sightings sharing the exact same coordinate (repeated test saves, or
    // a phone returning a cached GPS reading) can never be spatially
    // separated by clustering alone — see dedupe-coordinates.ts. Without
    // this, a cluster made entirely of duplicates gets stuck permanently:
    // tapping it to zoom in just re-clusters the same points at every
    // zoom level, with no way to ever reach the pins underneath.
    const jitteredCoordinates = jitterDuplicateCoordinates(
      sightings.map((sighting) => ({
        id: sighting.id,
        latitude: sighting.latitude,
        longitude: sighting.longitude,
      })),
    );
    index.load(
      sightings.map((sighting, i) => ({
        type: 'Feature',
        properties: { sightingId: sighting.id },
        geometry: {
          type: 'Point',
          coordinates: [jitteredCoordinates[i].longitude, jitteredCoordinates[i].latitude],
        },
      })),
    );
    return index;
  }, [sightings]);

  const sightingsById = useMemo(() => new Map(sightings.map((s) => [s.id, s])), [sightings]);

  const clusters = useMemo(() => {
    if (!visibleRegion) {
      return [];
    }
    const bbox: [number, number, number, number] = [
      visibleRegion.longitude - visibleRegion.longitudeDelta / 2,
      visibleRegion.latitude - visibleRegion.latitudeDelta / 2,
      visibleRegion.longitude + visibleRegion.longitudeDelta / 2,
      visibleRegion.latitude + visibleRegion.latitudeDelta / 2,
    ];
    const zoom = zoomLevelForRegion(visibleRegion.longitudeDelta);
    return clusterIndex.getClusters(bbox, zoom);
  }, [clusterIndex, visibleRegion]);

  useEffect(() => {
    const clusterCount = clusters.filter((f) => 'cluster' in f.properties).length;
    recordBreadcrumb(
      `clusters:recomputed total=${clusters.length} clusters=${clusterCount} points=${clusters.length - clusterCount} visibleRegionDelta=${visibleRegion?.longitudeDelta}`,
    );
  }, [clusters, visibleRegion]);

  const handleClusterPress = useCallback(
    (clusterId: number, coordinate: { latitude: number; longitude: number }) => {
      recordBreadcrumb(`cluster:press id=${clusterId} hasMapRef=${!!mapRef.current}`);
      try {
        const rawExpansionZoom = clusterIndex.getClusterExpansionZoom(clusterId);
        const expansionZoom = Math.min(rawExpansionZoom, 20);
        const delta = regionDeltaForZoomLevel(expansionZoom);
        const region: Region = {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        };
        recordBreadcrumb(
          `cluster:press:region rawExpansionZoom=${rawExpansionZoom} delta=${delta} region=${JSON.stringify(region)}`,
        );
        mapRef.current?.animateToRegion(region, 300);
        setVisibleRegion(region);
      } catch (error) {
        recordBreadcrumb(`cluster:press:error id=${clusterId} error=${error}`);
      }
    },
    [clusterIndex],
  );

  if (!initialRegion) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      key={mapKey}
      style={styles.map}
      initialRegion={initialRegion}
      showsUserLocation
      onRegionChangeComplete={setVisibleRegion}>
      {clusters.map((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;

        if ('cluster' in feature.properties) {
          const { cluster_id: clusterId, point_count: pointCount } = feature.properties;
          return (
            <Marker
              key={`cluster-${clusterId}`}
              coordinate={{ latitude, longitude }}
              onPress={() => handleClusterPress(clusterId, { latitude, longitude })}>
              <View style={styles.clusterBadge}>
                <Text style={styles.clusterBadgeText}>{pointCount}</Text>
              </View>
            </Marker>
          );
        }

        const sighting = sightingsById.get(feature.properties.sightingId);
        if (!sighting) {
          return null;
        }
        return (
          <SightingMarker
            key={sighting.id}
            sighting={sighting}
            onPhotoPress={onPhotoPress}
            coordinate={{ latitude, longitude }}
          />
        );
      })}
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
  clusterBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  clusterBadgeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
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
