import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import {
  ArrowLeft,
  ClipboardList,
  Download,
  File,
  FileText,
  Folder,
  Link2,
  Loader2,
  MessageSquare,
  Video,
  X,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import {
  useMoodleCourse,
  useMoodleCourseSections,
  useMoodleGrades,
} from "@/hooks/use-moodle-courses";
import { useAuth } from "@/hooks/use-auth";
import {
  extractModuleFiles,
  getMoodleFileUrl,
  type MoodleModuleFileMeta,
} from "@/lib/moodle-files";
import type { MoodleCourseModule } from "@/lib/db";

export const Route = createFileRoute("/courses/moodle/$courseId")({
  head: () => ({
    meta: [{ title: "Course — eLearn" }],
  }),
  component: MoodleCourseDetail,
});

// Moodle's own `modname` values for the activity/resource types this
// course structure actually contains — a generic fallback icon covers
// anything else (Moodle has dozens of plugin-provided modnames NUST may or
// may not use) rather than trying to enumerate every possible one.
const MODULE_ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  resource: FileText,
  folder: Folder,
  forum: MessageSquare,
  url: Link2,
  assign: ClipboardList,
  quiz: ClipboardList,
  turnitintooltwo: ClipboardList,
  workshop: ClipboardList,
  questionnaire: ClipboardList,
  page: FileText,
  bigbluebuttonbn: Video,
};

function moduleIcon(modname: string) {
  return MODULE_ICONS[modname] ?? File;
}

type OpenFile = { module: MoodleCourseModule; fileMeta: MoodleModuleFileMeta };
type OpenFolder = { module: MoodleCourseModule; files: MoodleModuleFileMeta[] };

/** Full-screen in-app viewer for a Moodle file — the actual point of the
 * proxy fetch (moodle-files.ts): materials open *here*, not on a NUST
 * page. PDFs render directly (every browser this app targets handles a
 * PDF object URL in an iframe natively); anything else offers a download
 * instead, since browsers can't render docx/pptx/etc. inline. */
function FileViewer({ open, onClose }: { open: OpenFile; onClose: () => void }) {
  const { user } = useAuth();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; objectUrl: string; mimeType: string }
  >({ status: "loading" });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let createdUrl: string | undefined;
    // A folder can hold several files under one module — keying the cache
    // by module alone would make the second file overwrite (or read back)
    // the first, so the file's own URL is folded into the cache key too.
    const cacheKey = `${open.module.key}::${open.fileMeta.fileUrl}`;
    void getMoodleFileUrl(user.id, cacheKey, open.fileMeta).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        createdUrl = result.objectUrl;
        setState({ status: "ready", objectUrl: result.objectUrl, mimeType: result.mimeType });
      } else {
        console.error("Failed to fetch Moodle file", result.reason);
        setState({ status: "error" });
      }
    });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [user, open.module.key, open.fileMeta]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="border-b border-border/60">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-5 py-4">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-prestige-deep">
            {open.module.name}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {state.status === "ready" && (
              <a
                href={state.objectUrl}
                download={open.fileMeta.fileName}
                className="grid h-9 w-9 place-items-center rounded-lg text-prestige-mid transition-colors hover:bg-secondary hover:text-prestige-deep active:scale-[0.94]"
                aria-label="Download"
              >
                <Download className="h-4 w-4" strokeWidth={1.75} />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-lg text-prestige-mid transition-colors hover:bg-secondary hover:text-prestige-deep active:scale-[0.94]"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {state.status === "loading" && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            Fetching from NUST eLearning…
          </div>
        )}
        {state.status === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm text-muted-foreground">Couldn't fetch this file. Try again.</p>
          </div>
        )}
        {state.status === "ready" &&
          (state.mimeType === "application/pdf" ? (
            <iframe src={state.objectUrl} title={open.module.name} className="h-full w-full" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-muted-foreground">
                This file type can't be previewed here — download it instead.
              </p>
              <a
                href={state.objectUrl}
                download={open.fileMeta.fileName}
                className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-transform active:scale-[0.97]"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                Download {open.fileMeta.fileName}
              </a>
            </div>
          ))}
      </div>
    </div>
  );
}

/** A folder with several files needs somewhere to pick one from before the
 * full-screen FileViewer takes over — reuses the same layout language. */
