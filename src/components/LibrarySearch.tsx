import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, FileText, BookOpen, FolderOpen, GraduationCap } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Module } from "@/lib/modules-api";
import { usePersonalDocuments, useDocumentCollections } from "@/hooks/use-documents";
import { useMoodleCourses } from "@/hooks/use-moodle-courses";

/** Real search over everything a student's library actually holds: the
 * shared module/material catalog (passed in — already loaded by the
 * calling page's own route loader, no extra request here), plus their own
 * uploaded documents, collections, and synced NUST Moodle courses (read
 * live from Dexie via the same hooks their own list pages use). One
 * search surface instead of three separate ones the student would have to
 * know to check individually. cmdk handles the actual fuzzy-matching; this
 * just supplies real fields to match against and real routes to navigate
 * to on select. */
export function LibrarySearchButton({
  modules,
  className,
}: {
  modules: Module[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const personalDocuments = usePersonalDocuments();
  const collections = useDocumentCollections();
  const moodleCourses = useMoodleCourses();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const openModule = (moduleId: string) => {
    setOpen(false);
    void navigate({ to: "/courses/$moduleId", params: { moduleId } });
  };
  const openMaterial = (moduleId: string, docId: string) => {
    setOpen(false);
    void navigate({ to: "/courses/$moduleId/read/$docId", params: { moduleId, docId } });
  };
  const openPersonalDocument = (docId: string) => {
    setOpen(false);
    void navigate({ to: "/documents/$docId", params: { docId } });
  };
  const openCollection = (collectionId: string) => {
    setOpen(false);
    void navigate({ to: "/documents/collections/$collectionId", params: { collectionId } });
  };
  const openMoodleCourse = (courseId: number) => {
    setOpen(false);
    void navigate({ to: "/courses/moodle/$courseId", params: { courseId: String(courseId) } });
  };

  return (
    <>
      <button
        type="button"
        aria-label="Search library"
        onClick={() => setOpen(true)}
        className={
          className ??
          "grid h-10 w-10 place-items-center rounded-full border border-border/70 text-prestige-mid transition-colors hover:text-prestige-deep"
        }
      >
        <Search className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search modules and materials…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {modules.map((m) => (
            <CommandGroup key={m.id} heading={`${m.code} · ${m.title}`}>
              <CommandItem
                value={`${m.code} ${m.title} ${m.faculty} ${m.chapter}`}
                onSelect={() => openModule(m.id)}
              >
                <BookOpen className="h-4 w-4" strokeWidth={1.75} />
                Open module
              </CommandItem>
              {m.materials.map((mat) => (
                <CommandItem
                  key={mat.id}
                  value={`${m.code} ${m.title} ${mat.title} ${mat.kind}`}
                  onSelect={() => openMaterial(m.id, mat.id)}
                >
                  <FileText className="h-4 w-4" strokeWidth={1.75} />
                  {mat.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {personalDocuments.length > 0 && (
            <CommandGroup heading="Your documents">
              {personalDocuments.map((doc) => (
                <CommandItem
                  key={doc.id}
                  value={`document ${doc.title}`}
                  onSelect={() => openPersonalDocument(doc.id)}
                >
                  <FileText className="h-4 w-4" strokeWidth={1.75} />
                  {doc.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {collections.length > 0 && (
            <CommandGroup heading="Collections">
              {collections.map((collection) => (
                <CommandItem
                  key={collection.id}
                  value={`collection ${collection.name}`}
                  onSelect={() => openCollection(collection.id)}
                >
                  <FolderOpen className="h-4 w-4" strokeWidth={1.75} />
                  {collection.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {moodleCourses.length > 0 && (
            <CommandGroup heading="NUST Moodle courses">
              {moodleCourses.map((course) => (
                <CommandItem
                  key={course.id}
                  value={`moodle ${course.shortName} ${course.fullName}`}
                  onSelect={() => openMoodleCourse(course.id)}
                >
                  <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
                  {course.fullName}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
