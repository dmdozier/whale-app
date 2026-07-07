import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';

import { useLocationLabel } from '@/hooks/use-location-label';
import { formatRelativeTime, isRecentSighting } from '@/lib/sighting-time';
import type { Sighting } from '@/types/sighting';

const DEFAULT_REGION: Region = {
  latitude: 47.6062,
  longitude: -122.3321,
  latitudeDelta: 4,
  longitudeDelta: 4,
};

export function SightingsMap({ sightings }: { sightings: Sighting[] }) {
  const mapRef = useRef<MapView>(null);

  // Center and zoom to the user's current location on open. If permission
  // isn't granted or the location can't be resolved, the map just stays on
  // DEFAULT_REGION instead of blocking or erroring.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        },
        700,
      );
    })().catch(() => {});
  }, []);

  return (
    <MapView ref={mapRef} style={styles.map} initialRegion={DEFAULT_REGION} showsUserLocation>
      {sightings.map((sighting) => (
        <SightingMarker key={sighting.id} sighting={sighting} />
      ))}
    </MapView>
  );
}

function SightingMarker({ sighting }: { sighting: Sighting }) {
  const recent = isRecentSighting(sighting.sighted_at);
  const locationLabel = useLocationLabel({
    latitude: sighting.latitude,
    longitude: sighting.longitude,
  });

  return (
    <Marker
      coordinate={{ latitude: sighting.latitude, longitude: sighting.longitude }}
      pinColor={recent ? '#208AEF' : '#9AA0A6'}
      opacity={recent ? 1 : 0.55}>
      <Callout>
        <View style={styles.callout}>
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
  callout: {
    minWidth: 160,
    maxWidth: 240,
    gap: 2,
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
