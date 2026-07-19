// Multi-device progress sync (FR68-73, FR77) — see DEV_LOG.md, Feature 23.
//
// Only "my progress" facts sync: read state, activity/streak history, and
// AI summaries. Downloads and their cached content stay device-local by
// design — each device should hold what it personally needs offline, not
// a synced copy of every device's cache (see 0004_progress_sync.sql).
//
// Conflict strategy is deliberately simple: every row has its own
// timestamp, so "newer wins" is well-defined without any real concurrent-
// edit conflict to resolve. Reconciliation happens here, client-side, not
// in the database — this is single-user data, not collaborative data.
import {
  getUserDb,
  materialKey,
  type ReadMaterial,
  type ActivityEvent,
  type MaterialSummary,
  type PersonalDocument,
  type DocumentCollection,
  type PendingDeletion,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

const REMOTE_TABLE_BY_ENTITY: Record<PendingDeletion["entityType"], string> = {
  personal_document: "personal_documents",
  document_collection: "document_collections",
};

/** Retries any delete that succeeded locally but hasn't been confirmed
 * removed from Supabase yet (see PendingDeletion's own comment for why
 * this exists) — most commonly a delete that was attempted while
 * offline. Must run *before* syncPersonalDocuments/syncDocumentCollections
 * so their own "remote has it, local doesn't" case can see which ids are
 * pending deletion and skip resurrecting them, rather than only fixing
 * the problem on some *later* sync after this one already pulled the
 * deleted row back down. */
async function syncPendingDeletions(userId: string): Promise<void> {
  const db = getUserDb(userId);
  const pending = await db.pendingDeletions.toArray();
  if (pending.length === 0) return;

  await Promise.all(
    pending.map(async (deletion) => {
      const { error } = await supabase
        .from(REMOTE_TABLE_BY_ENTITY[deletion.entityType])
        .delete()
        .eq("id", deletion.id);
      // A missing row (already deleted, e.g. by a previous successful
      // retry whose local cleanup didn't complete) is just as much a
      // success as an explicit delete — either way, the remote side no
      // longer has it, so the tombstone can be cleared.
      if (!error) {
        await db.pendingDeletions.delete(deletion.key);
      } else {
        console.error(`Retry-delete failed for ${deletion.key}`, error);
      }
    }),
  );
}

/** Ids currently pending deletion for one entity type — the personal-
 * documents/collections sync functions use this to keep a still-not-yet-
 * confirmed-deleted remote row from being pulled back down as if it were
 * new, in the same sync pass syncPendingDeletions just retried it in. */
async function pendingDeletionIds(
  userId: string,
  entityType: PendingDeletion["entityType"],
): Promise<Set<string>> {
  const rows = await getUserDb(userId)
    .pendingDeletions.where("entityType")
    .equals(entityType)
    .toArray();
  return new Set(rows.map((r) => r.id));
}

async function syncReadMaterials(userId: string): Promise<void> {
  const db = getUserDb(userId);
  const [localRows, { data: remoteRows, error }] = await Promise.all([
    db.readMaterials.toArray(),
    supabase.from("read_materials").select("*").eq("user_id", userId),
  ]);
  if (error) throw error;

  const localByKey = new Map(localRows.map((r) => [materialKey(r.moduleId, r.materialId), r]));
  const remoteByKey = new Map(
    (remoteRows ?? []).map((r) => [materialKey(r.module_id, r.material_id), r]),
  );
  const allKeys = new Set([...localByKey.keys(), ...remoteByKey.keys()]);

  const toWriteLocal: ReadMaterial[] = [];
  const toWriteRemote: typeof remoteRows = [];

  for (const key of allKeys) {
    const local = localByKey.get(key);
    const remote = remoteByKey.get(key);
    if (local && remote) {
      const localNewer = local.lastReadAt > toMs(remote.last_read_at);
      const remoteNewer = toMs(remote.last_read_at) > local.lastReadAt;
      const firstReadAt = Math.min(local.firstReadAt, toMs(remote.first_read_at));
      if (localNewer) {
        toWriteRemote!.push({
          user_id: userId,
          module_id: local.moduleId,
          material_id: local.materialId,
          first_read_at: toIso(firstReadAt),
          last_read_at: toIso(local.lastReadAt),
        });
      } else if (remoteNewer || firstReadAt !== local.firstReadAt) {
        toWriteLocal.push({
          key,
          moduleId: local.moduleId,
          materialId: local.materialId,
          firstReadAt,
          lastReadAt: Math.max(local.lastReadAt, toMs(remote.last_read_at)),
        });
      }
    } else if (local && !remote) {
      toWriteRemote!.push({
        user_id: userId,
        module_id: local.moduleId,
        material_id: local.materialId,
        first_read_at: toIso(local.firstReadAt),
        last_read_at: toIso(local.lastReadAt),
      });
    } else if (remote && !local) {
      toWriteLocal.push({
        key,
        moduleId: remote.module_id,
        materialId: remote.material_id,
        firstReadAt: toMs(remote.first_read_at),
        lastReadAt: toMs(remote.last_read_at),
      });
    }
  }

  if (toWriteLocal.length > 0) await db.readMaterials.bulkPut(toWriteLocal);
  if (toWriteRemote && toWriteRemote.length > 0) {
    const { error: upsertError } = await supabase
      .from("read_materials")
      .upsert(toWriteRemote, { onConflict: "user_id,module_id,material_id" });
    if (upsertError) throw upsertError;
  }
}

async function syncActivityEvents(userId: string): Promise<void> {
  const db = getUserDb(userId);
  const [localRows, { data: remoteRows, error }] = await Promise.all([
    db.activityEvents.toArray(),
    supabase.from("activity_events").select("*").eq("user_id", userId),
  ]);
  if (error) throw error;

  const localIds = new Set(localRows.map((r) => r.id));
  const remoteIds = new Set((remoteRows ?? []).map((r) => r.id));

  const toWriteLocal: ActivityEvent[] = (remoteRows ?? [])
    .filter((r) => !localIds.has(r.id))
    .map((r) => ({ id: r.id, type: r.type as ActivityEvent["type"], timestamp: toMs(r.event_at) }));

  const toWriteRemote = localRows
    .filter((r) => !remoteIds.has(r.id))
    .map((r) => ({ id: r.id, user_id: userId, type: r.type, event_at: toIso(r.timestamp) }));

  if (toWriteLocal.length > 0) await db.activityEvents.bulkPut(toWriteLocal);
  if (toWriteRemote.length > 0) {
    const { error: upsertError } = await supabase
      .from("activity_events")
      .upsert(toWriteRemote, { onConflict: "id" });
    if (upsertError) throw upsertError;
  }
}

async function syncMaterialSummaries(userId: string): Promise<void> {
  const db = getUserDb(userId);
  const [localRows, { data: remoteRows, error }] = await Promise.all([
    db.materialSummaries.toArray(),
    supabase.from("material_summaries").select("*").eq("user_id", userId),
  ]);
  if (error) throw error;

  const localByKey = new Map(localRows.map((r) => [materialKey(r.moduleId, r.materialId), r]));
  const remoteByKey = new Map(
    (remoteRows ?? []).map((r) => [materialKey(r.module_id, r.material_id), r]),
  );
  const allKeys = new Set([...localByKey.keys(), ...remoteByKey.keys()]);

  const toWriteLocal: MaterialSummary[] = [];
  const toWriteRemote: typeof remoteRows = [];

  for (const key of allKeys) {
    const local = localByKey.get(key);
    const remote = remoteByKey.get(key);
    if (local && remote) {
      if (local.generatedAt > toMs(remote.generated_at)) {
        toWriteRemote!.push({
          user_id: userId,
          module_id: local.moduleId,
          material_id: local.materialId,
          body: local.body,
          method: local.method ?? null,
          generated_at: toIso(local.generatedAt),
        });
      } else if (toMs(remote.generated_at) > local.generatedAt) {
        toWriteLocal.push({
          key,
          moduleId: local.moduleId,
          materialId: local.materialId,
          body: remote.body,
          method: (remote.method as MaterialSummary["method"]) ?? undefined,
          generatedAt: toMs(remote.generated_at),
        });
      }
    } else if (local && !remote) {
      toWriteRemote!.push({
        user_id: userId,
        module_id: local.moduleId,
        material_id: local.materialId,
        body: local.body,
        method: local.method ?? null,
        generated_at: toIso(local.generatedAt),
      });
    } else if (remote && !local) {
      toWriteLocal.push({
        key,
        moduleId: remote.module_id,
        materialId: remote.material_id,
        body: remote.body,
        method: (remote.method as MaterialSummary["method"]) ?? undefined,
        generatedAt: toMs(remote.generated_at),
      });
    }
  }

  if (toWriteLocal.length > 0) await db.materialSummaries.bulkPut(toWriteLocal);
  if (toWriteRemote && toWriteRemote.length > 0) {
    const { error: upsertError } = await supabase
      .from("material_summaries")
      .upsert(toWriteRemote, { onConflict: "user_id,module_id,material_id" });
    if (upsertError) throw upsertError;
  }
}

/** Deletion is handled directly by useDeletePersonalDocument (both stores,
 * immediately, recording a PendingDeletion if the remote side doesn't
 * confirm right away), not through this reconciliation. Everything else —
 * initial upload, and a later summary regeneration — is a single "newer
 * `updatedAt` wins" comparison per document id. */
async function syncPersonalDocuments(userId: string): Promise<void> {
  const db = getUserDb(userId);
  const [localRows, { data: remoteRows, error }, deletingIds] = await Promise.all([
    db.personalDocuments.toArray(),
    supabase.from("personal_documents").select("*").eq("user_id", userId),
    pendingDeletionIds(userId, "personal_document"),
  ]);
  if (error) throw error;

  const localById = new Map(localRows.map((r) => [r.id, r]));
  const remoteById = new Map((remoteRows ?? []).map((r) => [r.id, r]));
  const allIds = new Set([...localById.keys(), ...remoteById.keys()]);

  const toWriteLocal: PersonalDocument[] = [];
  const toWriteRemote: typeof remoteRows = [];

  for (const id of allIds) {
    // A row still sitting in `remoteById` here means syncPendingDeletions'
    // retry (this same sync pass, run first in syncProgress) hasn't
    // actually succeeded yet — likely still offline. Skip it entirely
    // rather than either pulling it back locally or re-pushing it, since
    // both would undo the delete this device already made.
    if (deletingIds.has(id)) continue;
    const local = localById.get(id);
    const remote = remoteById.get(id);
    if (local && remote) {
      if (local.updatedAt > toMs(remote.updated_at)) {
        toWriteRemote!.push(toRemoteRow(userId, local));
      } else if (toMs(remote.updated_at) > local.updatedAt) {
        toWriteLocal.push(toLocalRow(remote));
      }
    } else if (local && !remote) {
      toWriteRemote!.push(toRemoteRow(userId, local));
    } else if (remote && !local) {
      toWriteLocal.push(toLocalRow(remote));
    }
  }

  if (toWriteLocal.length > 0) await db.personalDocuments.bulkPut(toWriteLocal);
  if (toWriteRemote && toWriteRemote.length > 0) {
    const { error: upsertError } = await supabase
      .from("personal_documents")
      .upsert(toWriteRemote, { onConflict: "id" });
    if (upsertError) throw upsertError;
  }
}

function toRemoteRow(userId: string, doc: PersonalDocument) {
  return {
    id: doc.id,
    user_id: userId,
    title: doc.title,
    page_count: doc.pageCount,
    size_mb: doc.sizeMb,
    extracted_text: doc.text,
    uploaded_at: toIso(doc.uploadedAt),
    updated_at: toIso(doc.updatedAt),
    summary: doc.summary ?? null,
    summary_method: doc.summaryMethod ?? null,
    collection_id: doc.collectionId ?? null,
  };
}

function toLocalRow(row: {
  id: string;
  title: string;
  page_count: number;
  size_mb: number;
  extracted_text: string;
  uploaded_at: string;
  updated_at: string;
  summary: string | null;
  summary_method: string | null;
  collection_id: string | null;
}): PersonalDocument {
  return {
    id: row.id,
    title: row.title,
    pageCount: row.page_count,
    sizeMb: row.size_mb,
    text: row.extracted_text,
    uploadedAt: toMs(row.uploaded_at),
    updatedAt: toMs(row.updated_at),
    summary: row.summary ?? undefined,
    summaryMethod: (row.summary_method as PersonalDocument["summaryMethod"]) ?? undefined,
    collectionId: row.collection_id ?? undefined,
  };
}

/** Deletion is handled directly by useDeleteCollection (both stores,
 * immediately, plus clearing collectionId on any of the user's local
 * documents that referenced it, recording a PendingDeletion if the
 * remote side doesn't confirm right away) — same approach as
 * syncPersonalDocuments above. */
async function syncDocumentCollections(userId: string): Promise<void> {
  const db = getUserDb(userId);
  const [localRows, { data: remoteRows, error }, deletingIds] = await Promise.all([
    db.documentCollections.toArray(),
    supabase.from("document_collections").select("*").eq("user_id", userId),
    pendingDeletionIds(userId, "document_collection"),
  ]);
  if (error) throw error;

  const localById = new Map(localRows.map((r) => [r.id, r]));
  const remoteById = new Map((remoteRows ?? []).map((r) => [r.id, r]));
  const allIds = new Set([...localById.keys(), ...remoteById.keys()]);

  const toWriteLocal: DocumentCollection[] = [];
  const toWriteRemote: typeof remoteRows = [];

  for (const id of allIds) {
    if (deletingIds.has(id)) continue;
    const local = localById.get(id);
    const remote = remoteById.get(id);
    if (local && remote) {
      if (local.updatedAt > toMs(remote.updated_at)) {
        toWriteRemote!.push(toRemoteCollectionRow(userId, local));
      } else if (toMs(remote.updated_at) > local.updatedAt) {
        toWriteLocal.push(toLocalCollectionRow(remote));
      }
    } else if (local && !remote) {
      toWriteRemote!.push(toRemoteCollectionRow(userId, local));
    } else if (remote && !local) {
      toWriteLocal.push(toLocalCollectionRow(remote));
    }
  }

  if (toWriteLocal.length > 0) await db.documentCollections.bulkPut(toWriteLocal);
  if (toWriteRemote && toWriteRemote.length > 0) {
    const { error: upsertError } = await supabase
      .from("document_collections")
      .upsert(toWriteRemote, { onConflict: "id" });
    if (upsertError) throw upsertError;
  }
}

function toRemoteCollectionRow(userId: string, collection: DocumentCollection) {
  return {
    id: collection.id,
    user_id: userId,
    name: collection.name,
    created_at: toIso(collection.createdAt),
    updated_at: toIso(collection.updatedAt),
  };
}

function toLocalCollectionRow(row: {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}): DocumentCollection {
  return {
    id: row.id,
    name: row.name,
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
  };
}

const LAST_SYNCED_KEY = "lastSyncedAt";

/** Pulls and pushes read state, activity history, and AI summaries against
 * Supabase, reconciling with local IndexedDB. Safe to call opportunistically
 * (sign-in, reconnect, a manual "Sync now") — each run is a full
 * pull-merge-push, not an incremental diff, since the data involved per
 * user is a few KB at most. */
export async function syncProgress(userId: string): Promise<void> {
  // Collections first, awaited on its own: personal_documents.collection_id
  // is a real foreign key (0007_document_collections.sql), so pushing a
  // locally-new document that references a locally-new collection would
  // violate it if that collection hasn't landed remotely yet — which
  // Promise.all here can't guarantee ordering-wise. Caught locally (not
  // left to throw) so a failure here — e.g. migration 0007 not applied
  // yet — can't block the four unrelated syncs below, which have nothing
  // to do with collections and worked fine before this feature existed.
  // Retry any offline-failed deletes before either of the two syncs below
  // reads the current pending-deletion ids — otherwise a delete retried
  // successfully in this exact call would still get read as "still
  // pending" by syncPersonalDocuments/syncDocumentCollections, since
  // pendingDeletionIds() would have already been queried in parallel.
  // Caught locally, same reasoning as the collections sync below: a
  // retry failure (most likely just "still offline") must not block the
  // unrelated syncs that follow.
  try {
    await syncPendingDeletions(userId);
  } catch (err) {
    console.error("Failed to retry pending deletions", err);
  }
  try {
    await syncDocumentCollections(userId);
  } catch (err) {
    console.error("Failed to sync document collections", err);
  }
  await Promise.all([
    syncReadMaterials(userId),
    syncActivityEvents(userId),
    syncMaterialSummaries(userId),
    syncPersonalDocuments(userId),
  ]);
  await getUserDb(userId).syncMeta.put({ key: LAST_SYNCED_KEY, value: String(Date.now()) });
}

export async function getLastSyncedAt(userId: string): Promise<number | undefined> {
  const row = await getUserDb(userId).syncMeta.get(LAST_SYNCED_KEY);
  return row ? Number(row.value) : undefined;
}
