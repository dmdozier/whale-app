import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import { Callout, Marker, type Region } from 'react-native-maps';

import { useLocationLabel } from '@/hooks/use-location-label';
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

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setInitialRegion(DEFAULT_REGION);
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setInitialRegion({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    })().catch(() => setInitialRegion(DEFAULT_REGION));
  }, []);

  if (!initialRegion) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ClusteredMapView
      style={styles.map}
      initialRegion={initialRegion}
      showsUserLocation
      clusterColor="#208AEF"
      clusterTextColor="#ffffff"
      // Rapid/extreme zooming with this library is a known source of native
      // crashes on Android (see e.g. react-native-maps#5516 and similar
      // reports against react-native-map-clustering) — it's tied to the
      // "spiderfy" animation it runs when many markers share ~the same spot
      // at high zoom, and to LayoutAnimation firing on every region change.
      // Sightings logged from the same popular viewing spot are exactly the
      // case that triggers it, so disable both rather than just hoping it
      // doesn't come up, and cap how far in clustering bothers to recompute.
      spiralEnabled={false}
      animationEnabled={false}
      maxZoom={17}>
      {sightings.map((sighting) => (
        <SightingMarker
          key={sighting.id}
          sighting={sighting}
          onPhotoPress={onPhotoPress}
          // react-native-map-clustering detects which children to cluster by
          // duck-typing a `coordinate` prop directly on each one — it doesn't
          // check the component type, so this has to be set here.
          coordinate={{ latitude: sighting.latitude, longitude: sighting.longitude }}
        />
      ))}
    </ClusteredMapView>
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
