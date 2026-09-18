import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, GraduationCap } from "lucide-react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { EmptyState } from "@/components/StatePanels";
import { useMoodleCourses } from "@/hooks/use-moodle-courses";
import { useMoodleConnection } from "@/hooks/use-moodle";

export const Route = createFileRoute("/courses/moodle/")({
  head: () => ({
    meta: [
      { title: "My NUST courses - eLearn" },
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
  const navigate = useNavigate();

  return (
    <MobileShell>
      <div className="px-6 pt-6 lg:px-10 lg:pt-8">
        <Link
          to="/courses"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Library
        </Link>
      </div>
      <PageHeader eyebrow="NUST eLearning" title="My courses" />

      <div className="space-y-4 px-6 pb-16 lg:px-10">
        {!moodle.loaded ? null : !moodle.connected ? (
          <EmptyState
            icon={GraduationCap}
            title="Connect your NUST eLearning account"
            description="Once connected, your real courses, materials, and grades sync in here automatically."
            action={{ label: "Go to Settings", onClick: () => void navigate({ to: "/settings" }) }}
          />
        ) : courses.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={moodle.lastSyncAt ? "No courses found" : "Not synced yet"}
            description={
              moodle.lastSyncAt
                ? "Your NUST eLearning account is connected, but no enrolled courses came back from the last sync."
                : "Your courses will appear here after the first automatic sync. This can take a little while."
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
                <h3 className="mt-2 break-words font-display text-lg font-medium leading-tight text-prestige-deep text-balance">
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
