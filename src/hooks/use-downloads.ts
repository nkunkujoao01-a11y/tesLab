import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import { getUserDb, materialKey } from "@/lib/db";
import { fetchModule } from "@/lib/modules-api";
import type { MaterialContent } from "@/lib/supabase";
import { logActivity } from "@/hooks/use-activity";
import { useAuth } from "@/hooks/use-auth";
import { withViewTransition } from "@/lib/utils";

// FR81: actionable, not just "something went wrong" — a QuotaExceededError
// specifically means the device is out of room (ties into Feature 16's
// low-storage warning), which has a different fix than a dropped network
// request does.
function describeStorageError(err: unknown): string {
  if (err instanceof DOMException && err.name === "QuotaExceededError") {
    return "Not enough storage on this device. Remove some downloads and try again.";
  }
  return "Couldn't finish the download. Check your connection and try again.";
}

export function useDownloadedModuleIds(): Set<string> {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.downloadedModules.toArray()).subscribe({
      // withViewTransition: a module leaving/entering "Available offline"
      // the instant its download completes should cross-fade, not pop.
      next: (rows) => withViewTransition(() => setIds(new Set(rows.map((r) => r.moduleId)))),
      error: (err) => console.error("Failed to read downloaded modules", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return ids;
}

/** Returns composite `moduleId::materialId` keys — see materialKey() in
 * lib/db.ts. Material ids are only unique within their own module, so
 * callers must check `.has(materialKey(moduleId, materialId))`, not
 * `.has(materialId)`. */
export function useDownloadedMaterialIds(): Set<string> {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.downloadedMaterials.toArray()).subscribe({
      next: (rows) => withViewTransition(() => setIds(new Set(rows.map((r) => r.key)))),
      error: (err) => console.error("Failed to read downloaded materials", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return ids;
}

/** Reads a downloaded material's cached content straight from IndexedDB —
 * not a Supabase fetch — so the reader works fully offline once a material
 * has been downloaded. Returns undefined if not downloaded (or not yet
 * downloaded with content, for rows written before this field existed). */
export function useDownloadedMaterialContent(
  moduleId: string,
  materialId: string,
): MaterialContent | undefined {
  const { user } = useAuth();
  const [content, setContent] = useState<MaterialContent | undefined>(undefined);
  const key = materialKey(moduleId, materialId);

  useEffect(() => {
    if (!user) {
      setContent(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.downloadedMaterials.get(key)).subscribe({
      next: (row) => setContent(row?.content),
      error: (err) => console.error("Failed to read downloaded material content", err),
    });
    return () => sub.unsubscribe();
  }, [user, key]);

  return content;
}

/** Every downloaded material's cached content for one module, keyed by
 * materialId — the "ask AI about this whole module" chat (courses.
 * $moduleId.chat.index.tsx) needs all of a module's downloaded content at
 * once, not one material at a time the way useDownloadedMaterialContent
 * above reads. Same "read straight from IndexedDB, not Supabase" offline-
 * first reasoning — a material the student hasn't downloaded yet simply
 * isn't included, same as it wouldn't be available to read offline
 * either. */
export function useDownloadedModuleMaterials(moduleId: string): Map<string, MaterialContent> {
  const { user } = useAuth();
  const [contentByMaterialId, setContentByMaterialId] = useState<Map<string, MaterialContent>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!user) {
      setContentByMaterialId(new Map());
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() =>
      db.downloadedMaterials.where("moduleId").equals(moduleId).toArray(),
    ).subscribe({
      next: (rows) => {
        const next = new Map<string, MaterialContent>();
        for (const row of rows) {
          if (row.content) next.set(row.materialId, row.content);
        }
        setContentByMaterialId(next);
      },
      error: (err) => console.error("Failed to read downloaded module materials", err),
    });
    return () => sub.unsubscribe();
  }, [user, moduleId]);

  return contentByMaterialId;
}

export function useDownloadModule() {
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const downloadModule = useCallback(
    async (moduleId: string, sizeMb: number) => {
      if (!user) return;
      const db = getUserDb(user.id);
      setPendingIds((prev) => new Set(prev).add(moduleId));
      try {
        // Simulated download time — the real work is fetching + caching each
        // material's content below, not this delay.
        await new Promise((resolve) => setTimeout(resolve, 600));
        const downloadedAt = Date.now();
        const module = await fetchModule(moduleId);
        await db.transaction("rw", db.downloadedModules, db.downloadedMaterials, async () => {
          await db.downloadedModules.put({ moduleId, downloadedAt, sizeMb });
          // Downloading a module makes all of its materials — and their real
          // content — available offline too, not just the "downloaded" flag.
          if (module) {
            await db.downloadedMaterials.bulkPut(
              module.materials.map((mat) => ({
                key: materialKey(moduleId, mat.id),
                materialId: mat.id,
                moduleId,
                downloadedAt,
                sizeMb: mat.sizeMb,
                content: mat.content,
                kind: mat.kind,
              })),
            );
          }
        });
        void logActivity(user.id, "download");
      } catch (err) {
        console.error("Failed to download module", err);
        toast.error(describeStorageError(err));
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(moduleId);
          return next;
        });
      }
    },
    [user],
  );

  return { downloadModule, pendingIds };
}