function FilePickerSheet({
  open,
  onClose,
  onSelect,
}: {
  open: OpenFolder;
  onClose: () => void;
  onSelect: (fileMeta: MoodleModuleFileMeta) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="border-b border-border/60">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-5 py-4">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-prestige-deep">
            {open.module.name}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-prestige-mid transition-colors hover:bg-secondary hover:text-prestige-deep active:scale-[0.94]"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-[720px] space-y-1 rounded-2xl bg-card p-2 ring-1 ring-border/60">
          {open.files.map((fileMeta, index) => (
            <button
              key={`${fileMeta.fileUrl}-${index}`}
              type="button"
              onClick={() => onSelect(fileMeta)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary active:scale-[0.99]"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                <File className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm text-prestige-deep">
                {fileMeta.fileName}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModuleRow({
  module,
  onOpenFiles,
}: {
  module: MoodleCourseModule;
  onOpenFiles: (module: MoodleCourseModule, files: MoodleModuleFileMeta[]) => void;
}) {
  const Icon = moduleIcon(module.modname);
  const files = extractModuleFiles(module.contents);
  const content = (
    <>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <span className="min-w-0 flex-1 truncate text-sm text-prestige-deep">{module.name}</span>
    </>
  );

  // A real file (resource/folder contents) opens in-app via the proxy —
  // this is the whole point of the feature (see this file's FileViewer
  // comment). A folder with more than one file opens a picker first;
  // anything without an extractable file (forums, quizzes, other
  // interactive Moodle pages) still has to open on the real site — there's
  // no "file" to pull in, just a live page.
  if (files.length > 0) {
    return (
      <button
        type="button"
        onClick={() => onOpenFiles(module, files)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary"
      >
        {content}
      </button>
    );
  }
  if (!module.url) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left">{content}</div>
    );
  }
  return (
    <a
      href={module.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary"
    >
      {content}
    </a>
  );
}

function MoodleCourseDetail() {
  const { courseId } = Route.useParams();
  const id = Number(courseId);
  const course = useMoodleCourse(id);
  const sections = useMoodleCourseSections(id);
  const grades = useMoodleGrades(id);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [openFolder, setOpenFolder] = useState<OpenFolder | null>(null);

  function handleOpenFiles(module: MoodleCourseModule, files: MoodleModuleFileMeta[]) {
    if (files.length === 1) {
      setOpenFile({ module, fileMeta: files[0] });
    } else {
      setOpenFolder({ module, files });
    }
  }

  // A liveQuery-backed hook starts undefined for a real course that just
  // hasn't loaded yet — same "blank frame briefly, not a 404" pattern used
  // throughout this app (see documents.$docId.index.tsx's own comment).
  if (course === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <MobileShell>
      {openFile && <FileViewer open={openFile} onClose={() => setOpenFile(null)} />}
      {openFolder && (
        <FilePickerSheet
          open={openFolder}
          onClose={() => setOpenFolder(null)}
          onSelect={(fileMeta) => {
            const module = openFolder.module;
            setOpenFolder(null);
            setOpenFile({ module, fileMeta });
          }}
        />
      )}

      <div className="px-6 pt-10 lg:px-10 lg:pt-14">
        <div className="mx-auto max-w-[720px]">
          <Link
            to="/courses/moodle"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            My courses
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[720px] px-6 pb-16 pt-6 lg:px-10">
        <p className="eyebrow">{course.shortName}</p>
        <h1 className="mt-3 font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
          {course.fullName}
        </h1>
        {course.lecturerName && (
          <p className="mt-3 text-sm text-muted-foreground">{course.lecturerName}</p>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">
          Synced from your connected NUST eLearning account — files open right here; anything else
          (forums, quizzes) opens the real NUST page in a new tab.
        </p>

        {grades.length > 0 && (
          <div className="mt-8 rounded-2xl bg-card p-5 ring-1 ring-border/60">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-mid">
              Grades
            </p>
            <div className="mt-3 space-y-2">
              {grades.map((grade) => (
                <div
                  key={grade.key}
                  className="flex items-center justify-between gap-3 border-b border-border/40 py-2 text-sm last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground/85">
                    {grade.itemName}
                  </span>
                  <span className="shrink-0 font-medium text-prestige-deep">
                    {grade.gradeFormatted && grade.gradeFormatted !== "-"
                      ? grade.gradeFormatted
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sections.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            No materials synced for this course yet.
          </p>
        ) : (
          <div className="mt-8 space-y-6">
            {sections.map((section) => (
              <div key={section.sectionId}>
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-mid">
                  {section.name || "Untitled section"}
                </p>
                <div className="mt-2 space-y-1 rounded-2xl bg-card p-2 ring-1 ring-border/60">
                  {section.modules.length === 0 ? (
                    <p className="px-3 py-2.5 text-xs text-muted-foreground">
                      Nothing in this section
                    </p>
                  ) : (
                    section.modules.map((module) => (
                      <ModuleRow key={module.key} module={module} onOpenFiles={handleOpenFiles} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
