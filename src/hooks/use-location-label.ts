import { useEffect, useState } from 'react';

import { getLocationLabel } from '@/lib/reverse-geocode';

export function useLocationLabel(coords: { latitude: number; longitude: number } | null) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!coords) {
      setLabel(null);
      return;
    }

    let cancelled = false;
    getLocationLabel(coords.latitude, coords.longitude).then((result) => {
      if (!cancelled) {
        setLabel(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [coords?.latitude, coords?.longitude]);

  return label;
}