export function useDownloadMaterial() {
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const downloadMaterial = useCallback(
    async (
      materialId: string,
      moduleId: string,
      sizeMb: number,
      content: MaterialContent,
      kind: string,
    ) => {
      if (!user) return;
      const db = getUserDb(user.id);
      const key = materialKey(moduleId, materialId);
      setPendingIds((prev) => new Set(prev).add(key));
      try {
        await new Promise((resolve) => setTimeout(resolve, 600));
        await db.downloadedMaterials.put({
          key,
          materialId,
          moduleId,
          downloadedAt: Date.now(),
          sizeMb,
          content,
          kind,
        });
        void logActivity(user.id, "download");
      } catch (err) {
        console.error("Failed to download material", err);
        toast.error(describeStorageError(err));
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [user],
  );

  return { downloadMaterial, pendingIds };
}

export function useStorageUsageMb(): number {
  const { user } = useAuth();
  const [usedMb, setUsedMb] = useState(0);

  useEffect(() => {
    if (!user) {
      setUsedMb(0);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(async () => {
      const [modules, materials, documentFiles] = await Promise.all([
        db.downloadedModules.toArray(),
        db.downloadedMaterials.toArray(),
        db.personalDocumentFiles.toArray(),
      ]);
      const downloadedModuleIds = new Set(modules.map((m) => m.moduleId));
      const modulesMb = modules.reduce((sum, m) => sum + m.sizeMb, 0);
      // Materials belonging to a module that was itself downloaded are already
      // accounted for in that module's own size — only add materials
      // downloaded independently of a full module download.
      const standaloneMaterialsMb = materials
        .filter((m) => !downloadedModuleIds.has(m.moduleId))
        .reduce((sum, m) => sum + m.sizeMb, 0);
      // The original files behind uploaded personal documents — a real
      // extra footprint on top of their already-counted extracted text
      // (which is small enough to not matter), see PersonalDocumentFile.
      const documentFilesMb = documentFiles.reduce((sum, f) => sum + f.sizeMb, 0);
      return modulesMb + standaloneMaterialsMb + documentFilesMb;
    }).subscribe({
      next: setUsedMb,
      error: (err) => console.error("Failed to compute storage usage", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return usedMb;
}

/** Real per-kind storage breakdown (Slides/Readings/Handouts/Notes/…),
 * computed straight from IndexedDB — not derived from useStorageUsageMb,
 * which sums whole-module declared sizes for module downloads rather than
 * their individual materials' sizes, so the two totals may differ very
 * slightly. Rows written before Feature 17 (no `kind` field) are grouped
 * under "other" rather than silently dropped. */
export function useStorageByKind(): Record<string, number> {
  const { user } = useAuth();
  const [byKind, setByKind] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) {
      setByKind({});
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(async () => {
      const [materials, documentFiles] = await Promise.all([
        db.downloadedMaterials.toArray(),
        db.personalDocumentFiles.toArray(),
      ]);
      const totals: Record<string, number> = {};
      for (const row of materials) {
        const kind = row.kind ?? "other";
        totals[kind] = (totals[kind] ?? 0) + row.sizeMb;
      }
      // Uploaded personal documents get their own real bucket rather than
      // falling into "other" — a real, distinct kind of storage use, not
      // an edge case (see PersonalDocumentFile).
      if (documentFiles.length > 0) {
        totals.document = documentFiles.reduce((sum, f) => sum + f.sizeMb, 0);
      }
      return totals;
    }).subscribe({
      next: setByKind,
      error: (err) => console.error("Failed to compute storage breakdown", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return byKind;
}

export function useDeleteModule() {
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const deleteModule = useCallback(
    async (moduleId: string) => {
      if (!user) return;
      const db = getUserDb(user.id);
      setPendingIds((prev) => new Set(prev).add(moduleId));
      try {
        await db.transaction("rw", db.downloadedModules, db.downloadedMaterials, async () => {
          await db.downloadedModules.delete(moduleId);
          await db.downloadedMaterials.where("moduleId").equals(moduleId).delete();
        });
      } catch (err) {
        console.error("Failed to remove download", err);
        toast.error("Couldn't remove this download. Try again.");
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(moduleId);
          return next;
        });
      }
    },
    [user],
  );

  return { deleteModule, pendingIds };
}
