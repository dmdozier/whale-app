import AsyncStorage from '@react-native-async-storage/async-storage';

const BREADCRUMBS_KEY = 'whale-app/debug-breadcrumbs';
const MAX_BREADCRUMBS = 25;

// Diagnostic trail for crashes that leave nothing else behind. A true
// native crash (an OS memory kill, a native module exception) tears down
// the process before any console.log can cross the JS-to-native log bridge
// and before any in-memory state can be inspected — which is exactly the
// kind of crash this is tracking. AsyncStorage writes are flushed to disk
// immediately, so a breadcrumb recorded right before a crash survives it
// and can be read back the next time the app starts, showing exactly how
// far execution got.
export async function recordBreadcrumb(label: string) {
  try {
    const raw = await AsyncStorage.getItem(BREADCRUMBS_KEY);
    const trail: string[] = raw ? JSON.parse(raw) : [];
    trail.push(`${new Date().toISOString()} ${label}`);
    await AsyncStorage.setItem(BREADCRUMBS_KEY, JSON.stringify(trail.slice(-MAX_BREADCRUMBS)));
  } catch {
    // Diagnostics must never be able to break the feature they're watching.
  }
}

export async function readAndClearBreadcrumbs(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(BREADCRUMBS_KEY);
  await AsyncStorage.removeItem(BREADCRUMBS_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}
