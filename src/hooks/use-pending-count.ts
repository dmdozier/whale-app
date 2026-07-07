import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getPendingSightings } from '@/lib/offline-queue';

export function usePendingSightingsCount() {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getPendingSightings().then((pending) => setCount(pending.length));
    }, []),
  );

  return count;
}
