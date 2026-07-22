import Dexie, { type EntityTable } from "dexie";
import type { MaterialContent } from "@/lib/supabase";
import type { Flashcard, QuizQuestion } from "@/lib/quiz-gen";

/**
 * Material `id`s (e.g. "m1") are only unique *within* a module's own
 * materials array — every module reuses the same short ids. Any table
 * keyed by a bare materialId will silently collide across modules (e.g.
 * sen-301's "m1" and eco-220's "m1" would be treated as the same record).
 * All per-material tables below use this composite key instead.
 */
export function materialKey(moduleId: string, materialId: string): string {
  return `${moduleId}::${materialId}`;
}

export type DownloadedModule = {
  moduleId: string;
  downloadedAt: number;
  sizeMb: number;
};

export type DownloadedMaterial = {
  key: string;
  materialId: string;
  moduleId: string;
  downloadedAt: number;
  sizeMb: number;
  // The material's real content, cached at download time so the reader can
  // render it fully offline — not just know that a download "happened".
  // Optional: rows written before this field existed, or materials
  // downloaded as part of a module cascade before content was fetched,
  // may not have it (handled gracefully by the reader).
  content?: MaterialContent;
  // The material's kind ("reading" | "slides" | "handout" | "notes" — see
  // supabase/migrations/0001_init.sql), cached at download time so the
  // Profile storage breakdown can be computed from IndexedDB alone, no
  // network needed. Optional: rows written before this field existed.
  kind?: string;
};

/** One real section of a structured, multi-part summary — one per real
 * heading in the source document (see summarize-structured.ts), so a long
 * document's summary actually covers all of it instead of only whatever
 * fit in the model's single-call input limit. */
export type SummarySection = {
  heading: string;
  body: string;
  // Real bullets lifted straight from this section of the source document
  // (see summarize-structured.ts's splitIntoSections) — not AI-paraphrased,
  // since a small summarizer model reliably produces only plain prose, not
  // markup, and asking it to invent a bullet list risks the same corrupted-
  // output failure mode already found for raw tables/bullets elsewhere in
  // this app. Optional: sections generated before this existed, or with no
  // real bullets in their source, still render correctly without it.
  keyPoints?: string[];
};

/** A unified feed item for the Summaries page — see Feature 54. Before
 * this, `useAllSummaries()` only read `materialSummaries` (catalog
 * content), so a summary generated for a student's own uploaded/extracted
 * PDF (`PersonalDocument.summary`) never appeared there even though it's
 * exactly the same kind of AI output. `kind` distinguishes the two
 * because they route to different reader pages and have no shared
 * `moduleId`/`materialId` to key on. */
export type AnySummary =
  | ({ kind: "material" } & MaterialSummary)
  | {
      kind: "personal";
      key: string;
      docId: string;
      title: string;
      body: string;
      generatedAt: number;
      method?: "neural" | "extractive" | "cloud";
      sections?: SummarySection[];
    };

export type MaterialSummary = {
  key: string;
  materialId: string;
  moduleId: string;
  // The short, whole-document "at a glance" summary — a summary of the
  // section summaries below, not a separate first pass over the raw text.
  body: string;
  generatedAt: number;
  // Which summarizer actually produced this text — surfaced in the reader
  // so "on-device" isn't a vague claim. Optional: rows written before the
  // neural model existed are implicitly "extractive".
  method?: "neural" | "extractive" | "cloud";
  // Per-section breakdown covering the whole document — see
  // src/lib/summarize-structured.ts. Optional: summaries generated before
  // this existed only have `body`, and still render correctly with it.
  sections?: SummarySection[];
};

export type ActivityType = "download" | "read" | "summary";

export type ActivityEvent = {
  // A client-generated UUID, not an auto-increment counter — this is the
  // event's stable identity across devices (see Feature 23's sync layer),
  // so pushing the same event twice (e.g. a retried sync) upserts onto
  // itself instead of duplicating.
  id: string;
  type: ActivityType;
  timestamp: number;
};

