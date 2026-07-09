import 'react-native-url-polyfill/auto';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AuthProvider } from '@/hooks/use-auth';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { readAndClearBreadcrumbs } from '@/lib/breadcrumbs';
import { installGlobalErrorHandlers } from '@/lib/global-error-handler';

installGlobalErrorHandlers();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useOfflineSync();

  // Debug-only: if the previous session left breadcrumbs behind (see
  // src/lib/breadcrumbs.ts), it means the app didn't get to clear them on
  // its own — most likely because it was killed by something that gave the
  // JS side no chance to run any cleanup, e.g. a native crash. Printed to
  // the console (Metro's terminal) rather than an on-screen Alert -- live
  // breadcrumbs are now also console.log'd as they happen (see
  // breadcrumbs.ts), so the terminal is already the primary place to watch
  // for this, and a startup Alert was more disruptive than useful.
  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    readAndClearBreadcrumbs().then((trail) => {
      if (trail.length === 0) {
        return;
      }
      console.log('[Breadcrumbs from previous session]', trail);
    });
  }, []);

  return (
    <KeyboardProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="log-sighting"
              options={{ presentation: 'modal', title: 'Log Sighting' }}
            />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </KeyboardProvider>
  );
}
