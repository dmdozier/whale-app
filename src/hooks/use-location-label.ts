import { useEffect, useState } from 'react';

import { recordBreadcrumb } from '@/lib/breadcrumbs';
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
        // This setLabel triggers a second render of whatever's using this
        // hook — e.g. a Map Callout that already mounted with a
        // "Locating…" placeholder now re-rendering with the resolved
        // address. That second render has had zero breadcrumb coverage so
        // far, even though it happens later than everything currently
        // instrumented and could be where a crash is actually landing.
        recordBreadcrumb(
          `useLocationLabel:resolved lat=${coords.latitude} lng=${coords.longitude} label=${result}`,
        );
        setLabel(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [coords?.latitude, coords?.longitude]);

  return label;
}
