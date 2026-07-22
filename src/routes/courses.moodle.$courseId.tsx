import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ClipboardList,
  File,
  FileText,
  Folder,
  Link2,
  MessageSquare,
  Video,
} from "lucide-react";
import type { ComponentType } from "react";
import { MobileShell } from "@/components/MobileShell";
import {
  useMoodleCourse,
  useMoodleCourseSections,
  useMoodleGrades,
} from "@/hooks/use-moodle-courses";
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

function ModuleRow({ module }: { module: MoodleCourseModule }) {
  const Icon = moduleIcon(module.modname);
  const content = (
    <>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <span className="min-w-0 flex-1 truncate text-sm text-prestige-deep">{module.name}</span>
    </>
  );
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

  // A liveQuery-backed hook starts undefined for a real course that just
  // hasn't loaded yet — same "blank frame briefly, not a 404" pattern used
  // throughout this app (see documents.$docId.index.tsx's own comment).
  if (course === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <MobileShell>
      <div className="px-6 pt-10 lg:px-10 lg:pt-14">
        <Link
          to="/courses/moodle"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          My courses
        </Link>
      </div>

      <div className="px-6 pb-16 pt-6 lg:px-10">
        <p className="eyebrow">{course.shortName}</p>
        <h1 className="mt-3 font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
          {course.fullName}
        </h1>
        {course.lecturerName && (
          <p className="mt-3 text-sm text-muted-foreground">{course.lecturerName}</p>
        )}

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
                    section.modules.map((module) => <ModuleRow key={module.key} module={module} />)
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
