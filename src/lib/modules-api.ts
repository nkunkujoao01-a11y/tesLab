import { supabase } from "@/lib/supabase";
import type {
  MaterialContent,
  MaterialRow,
  ModuleQuizQuestionRow,
  ModuleRow,
} from "@/lib/supabase";
import { deviceDb } from "@/lib/db";
import type { QuizQuestion } from "@/lib/quiz-gen";

export type { MaterialContent };

// FR: on a bad connection, a hung Supabase request previously blocked the
// whole route for however long the browser's own TCP timeout takes (~8s,
// measured in DEV_LOG.md Feature 29) before the loader could fail into any
// fallback at all. 6s is short enough to fail fast into the IndexedDB
// catalog cache below while still being generous on a genuinely slow (not
// dead) connection — see Feature 30.
const NETWORK_TIMEOUT_MS = 6000;

class NetworkTimeoutError extends Error {
  constructor() {
    super("Network request timed out");
    this.name = "NetworkTimeoutError";
  }
}

function withTimeout<T>(promise: PromiseLike<T>): Promise<T> {
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

// fetchModules()/fetchModule() run as TanStack Start route loaders, which
// execute on the SERVER during SSR for the initial render, not just in the
// browser — IndexedDB doesn't exist in Node, so every deviceDb touch below
// needs this guard. Missing it meant every SSR page load logged a real
// DexieError to the server console (found via a real dev-server log a user
// shared, not caught in testing — every earlier check exercised the
// already-hydrated client, never the server-rendered path).
const isBrowser = typeof indexedDB !== "undefined";

/** Device-wide, best-effort — a failed cache write should never break a
 * successful network fetch, so this is fire-and-forget from the callers
 * below, not awaited. No-ops entirely during SSR (see isBrowser above). */
async function cacheModules(modules: Module[]): Promise<void> {
  if (!isBrowser) return;
  try {
    await deviceDb.catalogModules.bulkPut(
      modules.map((m) => ({ id: m.id, cachedAt: Date.now(), data: m })),
    );
  } catch (err) {
    console.error("Failed to cache module catalog for offline use", err);
  }
}

export type Material = {
  id: string;
  title: string;
  kind: string;
  pages: number;
  sizeMb: number;
  content: MaterialContent;
};

export type Module = {
  id: string;
  code: string;
  faculty: string;
  title: string;
  chapter: string;
  lecturer: string;
  sizeMb: number;
  summary: string;
  totalLessons: number;
  materials: Material[];
  // Admin-authored, shared quiz for the whole module — see Feature 57.
  // Empty for the (common, for now) case where a lecturer hasn't added
  // one yet; distinct from each student's own generated quizzes.
  quizQuestions: QuizQuestion[];
};

function mapMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    pages: row.pages,
    sizeMb: row.size_mb,
    content: row.content,
  };
}

function mapModuleQuizQuestion(row: ModuleQuizQuestionRow): QuizQuestion {
  return {
    question: row.question,
    options: row.options,
    correctIndex: row.correct_index,
  };
}

function mapModule(
  row: ModuleRow & { materials: MaterialRow[]; module_quizzes: ModuleQuizQuestionRow[] },
): Module {
  return {
    id: row.id,
    code: row.code,
    faculty: row.faculty,
    title: row.title,
    chapter: row.chapter,
    lecturer: row.lecturer,
    sizeMb: row.size_mb,
    summary: row.summary,
    totalLessons: row.total_lessons,
    materials: row.materials.map(mapMaterial),
    quizQuestions: row.module_quizzes.map(mapModuleQuizQuestion),
  };
}

// Both functions below: try the network first (with a short timeout so a
// bad connection fails fast rather than hanging), fall back to whatever
// was last cached in IndexedDB on failure. This is what makes a module a
// student already looked at — downloaded or not — still *open* while
// offline; see Feature 30. Reading a module's page still doesn't require
// having downloaded it, same as before — the cache just means "the app
// has seen this module's metadata at least once," independent of the
// separate, explicit "download for offline reading" action.

export async function fetchModules(): Promise<Module[]> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("modules")
        .select("*, materials(*), module_quizzes(*)")
        .order("code")
        .order("created_at", { foreignTable: "module_quizzes" }),
    );
    if (error) throw error;
    const modules = (data ?? []).map(mapModule);
    void cacheModules(modules);
    return modules;
  } catch (err) {
    // No IndexedDB fallback during SSR — a server-side fetch failure is a
    // real error (the server should have real network access), not an
    // "offline" state to gracefully degrade from the way a browser can.
    if (!isBrowser) throw err;
    const cached = await deviceDb.catalogModules.toArray();
    if (cached.length > 0) {
      console.error("fetchModules: network unavailable, serving cached catalog", err);
      return cached.map((row) => row.data as Module).sort((a, b) => a.code.localeCompare(b.code));
    }
    throw err;
  }
}

export async function fetchModule(id: string): Promise<Module | null> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("modules")
        .select("*, materials(*), module_quizzes(*)")
        .eq("id", id)
        .order("created_at", { foreignTable: "module_quizzes" })
        .maybeSingle(),
    );
    if (error) throw error;
    const module = data ? mapModule(data) : null;
    if (module) void cacheModules([module]);
    return module;
  } catch (err) {
    if (!isBrowser) throw err;
    const cached = await deviceDb.catalogModules.get(id);
    if (cached) {
      console.error("fetchModule: network unavailable, serving cached copy", err);
      return cached.data as Module;
    }
    throw err;
  }
}
