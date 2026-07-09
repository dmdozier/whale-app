import { createContext, useContext, useState, type PropsWithChildren } from 'react';

import { PhotoViewerModal } from '@/components/photo-viewer-modal';

type PhotoViewerContextValue = {
  openPhoto: (photoUrl: string) => void;
};

const PhotoViewerContext = createContext<PhotoViewerContextValue>({ openPhoto: () => {} });

// A single, app-wide photo viewer instead of one per screen. Map and List
// both used to render their own local <PhotoViewerModal>, and since Expo
// Router keeps tab screens mounted even when not focused, both existed in
// the tree at the same time. Leaving one open (e.g. via a Map callout) and
// then opening another from List meant two native Modals were presented
// simultaneously on iOS -- confirmed as the cause of a reported bug where
// the close button became unreliable and the List screen went completely
// unresponsive afterward (native modal presentation/dismissal getting
// confused about which view controller is on top). A single shared
// instance makes that impossible: there's only ever one photoUrl to open.
export function PhotoViewerProvider({ children }: PropsWithChildren) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  return (
    <PhotoViewerContext.Provider value={{ openPhoto: setPhotoUrl }}>
      {children}
      <PhotoViewerModal photoUrl={photoUrl} onClose={() => setPhotoUrl(null)} />
    </PhotoViewerContext.Provider>
  );
}

export function usePhotoViewer() {
  return useContext(PhotoViewerContext);
}
