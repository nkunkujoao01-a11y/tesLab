// Shared network-timeout wrapper. Originally lived only in modules-api.ts;
// extracted so use-auth.tsx's profile fetch can share the exact same
// fail-fast behavior instead of duplicating it (see that file's profile
// effect and DEV_LOG.md Feature 30 for the original reasoning below).

// FR: on a bad connection, a hung Supabase request previously blocked the
// whole route for however long the browser's own TCP timeout takes (~8s,
// measured in DEV_LOG.md Feature 29) before the loader could fail into any
// fallback at all. 6s is short enough to fail fast into an offline/cache
// fallback while still being generous on a genuinely slow (not dead)
// connection — see Feature 30.
export const NETWORK_TIMEOUT_MS = 6000;

export class NetworkTimeoutError extends Error {
  constructor() {
    super("Network request timed out");
    this.name = "NetworkTimeoutError";
  }
}

export function withTimeout<T>(promise: PromiseLike<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new NetworkTimeoutError()), NETWORK_TIMEOUT_MS);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
