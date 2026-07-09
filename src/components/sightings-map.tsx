import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
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

// See handleRegionChangeComplete: an absolute-degrees floor (~50-65m) for
// what counts as a "meaningful" region change, on top of the existing
// relative (10% of current delta) check.
const MIN_MEANINGFUL_MOVE_DEGREES = 0.0006;

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

export function SightingsMap({ sightings }: { sightings: Sighting[] }) {
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

  // Only updates visibleRegion (and therefore triggers a re-cluster and a
  // re-render of every marker) when the region actually changed by a
  // meaningful amount. onRegionChangeComplete fires far more often than
  // "the user panned or zoomed" — e.g. iOS auto-nudges the map to keep a
  // just-tapped Callout fully on-screen, reported a region differing from
  // the current one only in the 13th decimal place (confirmed via
  // breadcrumb evidence: visibleRegionDelta 0.00034332275390625 vs.
  // 0.00034332275389203915 between consecutive events). Recomputing
  // clusters for that unmounts/remounts markers for no reason — including,
  // apparently, the one whose Callout just opened, closing it again
  // immediately.
  //
  // The move threshold used to be purely relative (10% of the current
  // delta). That works at ordinary zoom levels, but breaks down at the
  // very tight zoom cluster taps can reach (delta ~0.0003, ~35m across):
  // iOS's real, physical callout-visibility auto-pan is roughly a fixed
  // number of meters regardless of zoom, so at this scale it can easily
  // exceed 10% of the (tiny) visible span even though it's the same kind
  // of trivial adjustment the guard was built to filter out. Confirmed via
  // breadcrumb evidence: after settling on the same tightly-packed cluster
  // (delta ~0.00034) with no further cluster taps, clusters:recomputed
  // kept firing intermittently for nearly 90 seconds — consistent with the
  // user tapping individual pins to test their Callouts, each one
  // triggering a "meaningful" region change and a disruptive re-cluster.
  // MIN_MEANINGFUL_MOVE_DEGREES (module scope, above) is an absolute floor
  // added on top of the relative check so a real auto-pan doesn't clear
  // the bar just because the current view happens to be extremely small.
  //
  // Debounced on top of that: a single continuous gesture (e.g. a fast
  // pinch-to-zoom-out) fires onRegionChangeComplete multiple times, not
  // once at the end — confirmed via breadcrumb evidence showing
  // visibleRegionDelta jumping through several genuinely different values
  // within about a second, each one a full re-cluster with a dramatically
  // different marker set (mounting/unmounting dozens of markers as
  // clusters collapsed from several down to one). That's heavy native
  // work repeated several times in a row for what's really one user
  // gesture, and a plausible source of the reported crash. Waiting for
  // the region to stop changing for a brief moment means only the final,
  // settled region actually triggers a re-cluster.
  const regionChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // See handleClusterPress: a fallback for when animateToRegion's real
  // onRegionChangeComplete never shows up at all. Cleared as soon as a real
  // event arrives, so it only ever fires as a last resort.
  const clusterPressFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (regionChangeTimeoutRef.current) {
        clearTimeout(regionChangeTimeoutRef.current);
      }
      if (clusterPressFallbackRef.current) {
        clearTimeout(clusterPressFallbackRef.current);
      }
    };
  }, []);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    // A real event arrived -- no need for the optimistic fallback below.
    if (clusterPressFallbackRef.current) {
      clearTimeout(clusterPressFallbackRef.current);
      clusterPressFallbackRef.current = null;
    }
    if (regionChangeTimeoutRef.current) {
      clearTimeout(regionChangeTimeoutRef.current);
    }
    regionChangeTimeoutRef.current = setTimeout(() => {
      setVisibleRegion((current) => {
        if (!current) {
          return region;
        }
        const zoomChanged =
          zoomLevelForRegion(region.longitudeDelta) !== zoomLevelForRegion(current.longitudeDelta);
        const latThreshold = Math.max(current.latitudeDelta * 0.1, MIN_MEANINGFUL_MOVE_DEGREES);
        const lngThreshold = Math.max(current.longitudeDelta * 0.1, MIN_MEANINGFUL_MOVE_DEGREES);
        const latMoved = Math.abs(region.latitude - current.latitude) > latThreshold;
        const lngMoved = Math.abs(region.longitude - current.longitude) > lngThreshold;
        return zoomChanged || latMoved || lngMoved ? region : current;
      });
      // 350ms rather than 200ms: a reported crash following a fast zoom-in
      // right after a zoom-out still happened with 200ms, even though the
      // debounce was correctly spacing distinct commits about a second
      // apart by that point — so this alone probably isn't the full fix,
      // but a bit more settling time between opposite-direction gesture
      // sequences is cheap or free from a UX standpoint.
    }, 350);
  }, []);

  const clusterIndex = useMemo(() => {
    // maxZoom bounds how deep the cluster hierarchy is precomputed, and
    // therefore the tightest zoom handleClusterPress will ever ask
    // animateToRegion to reach. This used to be 22 (supercluster itself
    // handles that depth fine, and separating same-spot test sightings
    // seemed to need it), but on-device breadcrumb evidence showed
    // animateToRegion reliably reaches zoom 19-20 (matching
    // clusters:recomputed within under a second, every time) and reliably
    // does NOT reach zoom 21-22 — repeated taps requesting those deltas
    // produced no response at all for many seconds, then a long, chaotic
    // tail of unrelated-looking region-change events as the camera
    // eventually caught up, remounting markers (and closing any open
    // Callout) repeatedly along the way. 20 is the real ceiling MapKit
    // will honor here; asking for more doesn't get sightings separated,
    // it just leaves cluster taps looking unresponsive and destabilizes
    // the map for seconds afterward.
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
        // Capped to 20 to match clusterIndex's maxZoom — see the comment
        // there. Anything higher is a zoom level animateToRegion can't
        // actually reach on this map, confirmed via breadcrumb evidence.
        const expansionZoom = Math.min(rawExpansionZoom, 20);
        // If we're already at (or past) the zoom this cluster would expand
        // to, there's nothing further to show -- this cluster is part of a
        // same-spot group stuck at the zoom ceiling (see clusterIndex's
        // comment). Breadcrumb evidence showed that tapping several such
        // already-maxed sub-clusters in quick succession (8 taps in ~12s,
        // each restarting a fresh animateToRegion) destabilizes MapKit's
        // camera -- a chaotic run of unrelated region-change events showed
        // up ~4s after the last tap, remounting markers and closing any open
        // Callout. Skipping the redundant animation entirely avoids
        // triggering that.
        const currentZoom = visibleRegion ? zoomLevelForRegion(visibleRegion.longitudeDelta) : -1;
        if (expansionZoom <= currentZoom) {
          recordBreadcrumb(`cluster:press:already-at-max id=${clusterId} zoom=${currentZoom}`);
          return;
        }
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
        // Deliberately NOT setting visibleRegion here. Breadcrumb evidence
        // showed animateToRegion frequently can't actually reach these tight,
        // zoomed-in deltas -- MapKit settles further out and fires a real
        // onRegionChangeComplete reporting that looser region, sometimes over
        // a second later. Asserting our own guessed region immediately, only
        // to have the real event override it moments after, produced a
        // visible expand -> collapse -> re-expand flicker: markers (including
        // ones with an open Callout) got unmounted and remounted 2-3 times
        // per tap. Letting the real event always win avoids that; the
        // fallback below only fires if no real event shows up at all.
        if (clusterPressFallbackRef.current) {
          clearTimeout(clusterPressFallbackRef.current);
        }
        clusterPressFallbackRef.current = setTimeout(() => {
          clusterPressFallbackRef.current = null;
          setVisibleRegion(region);
        }, 500);
      } catch (error) {
        recordBreadcrumb(`cluster:press:error id=${clusterId} error=${error}`);
      }
    },
    [clusterIndex, visibleRegion],
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
      onRegionChangeComplete={handleRegionChangeComplete}>
      {clusters.map((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;

        if ('cluster' in feature.properties) {
          const { cluster_id: clusterId, point_count: pointCount } = feature.properties;
          return (
            <Marker
              key={`cluster-${clusterId}`}
              identifier={`cluster-${clusterId}`}
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
          <SightingMarker key={sighting.id} sighting={sighting} coordinate={{ latitude, longitude }} />
        );
      })}
    </MapView>
  );
}

