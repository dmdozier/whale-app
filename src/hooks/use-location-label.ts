import { useEffect, useState } from 'react';

import { recordBreadcrumb } from '@/lib/breadcrumbs';
import { getLocationLabel } from '@/lib/reverse-geocode';

const LABEL_UPDATE_STAGGER_MS = 60;

// Serializes every setLabel() call across every useLocationLabel instance
// in the app, each separated by a short delay. Breadcrumb evidence across
// many crash reproductions consistently showed two specific markers
// resolving their (cached, near-instant) labels within ~15ms of each
// other, right as new data lands — almost certainly landing their
// setState calls in the same React batch and updating two Callouts'
// native content in one commit. That's the one pattern that held steady
// across every test regardless of what was saved or how long the
// surrounding fetch was delayed. Staggering updates here means no two
// label updates can ever land in the same batch, no matter how close
// together their underlying lookups resolve.
let labelUpdateQueue: Promise<void> = Promise.resolve();

export function useLocationLabel(coords: { latitude: number; longitude: number } | null) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!coords) {
      setLabel(null);
      return;
    }

    let cancelled = false;
    getLocationLabel(coords.latitude, coords.longitude).then((result) => {
      if (cancelled) {
        return;
      }
      labelUpdateQueue = labelUpdateQueue.then(
        () =>
          new Promise<void>((resolve) => {
            if (!cancelled) {
              // This setLabel triggers a second render of whatever's using
              // this hook — e.g. a Map Callout that already mounted with a
              // "Locating…" placeholder now re-rendering with the resolved
              // address.
              recordBreadcrumb(
                `useLocationLabel:resolved lat=${coords.latitude} lng=${coords.longitude} label=${result}`,
              );
              setLabel(result);
            }
            setTimeout(resolve, LABEL_UPDATE_STAGGER_MS);
          }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [coords?.latitude, coords?.longitude]);

  return label;
}
