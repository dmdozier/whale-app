import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Redirect, Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { addPendingSighting, submitSighting } from '@/lib/offline-queue';
import { supabase } from '@/lib/supabase';

type Species = { id: number; common_name: string };
type Coords = { latitude: number; longitude: number };

export default function LogSightingScreen() {
  const theme = useTheme();
  const { session, initializing } = useAuth();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [sightedAt, setSightedAt] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | null>(null);

  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Capture the sighting's GPS location as soon as the screen opens.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission is required to log a sighting.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setSightedAt(new Date().toISOString());
    })().catch(() => setLocationError('Could not get your location. Try again.'));
  }, []);

  // Load the species list from Supabase for the picker. If we're offline,
  // this just silently fails and the picker stays empty — species is optional.
  useEffect(() => {
    supabase
      .from('species')
      .select('id, common_name')
      .order('sort_order')
      .then(
        ({ data }) => setSpeciesList((data ?? []) as Species[]),
        () => {},
      );
  }, []);

  if (initializing) {
    return null;
  }

  if (!session) {
    return <Redirect href="/" />;
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setSaveError('Camera permission is needed to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const save = async () => {
    if (!coords || !sightedAt) {
      setSaveError('Still waiting for your location — try again in a moment.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const pendingSighting = {
      clientId: Crypto.randomUUID(),
      userId: session.user.id,
      speciesId: selectedSpeciesId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      sightedAt,
      notes: notes || null,
      photoUri,
    };

    try {
      await submitSighting(pendingSighting);
      router.back();
    } catch {
      // No connection (or a transient failure) — save it on-device instead
      // of losing it. The background sync picks it up once we're back online.
      await addPendingSighting(pendingSighting);
      Alert.alert(
        'Saved offline',
        "This sighting is saved on your device and will sync automatically once you're back online.",
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.cancelButton}>
              <ThemedText type="link">Cancel</ThemedText>
            </Pressable>
          ),
        }}
      />
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bottomOffset={Spacing.four}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView type="backgroundElement" style={styles.locationCard}>
            {coords ? (
              <ThemedText type="smallBold">
                📍 Location captured ({coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)})
              </ThemedText>
            ) : locationError ? (
              <ThemedText type="smallBold" style={styles.errorText}>
                📍 {locationError}
              </ThemedText>
            ) : (
              <ThemedText type="smallBold">📍 Getting your location…</ThemedText>
            )}
          </ThemedView>

          <ThemedText type="smallBold" style={styles.label}>
            Species (optional)
          </ThemedText>
          <ThemedView style={styles.chipRow}>
            {speciesList.map((option) => {
              const selected = selectedSpeciesId === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedSpeciesId(selected ? null : option.id)}
                  style={[
                    styles.chip,
                    { backgroundColor: selected ? theme.text : theme.backgroundElement },
                  ]}>
                  <ThemedText
                    type="small"
                    style={{ color: selected ? theme.background : theme.text }}>
                    {option.common_name}
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

          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photoPreview} /> : null}
          <Pressable style={styles.photoButton} onPress={takePhoto}>
            <ThemedText type="link">
              📷 {photoUri ? 'Retake photo' : 'Attach a photo (optional)'}
            </ThemedText>
          </Pressable>

          {saveError ? (
            <ThemedText type="small" style={styles.errorText}>
              {saveError}
            </ThemedText>
          ) : null}

          <Pressable
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={save}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText style={styles.saveButtonText}>Save Sighting</ThemedText>
            )}
          </Pressable>
        </SafeAreaView>
      </KeyboardAwareScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cancelButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  scrollContent: {
    flexGrow: 1,
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
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: Spacing.two,
  },
  photoButton: {
    paddingVertical: Spacing.two,
  },
  errorText: {
    color: '#D64545',
  },
  saveButton: {
    marginTop: Spacing.three,
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
