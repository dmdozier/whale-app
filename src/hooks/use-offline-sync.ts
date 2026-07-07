import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';

import { syncPendingSightings } from '@/lib/offline-queue';

// Mounted once at the app root. Tries to flush the local queue on startup,
// then again every time the device regains connectivity.
export function useOfflineSync() {
  useEffect(() => {
    syncPendingSightings();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncPendingSightings();
      }
    });

    return unsubscribe;
  }, []);
}
