import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { useCreateModule } from "@/hooks/use-catalog-admin";

export const Route = createFileRoute("/admin/modules/new")({
  component: NewModulePage,
});

function AdminField({
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
      <label className="eyebrow">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prestige-gold/50"
      />
    </div>
  );
}

function NewModulePage() {
  const navigate = useNavigate();
  const { createModule, creating } = useCreateModule();

  const [code, setCode] = useState("");
  const [faculty, setFaculty] = useState("");
  const [title, setTitle] = useState("");
  const [chapter, setChapter] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [totalLessons, setTotalLessons] = useState("10");
  const [summary, setSummary] = useState("");

  const handleCreate = async () => {
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
    if (id) void navigate({ to: "/admin/modules/$moduleId", params: { moduleId: id } });
  };

  return (
    <div className="mx-auto max-w-[560px]">
      <Link
        to="/admin/modules"
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Modules
      </Link>
      <h1 className="mt-3 font-display text-2xl font-medium tracking-tight text-prestige-deep">
        New module
      </h1>

      <div className="animate-rise mt-6 space-y-3 rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <AdminField
          label="Module code"
          value={code}
          onChange={setCode}
          placeholder="e.g. CHE 205"
        />
        <AdminField
          label="Faculty"
          value={faculty}
          onChange={setFaculty}
          placeholder="e.g. Sciences"
        />
        <AdminField
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="e.g. Organic Chemistry I"
        />
        <AdminField
          label="Chapter"
          value={chapter}
          onChange={setChapter}
          placeholder="e.g. Chapter 01 — Bonding"
        />
        <AdminField
          label="Lecturer"
          value={lecturer}
          onChange={setLecturer}
          placeholder="e.g. Dr. J. Amutenya"
        />
        <AdminField
          label="Total lessons"
          value={totalLessons}
          onChange={setTotalLessons}
          type="number"
        />
        <div className="space-y-1.5">
          <label className="eyebrow">Summary</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prestige-gold/50"
            placeholder="A short description students see on the module card."
          />
        </div>
      </div>

      <button
        type="button"
        disabled={creating}
        onClick={() => void handleCreate()}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
      >
        {creating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        Create module
      </button>
    </div>
  );
}
