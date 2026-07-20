import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import { getUserDb, materialKey, type MaterialSummary, type AnySummary } from "@/lib/db";
import { generateStructuredSummary } from "@/lib/summarize-structured";
import { logActivity } from "@/hooks/use-activity";
import { useAuth } from "@/hooks/use-auth";

export function useMaterialSummary(
  moduleId: string,
  materialId: string,
): MaterialSummary | undefined {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MaterialSummary | undefined>(undefined);
  const key = materialKey(moduleId, materialId);

  useEffect(() => {
    if (!user) {
      setSummary(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.materialSummaries.get(key)).subscribe({
      next: setSummary,
      error: (err) => console.error("Failed to read material summary", err),
    });
    return () => sub.unsubscribe();
  }, [user, key]);

  return summary;
}

export function useLatestModuleSummary(moduleId: string): MaterialSummary | undefined {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MaterialSummary | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setSummary(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() =>
      db.materialSummaries.where("moduleId").equals(moduleId).toArray(),
    ).subscribe({
      next: (rows) => {
        const latest = rows.reduce<MaterialSummary | undefined>(
          (best, row) => (!best || row.generatedAt > best.generatedAt ? row : best),
          undefined,
        );
        setSummary(latest);
      },
      error: (err) => console.error("Failed to read module summary", err),
    });
    return () => sub.unsubscribe();
  }, [user, moduleId]);

  return summary;
}

/** Every summary the user has generated, across every module *and* every
 * personal document, newest first — the real feed behind the Summaries
 * page (see DEV_LOG.md, Feature 25; it previously showed 4 hardcoded
 * canned entries unrelated to anything the user actually did). Feature 54
 * extended this to also read `personalDocuments` — a summary generated
 * for a student's own uploaded/extracted PDF previously never showed up
 * here at all, only catalog-material summaries did. Sorted client-side
 * rather than via a Dexie index since `generatedAt` isn't indexed and
 * per-user summary counts are small (a few dozen at most). */
export function useAllSummaries(): AnySummary[] {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<AnySummary[]>([]);

  useEffect(() => {
    if (!user) {
      setSummaries([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(async () => {
      const materials = await db.materialSummaries.toArray();
      const personalDocs = await db.personalDocuments.toArray();
      const materialItems: AnySummary[] = materials.map((m) => ({ kind: "material", ...m }));
      const personalItems: AnySummary[] = personalDocs
        .filter((d): d is typeof d & { summary: string } => Boolean(d.summary))
        .map((d) => ({
          kind: "personal",
          key: `personal:${d.id}`,
          docId: d.id,
          title: d.title,
          body: d.summary,
          generatedAt: d.updatedAt,
          method: d.summaryMethod,
          sections: d.summarySections,
        }));
      return [...materialItems, ...personalItems];
    }).subscribe({
      next: (rows) => setSummaries([...rows].sort((a, b) => b.generatedAt - a.generatedAt)),
      error: (err) => console.error("Failed to read summaries", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return summaries;
}

/** Real, if tiny, storage footprint of generated AI summaries — the text
 * bodies are the only thing actually stored per summary, so this is just
 * their combined byte size (via Blob, for an accurate UTF-8 byte count
 * rather than a UTF-16 code-unit approximation). */
export function useSummariesStorageMb(): number {
  const { user } = useAuth();
  const [mb, setMb] = useState(0);

  useEffect(() => {
    if (!user) {
      setMb(0);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.materialSummaries.toArray()).subscribe({
      next: (rows) => {
        const bytes = rows.reduce((sum, row) => sum + new Blob([row.body]).size, 0);
        setMb(bytes / (1024 * 1024));
      },
      error: (err) => console.error("Failed to compute summaries storage", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return mb;
}

export function useGenerateSummary() {
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const generateSummary = useCallback(
    async (
      materialId: string,
      moduleId: string,
      sourceText: string,
      fallbackTitle = "Overview",
    ) => {
      if (!user) return;
      const db = getUserDb(user.id);
      const key = materialKey(moduleId, materialId);
      setPendingIds((prev) => new Set(prev).add(key));
      try {
        // Splits the material into its own real sections and summarizes
        // each of them, so a long material's summary actually covers all
        // of it instead of only whatever fit in one model call — see
        // summarize-structured.ts for why this replaced a single
        // summarizeWithModel(sourceText) call.
        const { overview, sections, method } = await generateStructuredSummary(
          sourceText,
          fallbackTitle,
        );
        await db.materialSummaries.put({
          key,
          materialId,
          moduleId,
          body: overview,
          sections,
          generatedAt: Date.now(),
          method,
        });
        void logActivity(user.id, "summary");
      } catch (err) {
        // The neural-vs-extractive choice above already has its own
        // fallback (FR44) — reaching this means something else failed,
        // e.g. the IndexedDB write itself, after summarization succeeded.
        console.error("Failed to save summary", err);
        toast.error("Couldn't save the summary. Try again.");
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

  return { generateSummary, pendingIds };
}