function SightingMarker({
  sighting,
  coordinate,
}: {
  sighting: Sighting;
  coordinate: { latitude: number; longitude: number };
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

  const calloutDescription = [
    `${formatRelativeTime(sighting.sighted_at)} · ${locationLabel ?? 'Locating…'}`,
    extras,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Marker
      coordinate={coordinate}
      identifier={sighting.id}
      pinColor={recent ? '#208AEF' : '#9AA0A6'}
      opacity={recent ? 1 : 0.55}
      // Plain native title/subtitle callout rather than a custom child
      // view. react-native-maps' iOS implementation renders every custom
      // Callout's content through ONE shared view (SMCalloutView, created
      // once per map) that's reassigned on every tap -- a long-standing,
      // unresolved upstream bug (react-native-maps#2922, #4814) where that
      // reassignment can end up showing a previous marker's content.
      // Confirmed on-device via breadcrumb evidence that this app's own
      // React/JS state was correct throughout (SightingMarker:press always
      // logged the actually-tapped sighting's own id) -- the staleness is
      // native, in a third-party library file, not fixable from here.
      // title/description route through a separate, simpler native path
      // (plain NSString assignment, no React-rendered subview involved)
      // that isn't implicated in that bug. Trade-off: no photo or notes in
      // the map callout anymore -- both remain viewable from the List tab.
      // No onCalloutPress either: it used to silently open the full-screen
      // photo viewer on tap, but with no photo shown in the callout there's
      // no visual cue that tapping it would do that -- a confusing leftover
      // once the callout became plain text.
      title={sighting.species?.common_name ?? 'Species not noted'}
      description={calloutDescription}
      // Opening a Callout by tapping its Marker is entirely native (MapKit).
      // onPress marks the tap; onDeselect marks whenever the Callout is
      // dismissed, whether by the user tapping elsewhere or by something
      // else forcing it closed -- kept as a diagnostic even after moving
      // off custom Callout content, since the underlying selection
      // lifecycle is unchanged.
      onPress={() => recordBreadcrumb(`SightingMarker:press id=${sighting.id}`)}
      onDeselect={() => recordBreadcrumb(`SightingMarker:deselect id=${sighting.id}`)}
    />
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
});