export type ReadMaterial = {
  key: string;
  materialId: string;
  moduleId: string;
  firstReadAt: number;
  lastReadAt: number;
  // Furthest fraction of the material actually scrolled through, 0-100 —
  // replaces the reader's old fake "Page N of M" counter, which didn't
  // correspond to any real pagination of the content (see DEV_LOG.md).
  // Optional: rows written before this existed just read as 0/undecided,
  // not incorrectly "fully read".
  progressPct?: number;
};

export type AppSetting = {
  key: string;
  value: string;
};

/** A student's own uploaded PDF, extracted client-side (see
 * src/lib/pdf-extract.ts) — distinct from the shared `materials` catalog,
 * which stays lecturer/seed content. See DEV_LOG.md, Feature 26.
 *
 * Not fully immutable after upload: the summary can be (re)generated
 * later, same as a material's summary. `updatedAt` bumps on upload *and*
 * on every summary regeneration, so sync can do a single "newer wins" by
 * `updatedAt`, rather than tracking upload-time and summary-time
 * separately. */
export type PersonalDocument = {
  // Client-generated UUID — this document's stable identity across
  // devices, same reasoning as ActivityEvent.id.
  id: string;
  title: string;
  pageCount: number;
  sizeMb: number;
  text: string;
  uploadedAt: number;
  updatedAt: number;
  summary?: string;
  summaryMethod?: "neural" | "extractive" | "cloud";
  // Per-section summary breakdown — see MaterialSummary.sections.
  summarySections?: SummarySection[];
  // AI-generated study notes (see ai-cloud.ts, src/routes/documents.$docId.notes.tsx)
  // — a distinct feature from the summary above, not just a renamed one:
  // free-form, revision-oriented markdown text written specifically to be
  // read as notes, not a condensed overview. Cloud-only — there's no
  // on-device equivalent (see DEV_LOG.md's own conclusion that a
  // meaningfully more capable on-device model isn't worth its real
  // multi-minute generation cost), so this stays undefined for a student
  // who hasn't connected a free cloud AI key.
  aiNotes?: string;
  aiNotesGeneratedAt?: number;
  // Same real scroll-based tracking as ReadMaterial.progressPct, for a
  // student's own uploaded PDF rather than a catalog material.
  readProgressPct?: number;
  // Which DocumentCollection this document belongs to, if any — see
  // Feature 33. A document belongs to at most one collection (a simple
  // nullable reference, not many-to-many): matches how the feature was
  // actually described ("add a module and all the documents related to
  // it"), and a many-to-many join table would be unused complexity for a
  // shape nobody asked for. `undefined` means uncategorized, same
  // "optional field, older/untouched rows just don't have it" pattern as
  // `summary` above.
  collectionId?: string;
};

/** The original uploaded PDF file, kept as-is so a student can download it
 * back unchanged — separate from `PersonalDocument`, whose own list-view
 * query (`usePersonalDocuments`) shouldn't have to load every document's
 * raw bytes just to render a list of titles. Device-local only, same
 * reasoning as `AssistantMessage`/`CollectionMessage`: this is a fact
 * about what this device has stored, not (yet) something that follows the
 * student across devices — see DEV_LOG.md for why cross-device sync was
 * deliberately left for a later pass rather than built here. */
export type PersonalDocumentFile = {
  docId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeMb: number;
  storedAt: number;
};

/** One turn in the general "Ask AI" assistant's conversation (see
 * DEV_LOG.md, Feature 34) — device-local only, deliberately not synced.
 * Same reasoning as `downloadedMaterials` staying device-local: a chat
 * history is tied to what this specific device's on-device model
 * actually said, not a fact about the student's account that should
 * follow them everywhere. Keeping it local also avoids a migration for
 * this pass, same tradeoff line as Feature 26 drew for the original PDF
 * file itself. */
export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

/** One turn in a collection-scoped conversation — "communicate with and
 * extract info from all documents in a library" (Phase I2, see
 * DEV_LOG.md). Distinct from `AssistantMessage`: that's one general
 * thread per account; this is one thread *per collection*, since the
 * whole point is grounding answers in that specific collection's
 * documents (see src/lib/retrieval.ts) rather than a general chat.
 * Device-local only, same reasoning as `AssistantMessage`. */
