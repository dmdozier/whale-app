import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoutButton } from '@/components/logout-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function ListScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <LogoutButton />
        <ThemedText type="title" style={styles.placeholder}>
          📋
        </ThemedText>
        <ThemedText type="subtitle">Recent Sightings</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          No sightings yet. Once syncing is wired up, recent sightings will be listed here.
        </ThemedText>
      </SafeAreaView>

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
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  placeholder: {
    fontSize: 56,
    lineHeight: 64,
  },
  centerText: {
    textAlign: 'center',
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
