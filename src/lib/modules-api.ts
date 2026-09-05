import { supabase } from "@/lib/supabase";
import type {
  MaterialContent,
  MaterialRow,
  ModuleQuizQuestionRow,
  ModuleRow,
} from "@/lib/supabase";
import { deviceDb } from "@/lib/db";
import type { QuizQuestion } from "@/lib/quiz-gen";
// Shared with use-auth.tsx's profile fetch and dashboard.tsx's offline
// cold-start empty state — see with-timeout.ts.
import { withTimeout } from "@/lib/with-timeout";

export type { MaterialContent };

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
  // Absent only for the SSR-only, list-view fetch below (fetchModules()
  // during the server-rendered initial load) — see its own comment for why.
  // Always present from fetchModule() (singular) and from any client-side
  // fetchModules() call, which is what every content reader actually uses.
  content?: MaterialContent;
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

function mapMaterial(row: Omit<MaterialRow, "content"> & { content?: MaterialContent }): Material {
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
  row: ModuleRow & {
    materials: (Omit<MaterialRow, "content"> & { content?: MaterialContent })[];
    module_quizzes: ModuleQuizQuestionRow[];
  },
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

// The list views this feeds (dashboard, courses grid, progress, summaries —
// every current caller) only ever read a material's id/title/kind/pages/
// size, never its .content — that's real extracted document text, often the
// single biggest field on the row. During SSR specifically, fetching it here
// is pure waste: it can't even reach the offline cache (cacheModules() below
// no-ops server-side, see isBrowser) since content only needs to be *stored*
// for offline use, never *rendered*, on this page. Dropping it from the SSR
// query shrinks the SSR response and the hydration payload directly — both
// on this app's own Slow-4G/low-end-device critical path (confirmed via a
// real Lighthouse run: dashboard's SSR response was the single largest
// contributor to a 5s+ FCP). A client-side call (browser revisit, or
// usePrecacheRoutes()'s idle-time warm-up) still fetches full content and
// populates the real offline cache exactly as before — this only changes
// what the *server-rendered, unused-by-this-page* copy carries.
export async function fetchModules(): Promise<Module[]> {
  try {
    const materialsSelect = isBrowser
      ? "materials(*)"
      : "materials(id, module_id, title, kind, pages, size_mb, created_at)";
    const { data, error } = await withTimeout(
      supabase
        .from("modules")
        .select(`*, ${materialsSelect}, module_quizzes(*)`)
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
