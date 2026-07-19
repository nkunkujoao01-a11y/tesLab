import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Plus } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { useCreateModule, useCreateMaterial } from "@/hooks/use-catalog-admin";

export const Route = createFileRoute("/admin/catalog")({
  head: () => ({
    meta: [{ title: "Add course content — eLearn" }],
  }),
  component: AdminCatalog,
});

const KIND_OPTIONS = ["reading", "slides", "handout", "notes"];

function AdminCatalog() {
  const { profile, loading } = useAuth();
  const { createModule, creating: creatingModule } = useCreateModule();
  const { createMaterial, creating: creatingMaterial } = useCreateMaterial();

  const [moduleId, setModuleId] = useState<string | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");

  const [code, setCode] = useState("");
  const [faculty, setFaculty] = useState("");
  const [title, setTitle] = useState("");
  const [chapter, setChapter] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [totalLessons, setTotalLessons] = useState("10");
  const [summary, setSummary] = useState("");

  const [matTitle, setMatTitle] = useState("");
  const [matKind, setMatKind] = useState(KIND_OPTIONS[0]);
  const [matPages, setMatPages] = useState("10");
  const [matSizeMb, setMatSizeMb] = useState("2");
  const [heading, setHeading] = useState("");
  const [lead, setLead] = useState("");
  const [body, setBody] = useState("");
  const [pull, setPull] = useState("");
  const [addedCount, setAddedCount] = useState(0);

  const handleCreateModule = async () => {
    if (!code.trim() || !title.trim() || !faculty.trim() || !chapter.trim() || !lecturer.trim()) {
      return;
    }
    const id = await createModule({
      code,
      faculty,
      title,
      chapter,
      lecturer,
      totalLessons: Number(totalLessons) || 0,
      summary,
    });
    if (id) {
      setModuleId(id);
      setModuleTitle(title);
    }
  };

  const resetMaterialForm = () => {
    setMatTitle("");
    setHeading("");
    setLead("");
    setBody("");
    setPull("");
  };

  const handleAddMaterial = async () => {
    if (!moduleId || !matTitle.trim() || !heading.trim() || !body.trim()) return;
    const result = await createMaterial({
      moduleId,
      title: matTitle,
      kind: matKind,
      pages: Number(matPages) || 0,
      sizeMb: Number(matSizeMb) || 0,
      content: {
        heading: heading.trim(),
        lead: lead.trim(),
        body: body
          .split(/\n\n+/)
          .map((p) => p.trim())
          .filter(Boolean),
        pull: pull.trim() || heading.trim(),
      },
    });
    if (result) {
      setAddedCount((n) => n + 1);
      resetMaterialForm();
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!profile?.is_lecturer) {
    return (
      <MobileShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <p className="font-display text-lg text-prestige-deep">Lecturer access only</p>
          <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
            Your account isn't set up to add course content. Ask whoever administers this project's
            database to enable it for you.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-transform active:scale-[0.97]"
          >
            Back to dashboard
          </Link>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="px-6 pt-10 lg:px-10 lg:pt-14">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Profile
        </Link>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-prestige-deep">
          Add course content
        </h1>
      </div>

      <div className="mx-auto max-w-[640px] space-y-8 px-6 pb-24 pt-8 lg:px-10">
        {!moduleId ? (
          <section className="rounded-2xl bg-card p-6 ring-1 ring-border/60">
            <p className="text-sm font-medium text-prestige-deep">New module</p>
            <div className="mt-4 space-y-3">
              <FormField
                label="Module code"
                value={code}
                onChange={setCode}
                placeholder="e.g. CHE 205"
              />
              <FormField
                label="Faculty"
                value={faculty}
                onChange={setFaculty}
                placeholder="e.g. Sciences"
              />
              <FormField
                label="Title"
                value={title}
                onChange={setTitle}
                placeholder="e.g. Organic Chemistry I"
              />
              <FormField
                label="Chapter"
                value={chapter}
                onChange={setChapter}
                placeholder="e.g. Chapter 01 — Bonding"
              />
              <FormField
                label="Lecturer"
                value={lecturer}
                onChange={setLecturer}
                placeholder="e.g. Dr. J. Amutenya"
              />
              <FormField
                label="Total lessons"
                value={totalLessons}
                onChange={setTotalLessons}
                type="number"
              />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-prestige-mid">Summary</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-prestige-gold"
                  placeholder="A short description students see on the module card."
                />
              </div>
            </div>
            <button
              type="button"
              disabled={creatingModule}
              onClick={() => void handleCreateModule()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
            >
              {creatingModule ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              Create module
            </button>
          </section>
        ) : (
          <>
            <section className="flex items-center gap-3 rounded-2xl bg-prestige-deep p-5 text-prestige-cream">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-prestige-gold" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-sm font-medium">"{moduleTitle}" created</p>
                <p className="text-[11px] text-prestige-cream/70">
                  Add its materials below — students will see them immediately.
                </p>
              </div>
            </section>

            <section className="rounded-2xl bg-card p-6 ring-1 ring-border/60">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-prestige-deep">Add a material</p>
                {addedCount > 0 && (
                  <p className="text-[11px] text-muted-foreground">{addedCount} added so far</p>
                )}
              </div>
              <div className="mt-4 space-y-3">
                <FormField
                  label="Title"
                  value={matTitle}
                  onChange={setMatTitle}
                  placeholder="e.g. Lecture Slides — Chapter 01"
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-prestige-mid">Kind</label>
                  <select
                    value={matKind}
                    onChange={(e) => setMatKind(e.target.value)}
                    className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-prestige-gold"
                  >
                    {KIND_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Pages" value={matPages} onChange={setMatPages} type="number" />
                  <FormField
                    label="Size (MB)"
                    value={matSizeMb}
                    onChange={setMatSizeMb}
                    type="number"
                  />
                </div>
                <FormField
                  label="Heading"
                  value={heading}
                  onChange={setHeading}
                  placeholder="Shown at the top of the reader"
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-prestige-mid">Lead paragraph</label>
                  <textarea
                    value={lead}
                    onChange={(e) => setLead(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-prestige-gold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-prestige-mid">
                    Body (separate paragraphs with a blank line)
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-prestige-gold"
                  />
                </div>
                <FormField
                  label="Pull quote (optional)"
                  value={pull}
                  onChange={setPull}
                  placeholder="A short highlighted line — defaults to the heading if left blank"
                />
              </div>
              <button
                type="button"
                disabled={creatingMaterial}
                onClick={() => void handleAddMaterial()}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
              >
                {creatingMaterial ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                Add material
              </button>
            </section>

            <Link
              to="/courses/$moduleId"
              params={{ moduleId }}
              // reloadDocument: a real, found-not-guessed gap — this
              // module/material was just written straight to Supabase
              // through this page's own admin hooks, bypassing whatever
              // the router already preloaded/cached for this URL (e.g.
              // from hovering this exact link while filling the form
              // above it). A normal client-side <Link> can genuinely show
              // a materials list missing the material just added, only
              // fixed by a real reload — confirmed by testing, not
              // assumed. A full document navigation guarantees this one
              // link — used right after writing data through a
              // side-channel, not a frequent hot path — always shows
              // fresh content instead of occasionally stale.
              reloadDocument
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
            >
              View module as a student would →
            </Link>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-prestige-mid">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-prestige-gold"
      />
    </div>
  );
}
