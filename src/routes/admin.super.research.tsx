import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { formatRelative } from "@/lib/mock-data";
import {
  useResearchSubmissions,
  useAnonymousSuggestions,
  type ResearchSubmission,
} from "@/hooks/use-platform-analytics";
import { buildCsv } from "@/lib/csv-export";
import { downloadBlob } from "@/lib/structured-export";

export const Route = createFileRoute("/admin/super/research")({
  component: SuperAdminResearchPage,
});

function scaleAverage(answers: Record<number, number>): string {
  const values = Object.values(answers);
  if (values.length === 0) return "N/A";
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

// One row per anonymous_id, every question flattened into its own column
// — the raw shape someone presenting this study's results would actually
// want (open in a spreadsheet, compute your own aggregates), not just the
// on-page averages.
const SUS_NUMS = Array.from({ length: 10 }, (_, i) => i + 1);
const TAM_NUMS = Array.from({ length: 5 }, (_, i) => i + 11);
const DATA_NUMS = Array.from({ length: 5 }, (_, i) => i + 16);
const OPEN_NUMS = [22, 23, 24];

function exportSubmissionsCsv(submissions: ResearchSubmission[]) {
  const headers = [
    "anonymous_id",
    "consent_agreed",
    "consent_responded_at",
    "survey_submitted_at",
    ...SUS_NUMS.map((n) => `sus_${n}`),
    ...TAM_NUMS.map((n) => `tam_${n}`),
    ...DATA_NUMS.map((n) => `data_${n}`),
    "continue_development_21",
    ...OPEN_NUMS.map((n) => `open_${n}`),
  ];
  const rows = submissions.map((s) => [
    s.anonymousId,
    s.consent ? (s.consent.agreed ? "yes" : "no") : "",
    s.consent?.respondedAt ?? "",
    s.surveySubmittedAt ?? "",
    ...SUS_NUMS.map((n) => s.survey?.sus[n] ?? ""),
    ...TAM_NUMS.map((n) => s.survey?.tam[n] ?? ""),
    ...DATA_NUMS.map((n) => s.survey?.dataEfficiency[n] ?? ""),
    s.survey?.continueDevelopment ?? "",
    ...OPEN_NUMS.map((n) => s.survey?.openEnded[n] ?? ""),
  ]);
  const csv = buildCsv(headers, rows);
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `research-consent-survey-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

function SuperAdminResearchPage() {
  const { submissions, loading } = useResearchSubmissions();
  const { suggestions, loading: suggestionsLoading } = useAnonymousSuggestions();
  const consentCount = submissions.filter((s) => s.consent).length;
  const agreedCount = submissions.filter((s) => s.consent?.agreed).length;
  const surveyCount = submissions.filter((s) => s.survey).length;

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Super admin</p>
          <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-prestige-deep">
            Research data
          </h1>
        </div>
        <button
          type="button"
          disabled={submissions.length === 0}
          onClick={() => exportSubmissionsCsv(submissions)}
          className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-3.5 py-2 text-xs font-semibold text-prestige-cream transition-transform active:scale-[0.97] disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2} />
          Export CSV
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        NUST ethics-approved usability study. Collected anonymously, grouped below by a per-device
        random id ("User_XXXX"), not a real identity. Two students sharing a device could
        coincidentally share one id, so this pairing is best-effort, not a guaranteed one-to-one
        match. There is no name/email column here; none exists to show.
      </p>

      <div className="mb-6 mt-5 grid grid-cols-3 gap-3">
        <div className="animate-rise rounded-2xl bg-card p-4 ring-1 ring-border/60">
          <p className="text-[11.5px] text-muted-foreground">Consent responses</p>
          <p className="mt-2 font-display text-[22px] font-medium tabular-nums text-prestige-deep">
            {consentCount}
          </p>
        </div>
        <div className="animate-rise rounded-2xl bg-card p-4 ring-1 ring-border/60">
          <p className="text-[11.5px] text-muted-foreground">Agreed</p>
          <p className="mt-2 font-display text-[22px] font-medium tabular-nums text-prestige-deep">
            {agreedCount}
          </p>
        </div>
        <div className="animate-rise rounded-2xl bg-card p-4 ring-1 ring-border/60">
          <p className="text-[11.5px] text-muted-foreground">Survey responses</p>
          <p className="mt-2 font-display text-[22px] font-medium tabular-nums text-prestige-deep">
            {surveyCount}
          </p>
        </div>
      </div>

      <div className="animate-rise overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
        {!loading && submissions.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No research submissions yet.
          </p>
        )}
        {submissions.map((s) => (
          <div
            key={s.anonymousId}
            className="border-b border-border/60 px-4 py-3.5 last:border-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-prestige-deep">{s.anonymousId}</p>
              {s.consent && (
                <span
                  className={
                    s.consent.agreed
                      ? "rounded-full bg-prestige-deep/5 px-2 py-0.5 text-[10px] font-medium text-prestige-mid"
                      : "rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive"
                  }
                >
                  {s.consent.agreed ? "Agreed" : "Declined"} ·{" "}
                  {formatRelative(s.consent.respondedAt)}
                </span>
              )}
            </div>
            {s.survey && (
              <div className="mt-2 grid grid-cols-3 gap-3 text-[11px] text-muted-foreground">
                <span>SUS avg {scaleAverage(s.survey.sus)}/5</span>
                <span>TAM avg {scaleAverage(s.survey.tam)}/5</span>
                <span>Data avg {scaleAverage(s.survey.dataEfficiency)}/5</span>
              </div>
            )}
            {s.survey && Object.values(s.survey.openEnded).some((v) => v.trim()) && (
              <div className="mt-2 space-y-1">
                {Object.entries(s.survey.openEnded)
                  .filter(([, v]) => v.trim())
                  .map(([n, v]) => (
                    <p key={n} className="text-[11.5px] italic leading-relaxed text-foreground/80">
                      "{v}"
                    </p>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {loading && <p className="mt-4 text-center text-xs text-muted-foreground">Loading…</p>}

      {/* Anonymous suggestions — a separate, always-open channel (Profile
          > Anonymous suggestion), not part of the one-time study above,
          same anonymous-by-design framing (no name/email column here
          either). */}
      <h2 className="mt-10 font-display text-lg font-medium text-prestige-deep">
        Anonymous suggestions
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sent any time from Profile, not tied to the research study above.
      </p>
      <div className="animate-rise mt-4 overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
        {!suggestionsLoading && suggestions.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No anonymous suggestions yet.
          </p>
        )}
        {suggestions.map((s, i) => (
          <div key={i} className="border-b border-border/60 px-4 py-3.5 last:border-none">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10.5px] font-medium text-prestige-mid">{s.anonymousId}</p>
              <p className="text-[10.5px] text-muted-foreground">{formatRelative(s.submittedAt)}</p>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{s.message}</p>
          </div>
        ))}
      </div>
      {suggestionsLoading && (
        <p className="mt-4 text-center text-xs text-muted-foreground">Loading…</p>
      )}
    </div>
  );
}
