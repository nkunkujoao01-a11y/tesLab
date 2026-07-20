import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2, Plus, Upload, Users, FileText, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { fetchModule } from "@/lib/modules-api";
import { useCreateMaterial, useCreateModuleQuizQuestion } from "@/hooks/use-catalog-admin";
import { useModuleRoster } from "@/hooks/use-enrollment";
import { extractMaterialFields } from "@/lib/admin-content-extract";
import { PdfExtractionError } from "@/lib/pdf-extract";
import { formatMb, formatRelative } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/modules/$moduleId")({
  loader: async ({ params }) => {
    const module = await fetchModule(params.moduleId);
    if (!module) throw notFound();
    return { module };
  },
  component: AdminModuleDetailPage,
});

const KIND_OPTIONS = ["reading", "slides", "handout", "notes"];

function AdminModuleDetailPage() {
  const { module } = Route.useLoaderData();
  const { moduleId } = Route.useParams();
  const { createMaterial, creating: creatingMaterial } = useCreateMaterial();
  const { createModuleQuizQuestion, creating: creatingQuestion } = useCreateModuleQuizQuestion();
  const { roster, loading: rosterLoading } = useModuleRoster(moduleId);

  const [matTitle, setMatTitle] = useState("");
  const [matKind, setMatKind] = useState(KIND_OPTIONS[0]);
  const [matPages, setMatPages] = useState("10");
  const [matSizeMb, setMatSizeMb] = useState("2");
  const [heading, setHeading] = useState("");
  const [lead, setLead] = useState("");
  const [body, setBody] = useState("");
  const [pull, setPull] = useState("");
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [materialsAdded, setMaterialsAdded] = useState<string[]>([]);

  const [qQuestion, setQQuestion] = useState("");
  const [qOptions, setQOptions] = useState(["", "", "", ""]);
  const [qCorrectIndex, setQCorrectIndex] = useState(0);
  const [questionsAdded, setQuestionsAdded] = useState<string[]>([]);

  const handleExtractFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const fields = await extractMaterialFields(file);
      setMatTitle((prev) => prev || fields.heading);
      setHeading(fields.heading);
      setLead(fields.lead);
      setBody(fields.body);
      setPull(fields.pull);
      setMatPages(String(fields.pageCount));
      setMatSizeMb(String(fields.sizeMb));
      toast.success("Extracted — review the fields below before adding.");
    } catch (err) {
      console.error("Failed to extract material content from file", err);
      toast.error(
        err instanceof PdfExtractionError
          ? err.message
          : "Couldn't read that file. Try a PDF, Markdown, or plain-text file instead.",
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleAddMaterial = async () => {
    if (!matTitle.trim() || !heading.trim() || !body.trim()) return;
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
      setMaterialsAdded((prev) => [...prev, matTitle.trim()]);
      setMatTitle("");
      setHeading("");
      setLead("");
      setBody("");
      setPull("");
    }
  };

  const handleAddQuestion = async () => {
    if (!qQuestion.trim() || qOptions.some((o) => !o.trim())) return;
    const ok = await createModuleQuizQuestion({
      moduleId,
      question: qQuestion,
      options: qOptions,
      correctIndex: qCorrectIndex,
    });
    if (ok) {
      setQuestionsAdded((prev) => [...prev, qQuestion.trim()]);
      setQQuestion("");
      setQOptions(["", "", "", ""]);
      setQCorrectIndex(0);
    }
  };

  const existingMaterials = [...module.materials.map((m) => m.title), ...materialsAdded];
  const existingQuestions = [...module.quizQuestions.map((q) => q.question), ...questionsAdded];

  return (
    <div className="mx-auto max-w-[760px]">
      <Link
        to="/admin/modules"
        className="font-console-mono text-[11px] text-console-text-faint hover:text-console-text"
      >
        ← Modules
      </Link>
      <h1 className="mt-3 font-console-mono text-[22px] font-semibold tracking-tight text-console-text">
        {module.title}
      </h1>
      <p className="mt-1 font-console-mono text-[11px] text-console-text-faint">
        {module.code} · {module.faculty} · {module.chapter}
      </p>

      {/* Materials */}
      <section className="mt-7 rounded-lg border border-console-border bg-console-surface p-5">
        <div className="flex items-center gap-2.5">
          <FileText className="h-4 w-4 text-console-info" strokeWidth={1.75} />
          <div>
            <p className="text-[13px] font-semibold text-console-text">Materials</p>
            <p className="text-[11px] text-console-text-faint">
              {existingMaterials.length} in this module
            </p>
          </div>
        </div>

        {existingMaterials.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-console-border pt-3">
            {existingMaterials.map((t, i) => (
              <li key={i} className="truncate text-xs text-console-text-dim">
                · {t}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-3 border-t border-console-border pt-4">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
              className="hidden"
              onChange={(e) => void handleExtractFromFile(e)}
            />
            <button
              type="button"
              disabled={extracting}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-console-text-dim ring-1 ring-console-border transition-all hover:bg-console-surface-2 disabled:opacity-40"
            >
              {extracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {extracting ? "Extracting…" : "Extract from PDF/Markdown/Text"}
            </button>
          </div>
          <input
            value={matTitle}
            onChange={(e) => setMatTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-text placeholder:text-console-text-faint focus:outline-none focus:ring-1 focus:ring-console-accent"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={matKind}
              onChange={(e) => setMatKind(e.target.value)}
              className="rounded-md border border-console-border bg-console-bg px-2 py-2 text-xs text-console-text focus:outline-none focus:ring-1 focus:ring-console-accent"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={matPages}
              onChange={(e) => setMatPages(e.target.value)}
              placeholder="Pages"
              className="rounded-md border border-console-border bg-console-bg px-2 py-2 text-xs text-console-text focus:outline-none focus:ring-1 focus:ring-console-accent"
            />
            <input
              type="number"
              value={matSizeMb}
              onChange={(e) => setMatSizeMb(e.target.value)}
              placeholder="Size (MB)"
              className="rounded-md border border-console-border bg-console-bg px-2 py-2 text-xs text-console-text focus:outline-none focus:ring-1 focus:ring-console-accent"
            />
          </div>
          <input
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            placeholder="Heading"
            className="w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-text placeholder:text-console-text-faint focus:outline-none focus:ring-1 focus:ring-console-accent"
          />
          <textarea
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            rows={2}
            placeholder="Lead paragraph"
            className="w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-text placeholder:text-console-text-faint focus:outline-none focus:ring-1 focus:ring-console-accent"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Body (separate paragraphs with a blank line)"
            className="w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-text placeholder:text-console-text-faint focus:outline-none focus:ring-1 focus:ring-console-accent"
          />
          <input
            value={pull}
            onChange={(e) => setPull(e.target.value)}
            placeholder="Pull quote (optional)"
            className="w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-text placeholder:text-console-text-faint focus:outline-none focus:ring-1 focus:ring-console-accent"
          />
          <button
            type="button"
            disabled={creatingMaterial}
            onClick={() => void handleAddMaterial()}
            className="inline-flex items-center gap-2 rounded-md bg-console-accent px-4 py-2 text-xs font-semibold text-console-bg transition-all active:scale-[0.97] disabled:opacity-40"
          >
            {creatingMaterial ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Add material
          </button>
        </div>
      </section>

      {/* Quiz */}
      <section className="mt-5 rounded-lg border border-console-border bg-console-surface p-5">
        <div className="flex items-center gap-2.5">
          <ListChecks className="h-4 w-4 text-console-info" strokeWidth={1.75} />
          <div>
            <p className="text-[13px] font-semibold text-console-text">Quiz questions</p>
            <p className="text-[11px] text-console-text-faint">
              {existingQuestions.length} live — shared across every student in this module
            </p>
          </div>
        </div>

        {existingQuestions.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-console-border pt-3">
            {existingQuestions.map((q, i) => (
              <li key={i} className="truncate text-xs text-console-text-dim">
                {i + 1}. {q}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-3 border-t border-console-border pt-4">
          <textarea
            value={qQuestion}
            onChange={(e) => setQQuestion(e.target.value)}
            rows={2}
            placeholder="e.g. What does RLS stand for?"
            className="w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-text placeholder:text-console-text-faint focus:outline-none focus:ring-1 focus:ring-console-accent"
          />
          {qOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct-option"
                checked={qCorrectIndex === i}
                onChange={() => setQCorrectIndex(i)}
                aria-label={`Option ${i + 1} is correct`}
              />
              <input
                type="text"
                value={opt}
                onChange={(e) =>
                  setQOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                }
                placeholder={`Option ${i + 1}${i === qCorrectIndex ? " (correct)" : ""}`}
                className="w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-text placeholder:text-console-text-faint focus:outline-none focus:ring-1 focus:ring-console-accent"
              />
            </div>
          ))}
          <button
            type="button"
            disabled={creatingQuestion}
            onClick={() => void handleAddQuestion()}
            className="inline-flex items-center gap-2 rounded-md bg-console-accent px-4 py-2 text-xs font-semibold text-console-bg transition-all active:scale-[0.97] disabled:opacity-40"
          >
            {creatingQuestion ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Add question
          </button>
        </div>
      </section>

      {/* Roster */}
      <section className="mt-5 rounded-lg border border-console-border bg-console-surface p-5">
        <div className="flex items-center gap-2.5">
          <Users className="h-4 w-4 text-console-info" strokeWidth={1.75} />
          <div>
            <p className="text-[13px] font-semibold text-console-text">Registered students</p>
            <p className="text-[11px] text-console-text-faint">
              Students who've enrolled themselves in this module
            </p>
          </div>
        </div>
        <div className="mt-3 border-t border-console-border pt-3">
          {rosterLoading ? (
            <p className="text-xs text-console-text-faint">Loading…</p>
          ) : roster.length === 0 ? (
            <p className="text-xs text-console-text-faint">No one has enrolled yet.</p>
          ) : (
            <ul className="divide-y divide-console-border">
              {roster.map((entry) => (
                <li
                  key={entry.userId}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-console-text">{entry.fullName}</span>
                  <span className="shrink-0 font-console-mono text-[10.5px] text-console-text-faint">
                    {formatRelative(entry.enrolledAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between font-console-mono text-[10.5px] text-console-text-faint">
        <span>{formatMb(module.sizeMb)} total</span>
        <Link
          to="/courses/$moduleId"
          params={{ moduleId }}
          reloadDocument
          className="text-console-info hover:underline"
        >
          View as a student would →
        </Link>
      </div>
    </div>
  );
}
