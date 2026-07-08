import AsyncStorage from '@react-native-async-storage/async-storage';

const BREADCRUMBS_KEY = 'whale-app/debug-breadcrumbs';
const MAX_BREADCRUMBS = 200;

// Diagnostic trail for crashes that leave nothing else behind. A true
// native crash (an OS memory kill, a native module exception) tears down
// the process before any console.log can cross the JS-to-native log bridge
// and before any in-memory state can be inspected — which is exactly the
// kind of crash this is tracking. AsyncStorage writes are flushed to disk
// immediately, so a breadcrumb recorded right before a crash survives it
// and can be read back the next time the app starts, showing exactly how
// far execution got.
//
// Calls are serialized through this queue rather than run independently.
// recordBreadcrumb does a read-modify-write (getItem -> push -> setItem),
// and with many call sites now firing close together (e.g. a marker mount
// breadcrumb per sighting, 16+ of them at once on a map with that many
// pins), two overlapping calls can each read the same "before" state and
// then each write back their own version — silently erasing whichever one
// wrote first. Chaining every call onto the same promise means each
// read-modify-write cycle fully completes before the next one starts, no
// matter how many callers fire concurrently.
let writeQueue: Promise<void> = Promise.resolve();

export function recordBreadcrumb(label: string): Promise<void> {
  const entry = `${new Date().toISOString()} ${label}`;
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    try {
      const raw = await AsyncStorage.getItem(BREADCRUMBS_KEY);
      const trail: string[] = raw ? JSON.parse(raw) : [];
      trail.push(entry);
      await AsyncStorage.setItem(BREADCRUMBS_KEY, JSON.stringify(trail.slice(-MAX_BREADCRUMBS)));
    } catch {
      // Diagnostics must never be able to break the feature they're watching.
    }
  });
  return writeQueue;
}

export async function readAndClearBreadcrumbs(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(BREADCRUMBS_KEY);
  await AsyncStorage.removeItem(BREADCRUMBS_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}
