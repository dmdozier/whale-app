import 'react-native-url-polyfill/auto';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AuthProvider } from '@/hooks/use-auth';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { installGlobalErrorHandlers } from '@/lib/global-error-handler';

installGlobalErrorHandlers();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useOfflineSync();

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
