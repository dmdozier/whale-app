import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Sighting } from '@/types/sighting';

// react-native-maps has no web implementation, so the web build shows a
// plain message instead of pins. The real map runs on iOS/Android.
export function SightingsMap(_props: {
  sightings: Sighting[];
  onPhotoPress: (photoUrl: string) => void;
}) {
  return (
    <View style={styles.container}>
      <ThemedText type="title" style={styles.emoji}>
        🗺️
      </ThemedText>
      <ThemedText type="subtitle">Map</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centerText}>
        The map view is only available in the iOS/Android app — open Whale Sightings on your
        phone to see sighting pins.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  emoji: {
    fontSize: 56,
    lineHeight: 64,
  },
  centerText: {
    textAlign: 'center',
  },
});
