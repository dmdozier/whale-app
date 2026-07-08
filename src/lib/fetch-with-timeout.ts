const DEFAULT_TIMEOUT_MS = 30000;

// Neither `fetch()` on a local file URI nor the Supabase JS client apply any
// timeout of their own, so a stalled connection (e.g. a slow or flaky
// network path) hangs forever with no error ever surfacing — the save
// button just spins. Give every request a hard deadline so a stall becomes
// a catchable, loggable error instead of a silent hang.
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
}
