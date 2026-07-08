import { Alert, Platform } from 'react-native';

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;

// React Native sets this on `global` before any JS module loads (see
// react-native/Libraries/vendor/core/ErrorUtils.js). It has no public,
// import-friendly type declaration, so it's read directly off `global`
// rather than imported.
const nativeErrorUtils = (
  global as unknown as {
    ErrorUtils?: {
      setGlobalHandler: (handler: ErrorHandler) => void;
      getGlobalHandler: () => ErrorHandler;
    };
  }
).ErrorUtils;

// A native crash — e.g. the OS killing the app for using too much memory —
// can't be caught here; there's no JS left running to catch it once that
// happens. This only helps with the other kind of "silent" failure: an
// uncaught JS exception or fatal error that would otherwise end the app
// with nothing in Expo Go's logs to explain why.
export function installGlobalErrorHandlers() {
  if (Platform.OS === 'web' || !nativeErrorUtils) {
    return;
  }

  const defaultHandler = nativeErrorUtils.getGlobalHandler();
  nativeErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error(`[GlobalError]${isFatal ? ' (fatal)' : ''}`, error);
    Alert.alert(
      isFatal ? 'Unexpected error' : 'Something went wrong',
      error instanceof Error ? error.message : String(error),
    );
    defaultHandler(error, isFatal);
  });
}
