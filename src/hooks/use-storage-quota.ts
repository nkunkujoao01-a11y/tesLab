import { useEffect, useState } from "react";

export type StorageQuota = {
  usageMb: number;
  quotaMb: number;
  availableMb: number;
  // The Storage API isn't universally available (older Safari, some
  // in-app browsers) — callers must check this before trusting the
  // numbers above, since unsupported browsers report zeroes, not "plenty
  // of room".
  supported: boolean;
};

const UNSUPPORTED: StorageQuota = { usageMb: 0, quotaMb: 0, availableMb: 0, supported: false };

// Below this much *real* free space (per navigator.storage.estimate(), not
// this app's own download bookkeeping — see useStorageUsageMb), warn the
// student before a download fails outright. Sits comfortably under
// NFR10's stated 1GB minimum device storage, and under the size of a
// full module download (materials in this app already run 100MB-1.2GB).
export const LOW_STORAGE_THRESHOLD_MB = 500;

/** Reads the browser's real, device-level storage quota — distinct from
 * useStorageUsageMb, which only tracks what this app itself has downloaded
 * against an assumed budget. This hook answers "is the device actually
 * about to run out of room" (accounting for everything sharing this
 * origin's storage, including the AI model cache), not "how much of my
 * download budget have I used". Re-checks whenever `refreshKey` changes —
 * pass something that changes after a download/delete (e.g. the value
 * from useStorageUsageMb) so the reading stays current. */
export function useStorageQuota(refreshKey: unknown): StorageQuota {
  const [quota, setQuota] = useState<StorageQuota>(UNSUPPORTED);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
      return;
    }
    let cancelled = false;
    navigator.storage
      .estimate()
      .then((estimate) => {
        if (cancelled) return;
        const usageMb = (estimate.usage ?? 0) / (1024 * 1024);
        const quotaMb = (estimate.quota ?? 0) / (1024 * 1024);
        setQuota({ usageMb, quotaMb, availableMb: quotaMb - usageMb, supported: true });
      })
      .catch((err) => console.error("Failed to read storage estimate", err));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return quota;
}

export function isStorageLow(quota: StorageQuota): boolean {
  return quota.supported && quota.availableMb < LOW_STORAGE_THRESHOLD_MB;
}
