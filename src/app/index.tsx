import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Mode = 'signIn' | 'signUp';

export default function LoginScreen() {
  const theme = useTheme();
  const { session, initializing } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!initializing && session) {
      router.replace('/map');
    }
  }, [initializing, session]);

  const submit = async () => {
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError('Enter an email and password.');
      return;
    }

    setSubmitting(true);
    const { data, error: authError } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === 'signUp' && !data.session) {
      setInfo('Check your email to confirm your account, then log in.');
      setMode('signIn');
    }
    // If a session comes back (sign-in, or sign-up with confirmations off),
    // the useEffect above picks up the auth state change and navigates.
  };

  if (initializing) {
    return (
      <ThemedView style={styles.centeredContainer}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.titleEmoji}>
              🐋
            </ThemedText>
            <ThemedText type="subtitle" style={styles.heading}>
              Whale Sightings
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.form}>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.backgroundSelected },
                ]}
                placeholder="Email"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.backgroundSelected },
                ]}
                placeholder="Password"
                placeholderTextColor={theme.textSecondary}
                autoComplete={mode === 'signIn' ? 'password' : 'new-password'}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              {error ? (
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              ) : null}
              {info ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {info}
                </ThemedText>
              ) : null}

              <Pressable
                style={[styles.primaryButton, submitting && styles.disabledButton]}
                onPress={submit}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>
                    {mode === 'signIn' ? 'Log In' : 'Sign Up'}
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                  setError(null);
                  setInfo(null);
                }}>
                <ThemedText type="link" themeColor="textSecondary" style={styles.centerText}>
                  {mode === 'signIn'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Log in'}
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
  },
  titleEmoji: {
    fontSize: 64,
    lineHeight: 72,
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  heading: {
    textAlign: 'center',
    marginBottom: Spacing.five,
  },
  form: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  errorText: {
    color: '#D64545',
  },
  centerText: {
    textAlign: 'center',
  },
});
