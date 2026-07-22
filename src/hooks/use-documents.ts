import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import {
  getUserDb,
  type PersonalDocument,
  type PersonalDocumentFile,
  type DocumentCollection,
} from "@/lib/db";
import { extractPdfText, PdfExtractionError, type ExtractProgress } from "@/lib/pdf-extract";
import { generateStructuredSummary } from "@/lib/summarize-structured";
import { generateViaCloud, CloudUnavailableError } from "@/lib/ai-cloud";
import { logActivity } from "@/hooks/use-activity";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { withViewTransition } from "@/lib/utils";

const MAX_UPLOAD_MB = 25;

/** Every personal document the signed-in user has uploaded, newest first. */
export function usePersonalDocuments(): PersonalDocument[] {
  const { user } = useAuth();
  const [docs, setDocs] = useState<PersonalDocument[]>([]);

  useEffect(() => {
    if (!user) {
      setDocs([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.personalDocuments.toArray()).subscribe({
      // withViewTransition: a document appearing after upload or vanishing
      // after delete should cross-fade the list, not pop.
      next: (rows) =>
        withViewTransition(() => setDocs([...rows].sort((a, b) => b.uploadedAt - a.uploadedAt))),
      error: (err) => console.error("Failed to read personal documents", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return docs;
}

export function usePersonalDocument(id: string): PersonalDocument | undefined {
  const { user } = useAuth();
  const [doc, setDoc] = useState<PersonalDocument | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setDoc(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.personalDocuments.get(id)).subscribe({
      next: setDoc,
      error: (err) => console.error("Failed to read personal document", err),
    });
    return () => sub.unsubscribe();
  }, [user, id]);

  return doc;
}

/** The original uploaded file for one personal document, if it was stored
 * successfully at upload time — see PersonalDocumentFile's own comment.
 * `undefined` while loading; stays `undefined` (not an error) for a
 * document uploaded before this existed, or whose file failed to store
 * (e.g. a storage-quota error at upload time — the extracted text still
 * saved fine, just not the extra original-file copy). */
export function usePersonalDocumentFile(docId: string): PersonalDocumentFile | undefined {
  const { user } = useAuth();
  const [file, setFile] = useState<PersonalDocumentFile | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setFile(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.personalDocumentFiles.get(docId)).subscribe({
      next: setFile,
      error: (err) => console.error("Failed to read personal document file", err),
    });
    return () => sub.unsubscribe();
  }, [user, docId]);

  return file;
}

/** Real scroll-based reading progress for a student's own uploaded PDF —
 * same reasoning and "furthest point wins" logic as
 * updateMaterialReadProgress (use-activity.ts), for the personal-document
 * side of the library instead of the catalog side. */
export async function updateDocumentReadProgress(
  userId: string,
  docId: string,
  pct: number,
): Promise<void> {
  try {
    const db = getUserDb(userId);
    const existing = await db.personalDocuments.get(docId);
    if (!existing) return;
    await db.personalDocuments.update(docId, {
      readProgressPct: Math.max(existing.readProgressPct ?? 0, Math.round(pct)),
    });
  } catch (err) {
    console.error("Failed to record document reading progress", err);
  }
}

export type UploadStatus = "idle" | "extracting" | "error";

/** Real client-side PDF upload + extraction (FR22-26). Rejects oversized
 * files before even trying to parse them (a generous cap — this is
 * text extraction, not a document archive) and surfaces pdf.js's real
 * failure modes (password-protected, invalid, or no extractable text)
 * with an actionable message instead of a generic failure. */
export function useUploadDocument() {
  const { user } = useAuth();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState<ExtractProgress | null>(null);

  const upload = useCallback(
    async (file: File, collectionId?: string) => {
      if (!user) return;
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > MAX_UPLOAD_MB) {
        toast.error(
          `That PDF is too large (${sizeMb.toFixed(1)} MB) — the limit is ${MAX_UPLOAD_MB} MB.`,
        );
        return;
      }
      setStatus("extracting");
      setProgress(null);
      try {
        const { text, pageCount } = await extractPdfText(file, setProgress);
        const now = Date.now();
        const doc: PersonalDocument = {
          id: crypto.randomUUID(),
          title: file.name.replace(/\.pdf$/i, ""),
          pageCount,
          sizeMb,
          text,
          uploadedAt: now,
          updatedAt: now,
          collectionId,
        };
        const db = getUserDb(user.id);
        await db.personalDocuments.put(doc);
        // Best-effort, in its own try/catch: a storage-quota failure
        // storing the (larger) original file shouldn't undo an upload
        // whose text extraction already succeeded — the document still
        // saves and is fully usable, just without a "download original"
        // option until the student frees up some space and re-uploads.
        try {
          await db.personalDocumentFiles.put({
            docId: doc.id,
            blob: file,
            fileName: file.name,
            mimeType: file.type || "application/pdf",
            sizeMb,
            storedAt: now,
          });
        } catch (err) {
          console.error("Failed to store original PDF file", err);
        }
        void logActivity(user.id, "download");
        setStatus("idle");
        return doc;
      } catch (err) {
        console.error("Failed to extract PDF", err);
        const message =
          err instanceof PdfExtractionError
            ? err.message
            : "Couldn't process this PDF. Try a different file.";
        toast.error(message);
        setStatus("error");
      } finally {
        setProgress(null);
      }
    },
    [user],
  );

  return { upload, status, progress };
}

export function useDeletePersonalDocument() {
  const { user } = useAuth();

  const deleteDocument = useCallback(
    async (id: string) => {
      if (!user) return;
      const db = getUserDb(user.id);
      await db.personalDocuments.delete(id);
      // The original file lives in its own table (see
      // PersonalDocumentFile) — without this it would sit around forever,
      // orphaned, since nothing else ever reads or cleans it up once its
      // document row is gone.
      await db.personalDocumentFiles.delete(id);
      // Recorded *before* attempting the remote delete, and regardless of
      // whether it succeeds — this is what fixes the real gap Feature 26
      // flagged: without it, a delete that fails remotely (offline, most
      // commonly) leaves nothing behind to distinguish "I deleted this"
      // from "I never had this," and the next sync's "local doesn't have
      // it, remote does" case reads as a genuinely new document from
      // another device, resurrecting the very thing just deleted. See
      // syncPendingDeletions in sync.ts, which retries this and clears
      // the row once the remote side actually confirms it's gone.
      await db.pendingDeletions.put({
        key: `personal_document::${id}`,
        id,
        entityType: "personal_document",
        deletedAt: Date.now(),
      });
      const { error } = await supabase.from("personal_documents").delete().eq("id", id);
      if (error) {
        console.error("Failed to remove document from other devices", error);
        toast.error(
          "Removed here — will finish removing it from your other devices once back online.",
        );
      } else {
        await db.pendingDeletions.delete(`personal_document::${id}`);
      }
    },
    [user],
  );

  return { deleteDocument };
}

export function useGenerateDocumentSummary() {
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const generateSummary = useCallback(
    async (docId: string, sourceText: string) => {
      if (!user) return;
      const db = getUserDb(user.id);
      setPendingIds((prev) => new Set(prev).add(docId));
      try {
        const existing = await db.personalDocuments.get(docId);
        if (!existing) return;
        // See summarize-structured.ts — splits the document into its own
        // real sections and summarizes each of them, so a long upload's
        // summary actually covers all of it instead of only the first
        // ~3000 characters a single model call could fit.
        const { overview, sections, method } = await generateStructuredSummary(
          sourceText,
          existing.title,
          user.id,
        );
        await db.personalDocuments.put({
          ...existing,
          summary: overview,
          summaryMethod: method,
          summarySections: sections,
          updatedAt: Date.now(),
        });
        void logActivity(user.id, "summary");
      } catch (err) {
        console.error("Failed to save document summary", err);
        toast.error("Couldn't save the summary. Try again.");
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
      }
    },
    [user],
  );

  return { generateSummary, pendingIds };
}

// Cloud models handle far more context per call than the on-device
// pipeline's own chunk budgets — see ai-cloud.ts/summarize-structured.ts's
// own identical constant and comment.
const NOTES_CLOUD_SOURCE_CHARS = 12_000;

/** AI study notes for a personal document — cloud-only (see ai-cloud.ts
 * and db.ts's own comment on PersonalDocument.aiNotes for why there's no
 * on-device fallback for this one). Callers should gate the UI that
 * triggers this behind hasCloudKey() rather than relying solely on the
 * CloudUnavailableError thrown here, so a student without a connected key
 * sees an honest "connect a free key" prompt instead of a "generate"
 * button that always fails. */
export function useGenerateNotes() {
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const generateNotes = useCallback(
    async (docId: string, sourceText: string) => {
      if (!user) return;
      const db = getUserDb(user.id);
      setPendingIds((prev) => new Set(prev).add(docId));
      try {
        const existing = await db.personalDocuments.get(docId);
        if (!existing) return;
        const notes = await generateViaCloud(
          "notes",
          sourceText.slice(0, NOTES_CLOUD_SOURCE_CHARS),
          user.id,
        );
        await db.personalDocuments.put({
          ...existing,
          aiNotes: notes,
          aiNotesGeneratedAt: Date.now(),
          updatedAt: Date.now(),
        });
        void logActivity(user.id, "summary");
      } catch (err) {
        if (err instanceof CloudUnavailableError) {
          toast.error("AI notes need a connected free cloud AI key and an internet connection.");
        } else {
          console.error("Failed to generate AI notes", err);
          toast.error("Couldn't generate notes. Try again.");
        }
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
      }
    },
    [user],
  );

  return { generateNotes, pendingIds };
}

/** Every collection the signed-in user has created (the "library
 * planner" — Feature 33), alphabetical — a planner's own contents should
 * be predictably ordered, not "most recently touched," which shuffles
 * around as documents are added/removed. */
export function useDocumentCollections(): DocumentCollection[] {
  const { user } = useAuth();
  const [collections, setCollections] = useState<DocumentCollection[]>([]);

  useEffect(() => {
    if (!user) {
      setCollections([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.documentCollections.toArray()).subscribe({
      next: (rows) =>
        withViewTransition(() =>
          setCollections([...rows].sort((a, b) => a.name.localeCompare(b.name))),
        ),
      error: (err) => console.error("Failed to read document collections", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return collections;
}

export function useDocumentCollection(id: string): DocumentCollection | undefined {
  const { user } = useAuth();
  const [collection, setCollection] = useState<DocumentCollection | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setCollection(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.documentCollections.get(id)).subscribe({
      next: setCollection,
      error: (err) => console.error("Failed to read document collection", err),
    });
    return () => sub.unsubscribe();
  }, [user, id]);

  return collection;
}

export function useCreateCollection() {
  const { user } = useAuth();

  const createCollection = useCallback(
    async (name: string) => {
      if (!user) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const now = Date.now();
      const collection: DocumentCollection = {
        id: crypto.randomUUID(),
        name: trimmed,
        createdAt: now,
        updatedAt: now,
      };
      await getUserDb(user.id).documentCollections.put(collection);
      return collection;
    },
    [user],
  );

  return { createCollection };
}

/** Deliberately deferred out of Feature 33's first pass ("get the name
 * right at creation time; delete-and-recreate is an acceptable v1
 * workaround") — a real gap once a collection accumulates real documents,
 * since delete-and-recreate would mean re-filing every one of them by
 * hand. Bumps `updatedAt` so sync's existing "newer wins" reconciliation
 * (syncDocumentCollections) picks up the rename with no new logic needed
 * there. */
export function useRenameCollection() {
  const { user } = useAuth();

  const renameCollection = useCallback(
    async (id: string, name: string) => {
      if (!user) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const db = getUserDb(user.id);
      const existing = await db.documentCollections.get(id);
      if (!existing) return;
      await db.documentCollections.put({ ...existing, name: trimmed, updatedAt: Date.now() });
    },
    [user],
  );

  return { renameCollection };
}

export function useDeleteCollection() {
  const { user } = useAuth();

  const deleteCollection = useCallback(
    async (id: string) => {
      if (!user) return;
      const db = getUserDb(user.id);
      // Deleting a collection un-files its documents — it never deletes
      // them. Losing a folder you made shouldn't lose the PDFs inside it.
      const now = Date.now();
      await db.transaction("rw", db.documentCollections, db.personalDocuments, async () => {
        await db.documentCollections.delete(id);
        const members = await db.personalDocuments.where("collectionId").equals(id).toArray();
        await db.personalDocuments.bulkPut(
          members.map((doc) => ({ ...doc, collectionId: undefined, updatedAt: now })),
        );
      });
      // Recorded regardless of whether the remote delete below succeeds —
      // see useDeletePersonalDocument's identical comment and
      // syncPendingDeletions in sync.ts for why this is what actually
      // stops a failed (e.g. offline) remote delete from getting the
      // collection resurrected by a later sync. The FK is ON DELETE SET
      // NULL, so even if a stale remote document row still points at this
      // id briefly, it self-heals rather than orphaning.
      await db.pendingDeletions.put({
        key: `document_collection::${id}`,
        id,
        entityType: "document_collection",
        deletedAt: Date.now(),
      });
      const { error } = await supabase.from("document_collections").delete().eq("id", id);
      if (error) {
        console.error("Failed to remove collection from other devices", error);
        toast.error(
          "Removed here — will finish removing it from your other devices once back online.",
        );
      } else {
        await db.pendingDeletions.delete(`document_collection::${id}`);
      }
    },
    [user],
  );

  return { deleteCollection };
}

/** Moves a document into a collection, or out of one entirely when
 * `collectionId` is undefined. A document belongs to at most one
 * collection, so moving it into a new one implicitly removes it from
 * whichever it was in before — there's nothing else to clean up. */
export function useSetDocumentCollection() {
  const { user } = useAuth();

  const setDocumentCollection = useCallback(
    async (docId: string, collectionId: string | undefined) => {
      if (!user) return;
      const db = getUserDb(user.id);
      const existing = await db.personalDocuments.get(docId);
      if (!existing) return;
      await db.personalDocuments.put({ ...existing, collectionId, updatedAt: Date.now() });
    },
    [user],
  );

  return { setDocumentCollection };
}
