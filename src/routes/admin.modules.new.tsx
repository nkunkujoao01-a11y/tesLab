import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useCreateModule } from "@/hooks/use-catalog-admin";

export const Route = createFileRoute("/admin/modules/new")({
  component: NewModulePage,
});

function ConsoleField({
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
      <label className="font-console-mono text-[11px] uppercase tracking-wide text-console-text-faint">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-text placeholder:text-console-text-faint focus:outline-none focus:ring-1 focus:ring-console-accent"
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
        className="font-console-mono text-[11px] text-console-text-faint hover:text-console-text"
      >
        ← Modules
      </Link>
      <h1 className="mt-3 font-console-mono text-[22px] font-semibold tracking-tight text-console-text">
        New module
      </h1>

      <div className="mt-6 space-y-3 rounded-lg border border-console-border bg-console-surface p-5">
        <ConsoleField
          label="Module code"
          value={code}
          onChange={setCode}
          placeholder="e.g. CHE 205"
        />
        <ConsoleField
          label="Faculty"
          value={faculty}
          onChange={setFaculty}
          placeholder="e.g. Sciences"
        />
        <ConsoleField
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="e.g. Organic Chemistry I"
        />
        <ConsoleField
          label="Chapter"
          value={chapter}
          onChange={setChapter}
          placeholder="e.g. Chapter 01 — Bonding"
        />
        <ConsoleField
          label="Lecturer"
          value={lecturer}
          onChange={setLecturer}
          placeholder="e.g. Dr. J. Amutenya"
        />
        <ConsoleField
          label="Total lessons"
          value={totalLessons}
          onChange={setTotalLessons}
          type="number"
        />
        <div className="space-y-1.5">
          <label className="font-console-mono text-[11px] uppercase tracking-wide text-console-text-faint">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-text placeholder:text-console-text-faint focus:outline-none focus:ring-1 focus:ring-console-accent"
            placeholder="A short description students see on the module card."
          />
        </div>
      </div>

      <button
        type="button"
        disabled={creating}
        onClick={() => void handleCreate()}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-console-accent px-4 py-2.5 text-xs font-semibold text-console-bg transition-all active:scale-[0.97] disabled:opacity-40"
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