export type CollectionMessage = {
  // Composite `${collectionId}::${id}` — same collision-avoidance
  // reasoning as materialKey: a bare auto-id table with a `collectionId`
  // index would still work, but a composite primary key makes "delete
  // this collection's messages" and "read this collection's thread" both
  // simple, unambiguous key-range operations rather than relying on the
  // index staying correct.
  key: string;
  id: string;
  collectionId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

/** A delete that happened locally but hasn't been confirmed removed from
 * Supabase yet — most commonly because the device was offline at the
 * time (see DEV_LOG.md, Feature 26's "delete-while-offline" gap). Without
 * this, the local row is simply gone and the *remote* row is all that's
 * left; the next sync's "local doesn't have it, remote does" case reads
 * as "a genuinely new document from another device" and pulls the
 * supposedly-deleted item right back. Recording the deletion itself lets
 * sync retry the remote delete instead of resurrecting it, and stops
 * once the retry actually succeeds (see syncPendingDeletions in sync.ts). */
export type PendingDeletion = {
  key: string;
  id: string;
  entityType: "personal_document" | "document_collection";
  deletedAt: number;
};

/** A generated flashcard deck for one personal document (Phase J, see
 * DEV_LOG.md) — extractive, not AI-generated (see quiz-gen.ts), so this is
 * regenerable at zero cost and doesn't need the chat model downloaded.
 * One row per document, replaced wholesale on regenerate, same "latest
 * generated result" pattern as MaterialSummary. */
export type GeneratedFlashcardSet = {
  docId: string;
  cards: Flashcard[];
  generatedAt: number;
  // Which path actually produced these cards — "cloud" only when the
  // student's own BYOK Gemini key (see ai-cloud.ts) was used; absent for
  // every row written before this existed, which were always extractive.
  // A plain optional property, not a new indexed field, so this needs no
  // Dexie schema version bump.
  method?: "cloud" | "extractive";
};

/** A generated multiple-choice quiz for one personal document (Phase J).
 * Unlike flashcards, this genuinely needs either the on-device chat model
 * or the cloud path (see quiz-gen.ts / ai-cloud.ts) — plausible wrong
 * answers can't be extracted, only generated. One row per document,
 * replaced wholesale on regenerate. */
export type GeneratedQuiz = {
  docId: string;
  questions: QuizQuestion[];
  generatedAt: number;
  // Same purpose as GeneratedFlashcardSet.method above.
  method?: "cloud" | "on-device";
};

/** One submitted attempt at a GeneratedQuiz — kept as a full history (not
 * overwritten on retake) so "how did I do on this quiz" survives a retake
 * and, later, could back a real progress view. Device-local like every
 * other AI-generated table here (see GeneratedQuiz), so recording an
 * attempt while offline needs nothing beyond IndexedDB already being
 * available — no network round trip on submit. `docId` matches whichever
 * GeneratedQuiz it was an attempt at (same overloaded id space — see that
 * type's own callers). */
export type QuizAttempt = {
  id: string;
  docId: string;
  score: number;
  total: number;
  answers: Record<number, number>;
  submittedAt: number;
};

/** A student's real NUST eLearning (Moodle) course — pulled down from the
 * moodle_courses Supabase table (written server-side by the background
 * sync job, see moodle-cron-handler.ts), read-only offline cache, same
 * "cache, not source of truth" role every other synced table here plays. */
export type MoodleCourse = {
  id: number;
  fullName: string;
  shortName: string;
  summary?: string;
  courseImage?: string;
  lecturerName?: string;
  lastSyncedAt: number;
};

export type MoodleCourseSection = {
  key: string;
  courseId: number;
  sectionId: number;
  name?: string;
  position: number;
  summary?: string;
};

export type MoodleCourseModule = {
  key: string;
  courseId: number;
  sectionId: number;
  moduleId: number;
  name: string;
  modname: string;
  url?: string;
  contents?: unknown;
};

export type MoodleGrade = {
  key: string;
  courseId: number;
  itemName: string;
  itemType?: string;
  gradeRaw?: number;
  gradeFormatted?: string;
  gradeMax?: number;
  weight?: number;
  feedback?: string;
};

/** A student-created folder for organizing their own personal documents —
 * "the library planner" (see DEV_LOG.md, Feature 33). Deliberately scoped
 * to personal documents only, not the shared catalog — confirmed with the
 * user before building, same as Feature 26's upload-scope question. */
export type DocumentCollection = {
  // Client-generated UUID, same reasoning as PersonalDocument.id.
  id: string;
  name: string;
  createdAt: number;
  // Bumps whenever the collection is renamed — not when a document is
  // added/removed from it (that's a write to the *document's* row, via
  // its own `collectionId` + `updatedAt`), so sync only has one thing to
  // reconcile per entity, same principle as PersonalDocument.updatedAt.
  updatedAt: number;
};

// A single well-known row (key: "lastSyncedAt") tracking when this device
// last successfully reconciled with the server — per-user (lives in
// UserDB, not deviceDb), since two accounts on one device each have their
// own sync history.
export type SyncMeta = {
  key: string;
  value: string;
};

/** A cached copy of one catalog module (course content — the shared,
 * lecturer/seed data from `modules-api.ts`, not a student's own personal
 * document). Device-wide, not per-user: the catalog is the same for every
 * student, so there's no reason to duplicate it per account the way
 * downloads/summaries/activity are. See Feature 30 — this exists purely so
 * a module a student already looked at (downloaded or not) can still
 * *open* while offline; it is not a substitute for `downloadedMaterials`,
 * which is what makes a material's content actually readable offline. */
export type CachedCatalogModule = {
  id: string;
  cachedAt: number;
  // The full Module shape from modules-api.ts, stored as-is rather than
  // duplicating its field list here — this table is a cache, not a second
  // source of truth, and re-declaring every field would just be another
  // place for the two to drift out of sync.
  data: unknown;
};

/**
 * Device-wide settings — deliberately *not* scoped to any signed-in
 * account. Currently just whether the neural summarization model has
 * finished downloading: the model weights live in the browser's Cache
 * Storage regardless of who's logged in, so tying that flag to a
 * particular user would be both wrong (it's a fact about the device, not
 * the person) and wasteful (would force a re-download per account).
 */
class DeviceDB extends Dexie {
  appSettings!: EntityTable<AppSetting, "key">;
  catalogModules!: EntityTable<CachedCatalogModule, "id">;

  constructor() {
    super("elearn_device");
    this.version(1).stores({
      appSettings: "key",
    });
    this.version(2).stores({
      catalogModules: "id",
    });
  }
}

export const deviceDb = new DeviceDB();

/**
 * Per-account offline data — downloads, AI summaries, activity/streak
 * history, and read state. Each signed-in user gets a genuinely separate
 * IndexedDB database (named after their user id), not just filtered rows
 * in a shared one, so there's no code path by which one account's
 * downloads or reading history could leak into another's on a shared
 * device. See DEV_LOG.md, Feature 15.
 */
class UserDB extends Dexie {
  downloadedModules!: EntityTable<DownloadedModule, "moduleId">;
  downloadedMaterials!: EntityTable<DownloadedMaterial, "key">;
  materialSummaries!: EntityTable<MaterialSummary, "key">;
  activityEvents!: EntityTable<ActivityEvent, "id">;
  readMaterials!: EntityTable<ReadMaterial, "key">;
  syncMeta!: EntityTable<SyncMeta, "key">;
  personalDocuments!: EntityTable<PersonalDocument, "id">;
  personalDocumentFiles!: EntityTable<PersonalDocumentFile, "docId">;
  documentCollections!: EntityTable<DocumentCollection, "id">;
  assistantMessages!: EntityTable<AssistantMessage, "id">;
  collectionMessages!: EntityTable<CollectionMessage, "key">;
  generatedFlashcardSets!: EntityTable<GeneratedFlashcardSet, "docId">;
  generatedQuizzes!: EntityTable<GeneratedQuiz, "docId">;
  pendingDeletions!: EntityTable<PendingDeletion, "key">;
  quizAttempts!: EntityTable<QuizAttempt, "id">;
  moodleCourses!: EntityTable<MoodleCourse, "id">;
  moodleCourseSections!: EntityTable<MoodleCourseSection, "key">;
  moodleCourseModules!: EntityTable<MoodleCourseModule, "key">;
  moodleGrades!: EntityTable<MoodleGrade, "key">;

  constructor(userId: string) {
    super(`elearn_user_${userId}`);
    this.version(1).stores({
      downloadedModules: "moduleId",
      downloadedMaterials: "key, materialId, moduleId",
      materialSummaries: "key, materialId, moduleId",
      activityEvents: "++id, timestamp",
      readMaterials: "key, materialId, moduleId",
    });
    // v2: activityEvents re-keyed from an auto-increment local counter to
    // a client-generated uuid — the old numeric ids have no meaning across
    // devices, which sync needs. No migration of old rows: same precedent
    // as Feature 9/15 (local-only dev data, not worth preserving).
    //
    // BUG (fixed): this originally tried to redeclare activityEvents
    // in-place as `"id, timestamp"` in this same version — but changing a
    // store's keyPath (here: dropping "++id"'s auto-increment) isn't
    // something IndexedDB allows in place; Dexie throws
    // `UpgradeError: Not yet support for changing primary key`, which
    // aborts the *entire* database open — not just this one table — so
    // every returning user whose browser still had v1 cached got a
    // permanently broken UserDB (DatabaseClosedError on every table read,
    // app-wide) the moment this version shipped. New users never hit it,
    // since Dexie creates a fresh DB straight at the latest version with
    // no upgrade transaction at all — that's why this went unnoticed for
    // so long. The correct way to change a keyPath in Dexie is to delete
    // the store in one version and recreate it in the next; see v3 below.
    this.version(2).stores({
      activityEvents: null,
      syncMeta: "key",
    });
    this.version(3).stores({
      activityEvents: "id, timestamp",
    });
    this.version(4).stores({
      personalDocuments: "id, uploadedAt",
    });
    this.version(5).stores({
      personalDocuments: "id, uploadedAt, collectionId",
      documentCollections: "id, updatedAt",
    });
    this.version(6).stores({
      assistantMessages: "id, timestamp",
    });
    this.version(7).stores({
      collectionMessages: "key, collectionId, timestamp",
    });
    this.version(8).stores({
      generatedFlashcardSets: "docId",
      generatedQuizzes: "docId",
    });
    this.version(9).stores({
      pendingDeletions: "key, entityType",
    });
    // The original uploaded PDF file, kept device-local — see
    // PersonalDocumentFile's own comment for why this is a separate table
    // rather than a field on personalDocuments.
    this.version(10).stores({
      personalDocumentFiles: "docId",
    });
    // A new table only — no existing store's keyPath changes, so this is
    // a safe additive upgrade (see v2/v3's own comment above for the
    // failure mode this deliberately avoids).
    this.version(11).stores({
      quizAttempts: "id, docId, submittedAt",
    });
    // NUST eLearning (Moodle) courses/materials/grades — read-only local
    // cache of the four moodle_* Supabase tables, filled by
    // pullMoodleContent() (sync.ts), never written to directly by the UI.
    // Also purely additive.
    this.version(12).stores({
      moodleCourses: "id",
      moodleCourseSections: "key, courseId",
      moodleCourseModules: "key, courseId, sectionId",
      moodleGrades: "key, courseId",
    });
  }
}

const userDbCache = new Map<string, UserDB>();

/** Opens (or reuses) the calling user's own IndexedDB database. Callers
 * must already know the user is signed in — there is no "anonymous" user
 * database, since offline data only ever belongs to an account. */
export function getUserDb(userId: string): UserDB {
  let instance = userDbCache.get(userId);
  if (!instance) {
    instance = new UserDB(userId);
    userDbCache.set(userId, instance);
  }
  return instance;
}
