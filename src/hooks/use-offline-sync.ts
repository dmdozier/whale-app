import { addNetworkStateListener } from 'expo-network';
import { useEffect } from 'react';

import { syncPendingSightings } from '@/lib/offline-queue';

// Mounted once at the app root. Tries to flush the local queue on startup,
// then again every time the device regains connectivity.
//
// Uses expo-network rather than @react-native-community/netinfo — netinfo
// isn't bundled in Expo Go, so relying on it would mean needing a custom
// EAS dev build just to test this app. expo-network's connectivity
// listener covers the same isConnected/isInternetReachable fields we need
// and stays fully Expo Go-compatible.
export function useOfflineSync() {
  useEffect(() => {
    syncPendingSightings();

    const subscription = addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncPendingSightings();
      }
    });

    return () => subscription.remove();
  }, []);
}
