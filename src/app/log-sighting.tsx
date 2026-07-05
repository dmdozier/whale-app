import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SPECIES_OPTIONS = [
  'Humpback Whale',
  'Gray Whale',
  'Orca (Killer Whale)',
  'Blue Whale',
  'Minke Whale',
  'Fin Whale',
  'Dolphin',
  'Not Sure',
];

export default function LogSightingScreen() {
  const theme = useTheme();
  const [species, setSpecies] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView type="backgroundElement" style={styles.locationCard}>
          <ThemedText type="smallBold">📍 Location + time will be captured automatically</ThemedText>
        </ThemedView>

        <ThemedText type="smallBold" style={styles.label}>
          Species (optional)
        </ThemedText>
        <ThemedView style={styles.chipRow}>
          {SPECIES_OPTIONS.map((option) => {
            const selected = species === option;
            return (
              <Pressable
                key={option}
                onPress={() => setSpecies(selected ? null : option)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? theme.text : theme.backgroundElement,
                  },
                ]}>
                <ThemedText
                  type="small"
                  style={{ color: selected ? theme.background : theme.text }}>
                  {option}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        <ThemedText type="smallBold" style={styles.label}>
          Notes (optional)
        </ThemedText>
        <TextInput
          style={[styles.notesInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Anything else worth noting?"
          placeholderTextColor={theme.textSecondary}
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <Pressable style={styles.photoButton}>
          <ThemedText type="link">📷 Attach a photo (optional)</ThemedText>
        </Pressable>

        <Pressable style={styles.saveButton} onPress={() => router.back()}>
          <ThemedText style={styles.saveButtonText}>Save Sighting</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  locationCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  label: {
    marginTop: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  notesInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 88,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  photoButton: {
    paddingVertical: Spacing.two,
  },
  saveButton: {
    marginTop: 'auto',
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
