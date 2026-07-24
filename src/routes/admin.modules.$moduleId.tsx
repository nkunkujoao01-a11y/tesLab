import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  Loader2,
  Plus,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  Users,
  FileText,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { fetchModule } from "@/lib/modules-api";
import { useCreateMaterial, useCreateModuleQuizQuestion } from "@/hooks/use-catalog-admin";
import {
  useModuleRoster,
  useSearchStudents,
  useAdminManageEnrollment,
} from "@/hooks/use-enrollment";
import { useModuleGrades, useManageGrades } from "@/hooks/use-grades";
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

const FIELD_CLASS =
  "w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prestige-gold/50";
const SELECT_CLASS =
  "rounded-lg border border-border/70 bg-background px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-prestige-gold/50";

function AdminModuleDetailPage() {
  const { module } = Route.useLoaderData();
  const { moduleId } = Route.useParams();
  const { createMaterial, creating: creatingMaterial } = useCreateMaterial();
  const { createModuleQuizQuestion, creating: creatingQuestion } = useCreateModuleQuizQuestion();
  const { roster, loading: rosterLoading, refetch: refetchRoster } = useModuleRoster(moduleId);
  const [studentQuery, setStudentQuery] = useState("");
  const { results: searchResults, searching } = useSearchStudents(studentQuery);
  const {
    assignStudent,
    removeStudent,
    mutating: mutatingEnrollment,
  } = useAdminManageEnrollment(moduleId);

  const handleAssignStudent = async (userId: string) => {
    const ok = await assignStudent(userId);
    if (ok) {
      setStudentQuery("");
      refetchRoster();
    }
  };

  const handleRemoveStudent = async (userId: string) => {
    const ok = await removeStudent(userId);
    if (ok) refetchRoster();
  };

  const { grades, loading: gradesLoading, refetch: refetchGrades } = useModuleGrades(moduleId);
  const { recordGrade, deleteGrade, mutating: mutatingGrade } = useManageGrades();
  const [gradeStudentId, setGradeStudentId] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [gradeScore, setGradeScore] = useState("");
  const [gradeMaxScore, setGradeMaxScore] = useState("100");

  const handleRecordGrade = async () => {
    if (!gradeStudentId || !gradeLabel.trim()) return;
    const ok = await recordGrade({
      moduleId,
      userId: gradeStudentId,
      label: gradeLabel,
      score: Number(gradeScore),
      maxScore: Number(gradeMaxScore),
    });
    if (ok) {
      setGradeLabel("");
      setGradeScore("");
      refetchGrades();
    }
  };

  const handleDeleteGrade = async (gradeId: string) => {
    const ok = await deleteGrade(gradeId);
    if (ok) refetchGrades();
  };

  const rosterNameById = new Map(roster.map((r) => [r.userId, r.fullName]));

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
          : "Couldn't read that file. Try a PDF, Word document, image, Markdown, or plain-text file instead.",
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
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Modules
      </Link>
      <h1 className="mt-3 font-display text-2xl font-medium tracking-tight text-prestige-deep">
        {module.title}
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        {module.code} · {module.faculty} · {module.chapter}
      </p>

      {/* Materials */}
      <section className="animate-rise mt-7 rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
            <FileText className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-medium text-prestige-deep">Materials</p>
            <p className="text-[11px] text-muted-foreground">
              {existingMaterials.length} in this module
            </p>
          </div>
        </div>

        {existingMaterials.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border/60 pt-3">
            {existingMaterials.map((t, i) => (
              <li key={i} className="truncate text-xs text-muted-foreground">
                · {t}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain,image/*"
              className="hidden"
              onChange={(e) => void handleExtractFromFile(e)}
            />
            <button
              type="button"
              disabled={extracting}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-prestige-mid ring-1 ring-border/70 transition-all hover:bg-secondary disabled:opacity-40"
            >
              {extracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {extracting ? "Extracting…" : "Extract from PDF, Word, image, or text"}
            </button>
          </div>
          <input
            value={matTitle}
            onChange={(e) => setMatTitle(e.target.value)}
            placeholder="Title"
            className={FIELD_CLASS}
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={matKind}
              onChange={(e) => setMatKind(e.target.value)}
              className={SELECT_CLASS}
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
              className={SELECT_CLASS}
            />
            <input
              type="number"
              value={matSizeMb}
              onChange={(e) => setMatSizeMb(e.target.value)}
              placeholder="Size (MB)"
              className={SELECT_CLASS}
            />
          </div>
          <input
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            placeholder="Heading"
            className={FIELD_CLASS}
          />
          <textarea
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            rows={2}
            placeholder="Lead paragraph"
            className={`${FIELD_CLASS} resize-none`}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Body (separate paragraphs with a blank line)"
            className={`${FIELD_CLASS} resize-none`}
          />
          <input
            value={pull}
            onChange={(e) => setPull(e.target.value)}
            placeholder="Pull quote (optional)"
            className={FIELD_CLASS}
          />
          <button
            type="button"
            disabled={creatingMaterial}
            onClick={() => void handleAddMaterial()}
            className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
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
      <section className="animate-rise mt-5 rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
            <ListChecks className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-medium text-prestige-deep">Quiz questions</p>
            <p className="text-[11px] text-muted-foreground">
              {existingQuestions.length} live — shared across every student in this module
            </p>
          </div>
        </div>

        {existingQuestions.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border/60 pt-3">
            {existingQuestions.map((q, i) => (
              <li key={i} className="truncate text-xs text-muted-foreground">
                {i + 1}. {q}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <textarea
            value={qQuestion}
            onChange={(e) => setQQuestion(e.target.value)}
            rows={2}
            placeholder="e.g. What does RLS stand for?"
            className={`${FIELD_CLASS} resize-none`}
          />
          {qOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct-option"
                checked={qCorrectIndex === i}
                onChange={() => setQCorrectIndex(i)}
                aria-label={`Option ${i + 1} is correct`}
                className="accent-prestige-deep"
              />
              <input
                type="text"
                value={opt}
                onChange={(e) =>
                  setQOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                }
                placeholder={`Option ${i + 1}${i === qCorrectIndex ? " (correct)" : ""}`}
                className={FIELD_CLASS}
              />
            </div>
          ))}
          <button
            type="button"
            disabled={creatingQuestion}
            onClick={() => void handleAddQuestion()}
            className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
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
      <section className="animate-rise mt-5 rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
            <Users className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-medium text-prestige-deep">Registered students</p>
            <p className="text-[11px] text-muted-foreground">
              Self-enrolled, or assigned by you below
            </p>
          </div>
        </div>

        <div className="relative mt-4 border-t border-border/60 pt-4">
          <input
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder="Search a student by name to assign…"
            className={FIELD_CLASS}
          />
          {studentQuery.trim().length >= 2 && (
            <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg bg-card shadow-lg ring-1 ring-border/70">
              {searching ? (
                <p className="px-3 py-2.5 text-xs text-muted-foreground">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-muted-foreground">No students found.</p>
              ) : (
                searchResults.map((s) => (
                  <button
                    key={s.userId}
                    type="button"
                    disabled={mutatingEnrollment}
                    onClick={() => void handleAssignStudent(s.userId)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-foreground/90 transition-colors hover:bg-secondary disabled:opacity-40"
                  >
                    {s.fullName}
                    <UserPlus
                      className="h-3.5 w-3.5 shrink-0 text-prestige-mid"
                      strokeWidth={1.75}
                    />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-border/60 pt-3">
          {rosterLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : roster.length === 0 ? (
            <p className="text-xs text-muted-foreground">No one has enrolled yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {roster.map((entry) => (
                <li
                  key={entry.userId}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-foreground/90">{entry.fullName}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[10.5px] text-muted-foreground">
                      {formatRelative(entry.enrolledAt)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${entry.fullName}`}
                      disabled={mutatingEnrollment}
                      onClick={() => void handleRemoveStudent(entry.userId)}
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                      <UserMinus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Grades */}
      <section className="animate-rise mt-5 rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
            <Award className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-medium text-prestige-deep">Grades</p>
            <p className="text-[11px] text-muted-foreground">
              {grades.length} recorded — visible only to the student they belong to
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          {roster.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Assign a student above before recording a grade.
            </p>
          ) : (
            <>
              <select
                value={gradeStudentId}
                onChange={(e) => setGradeStudentId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Select a student…</option>
                {roster.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.fullName}
                  </option>
                ))}
              </select>
              <input
                value={gradeLabel}
                onChange={(e) => setGradeLabel(e.target.value)}
                placeholder="e.g. Assignment 1, Midterm"
                className={FIELD_CLASS}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={gradeScore}
                  onChange={(e) => setGradeScore(e.target.value)}
                  placeholder="Score"
                  className={SELECT_CLASS}
                />
                <input
                  type="number"
                  value={gradeMaxScore}
                  onChange={(e) => setGradeMaxScore(e.target.value)}
                  placeholder="Out of"
                  className={SELECT_CLASS}
                />
              </div>
              <button
                type="button"
                disabled={mutatingGrade || !gradeStudentId || !gradeLabel.trim()}
                onClick={() => void handleRecordGrade()}
                className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
              >
                {mutatingGrade ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                Record grade
              </button>
            </>
          )}

          {gradesLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : grades.length > 0 ? (
            <ul className="divide-y divide-border/60 border-t border-border/60 pt-1">
              {grades.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-foreground/90">
                      {rosterNameById.get(g.userId) ?? "Former student"} — {g.label}
                    </span>
                    <span className="text-[10.5px] text-muted-foreground">
                      {g.score}/{g.maxScore} · {formatRelative(g.gradedAt)}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete grade: ${g.label}`}
                    disabled={mutatingGrade}
                    onClick={() => void handleDeleteGrade(g.id)}
                    className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between text-[10.5px] text-muted-foreground">
        <span>{formatMb(module.sizeMb)} total</span>
        <Link
          to="/courses/$moduleId"
          params={{ moduleId }}
          reloadDocument
          className="inline-flex items-center gap-1 text-prestige-mid hover:text-prestige-deep hover:underline"
        >
          View as a student would
          <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}
