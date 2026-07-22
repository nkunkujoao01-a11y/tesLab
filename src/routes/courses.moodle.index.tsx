import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, GraduationCap } from "lucide-react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { useMoodleCourses } from "@/hooks/use-moodle-courses";
import { useMoodleConnection } from "@/hooks/use-moodle";

export const Route = createFileRoute("/courses/moodle/")({
  head: () => ({
    meta: [
      { title: "My NUST courses — eLearn" },
      {
        name: "description",
        content: "Your real enrolled courses, materials, and grades from NUST eLearning.",
      },
    ],
  }),
  component: MoodleCourses,
});

function MoodleCourses() {
  const courses = useMoodleCourses();
  const moodle = useMoodleConnection();

  return (
    <MobileShell>
      <PageHeader eyebrow="NUST eLearning" title="My courses" />

      <div className="space-y-4 px-6 pb-16 lg:px-10">
        {!moodle.loaded ? null : !moodle.connected ? (
          <div className="animate-rise mx-auto max-w-[440px] rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <GraduationCap className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">
              Connect your NUST eLearning account
            </p>
            <p className="mt-2 max-w-[38ch] mx-auto text-sm text-muted-foreground">
              Once connected, your real courses, materials, and grades sync in here automatically.
            </p>
            <Link
              to="/settings"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-5 py-2.5 text-sm font-medium text-prestige-cream transition-transform active:scale-[0.97]"
            >
              Go to Settings
            </Link>
          </div>
        ) : courses.length === 0 ? (
          <div className="animate-rise mx-auto max-w-[440px] rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <GraduationCap className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">
              {moodle.lastSyncAt ? "No courses found" : "Not synced yet"}
            </p>
            <p className="mt-2 max-w-[38ch] mx-auto text-sm text-muted-foreground">
              {moodle.lastSyncAt
                ? "Your NUST eLearning account is connected, but no enrolled courses came back from the last sync."
                : "Your courses will appear here after the first automatic sync — this can take a little while."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                to="/courses/moodle/$courseId"
                params={{ courseId: String(course.id) }}
                className="animate-rise group flex flex-col rounded-2xl bg-card p-5 ring-1 ring-border/60 transition-all hover:-translate-y-0.5 hover:ring-prestige-gold/40"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-prestige-mid">
                  {course.shortName}
                </p>
                <h3 className="mt-2 font-display text-lg font-medium leading-tight text-prestige-deep text-balance">
                  {course.fullName}
                </h3>
                {course.lecturerName && (
                  <p className="mt-1 text-xs text-muted-foreground">{course.lecturerName}</p>
                )}
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-prestige-mid">
                  View course
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
