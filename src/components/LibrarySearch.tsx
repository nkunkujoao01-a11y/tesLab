import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, FileText, BookOpen } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Module } from "@/lib/modules-api";

/** Real search over the module/material catalog already loaded by the
 * calling page (Dashboard/Library both already fetch it via their route
 * loader — no extra request here). cmdk handles the actual fuzzy-matching;
 * this just supplies real fields to match against and real routes to
 * navigate to on select. Replaces what was a decorative "Search library"
 * button with no onClick at all. */
export function LibrarySearchButton({
  modules,
  className,
}: {
  modules: Module[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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
        </CommandList>
      </CommandDialog>
    </>
  );
}
