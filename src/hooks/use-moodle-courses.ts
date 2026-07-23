import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { getUserDb, type MoodleCourse, type MoodleCourseModule, type MoodleGrade } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";

export type UpcomingAssignment = {
  key: string;
  courseId: number;
  courseName: string;
  assignmentName: string;
  dueDate: number;
};

/** Every synced NUST eLearning course for the signed-in student — offline-
 * first, same liveQuery-over-Dexie pattern as every other list page in
 * this app. Populated by pullMoodleContent (sync.ts), triggered by the
 * existing AutoSync/manual-sync flow (use-sync.ts) — nothing here talks to
 * Supabase directly. */
export function useMoodleCourses(): MoodleCourse[] {
  const { user } = useAuth();
  const [courses, setCourses] = useState<MoodleCourse[]>([]);

  useEffect(() => {
    if (!user) {
      setCourses([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.moodleCourses.toArray()).subscribe({
      next: (rows) => setCourses([...rows].sort((a, b) => a.fullName.localeCompare(b.fullName))),
      error: (err) => console.error("Failed to read Moodle courses", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return courses;
}

export function useMoodleCourse(courseId: number): MoodleCourse | undefined {
  const { user } = useAuth();
  const [course, setCourse] = useState<MoodleCourse | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setCourse(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.moodleCourses.get(courseId)).subscribe({
      next: setCourse,
      error: (err) => console.error("Failed to read Moodle course", err),
    });
    return () => sub.unsubscribe();
  }, [user, courseId]);

  return course;
}

export type MoodleSectionWithModules = {
  sectionId: number;
  name?: string;
  position: number;
  modules: MoodleCourseModule[];
};

/** A course's modules grouped by section, in section order — the shape
 * the course detail page actually renders, computed here rather than in
 * the component so the page itself stays a plain render of already-
 * grouped data. */
export function useMoodleCourseSections(courseId: number): MoodleSectionWithModules[] {
  const { user } = useAuth();
  const [sections, setSections] = useState<MoodleSectionWithModules[]>([]);

  useEffect(() => {
    if (!user) {
      setSections([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(async () => {
      const [sectionRows, moduleRows] = await Promise.all([
        db.moodleCourseSections.where("courseId").equals(courseId).toArray(),
        db.moodleCourseModules.where("courseId").equals(courseId).toArray(),
      ]);
      const modulesBySection = new Map<number, MoodleCourseModule[]>();
      for (const module of moduleRows) {
        const list = modulesBySection.get(module.sectionId) ?? [];
        list.push(module);
        modulesBySection.set(module.sectionId, list);
      }
      return sectionRows
        .sort((a, b) => a.position - b.position)
        .map((section) => ({
          sectionId: section.sectionId,
          name: section.name,
          position: section.position,
          modules: modulesBySection.get(section.sectionId) ?? [],
        }));
    }).subscribe({
      next: setSections,
      error: (err) => console.error("Failed to read Moodle course sections", err),
    });
    return () => sub.unsubscribe();
  }, [user, courseId]);

  return sections;
}

export function useMoodleGrades(courseId: number): MoodleGrade[] {
  const { user } = useAuth();
  const [grades, setGrades] = useState<MoodleGrade[]>([]);

  useEffect(() => {
    if (!user) {
      setGrades([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() =>
      db.moodleGrades.where("courseId").equals(courseId).toArray(),
    ).subscribe({
      next: setGrades,
      error: (err) => console.error("Failed to read Moodle grades", err),
    });
    return () => sub.unsubscribe();
  }, [user, courseId]);

  return grades;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Real assignment due dates from NUST eLearning, due within `daysAhead`
 * from now and not already past — populated by pullMoodleContent
 * (sync.ts), filled server-side by moodle-cron-handler.ts's
 * mod_assign_get_assignments call. Sorted soonest-first, since that's the
 * one order a "what's coming up" list actually needs. */
export function useUpcomingDeadlines(daysAhead = 14): UpcomingAssignment[] {
  const { user } = useAuth();
  const [deadlines, setDeadlines] = useState<UpcomingAssignment[]>([]);

  useEffect(() => {
    if (!user) {
      setDeadlines([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(async () => {
      const [assignments, courses] = await Promise.all([
        db.moodleAssignments.toArray(),
        db.moodleCourses.toArray(),
      ]);
      const courseById = new Map(courses.map((c) => [c.id, c]));
      const now = Date.now();
      const cutoff = now + daysAhead * DAY_MS;
      return assignments
        .filter(
          (a): a is typeof a & { dueDate: number } =>
            a.dueDate !== undefined && a.dueDate >= now && a.dueDate <= cutoff,
        )
        .map((a) => {
          const course = courseById.get(a.courseId);
          return {
            key: a.key,
            courseId: a.courseId,
            courseName: course?.shortName ?? course?.fullName ?? "Course",
            assignmentName: a.name,
            dueDate: a.dueDate,
          };
        })
        .sort((x, y) => x.dueDate - y.dueDate);
    }).subscribe({
      next: setDeadlines,
      error: (err) => console.error("Failed to compute upcoming deadlines", err),
    });
    return () => sub.unsubscribe();
  }, [user, daysAhead]);

  return deadlines;
}
