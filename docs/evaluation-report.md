# eLearn (learn-seamless-flow) — System Evaluation Report

**Prepared for:** thesis evaluation chapter / progress report
**Researcher:** Joao Ndongala Nkunku
**Supervisor:** Dr Tendai Mataranyika
**Institution:** NUST — Faculty of Computing and Informatics
**Report date:** 2026-08-06
**Status:** technical evaluation complete (real data below); usability-study results section pending the real survey export — see the note in §5.

---

## 1. Introduction and purpose

This report evaluates **eLearn**, an offline-first Progressive Web App built to give NUST students low-data, offline-capable access to course materials, AI-generated summaries/quizzes/flashcards, and their real NUST eLearning (Moodle) course data. It combines two kinds of evidence, matching how the system was actually built and tested over its development history (see `DEV_LOG.md`, 84 logged features at the time of writing):

1. **Technical evaluation** — real, measured results from performance audits, a real-document extraction-accuracy corpus, accessibility audits, and real-device testing, gathered continuously during development rather than as a one-off exercise at the end.
2. **Usability evaluation** — an NUST ethics-approved study using a System Usability Scale (SUS) plus TAM/UTAUT-style perceived-usefulness and data-efficiency questionnaire, completed by real student users of the deployed app.

This document reports only what was actually measured. Where a result is not yet available, that is stated explicitly rather than estimated.

## 2. System overview

eLearn is a React 19 + TanStack Start/Router single-page application, deployed to Vercel, backed by Supabase (Postgres with row-level security, Auth, a secrets vault, and scheduled sync jobs). It integrates with NUST's real Moodle instance for course/grade/assignment data, and runs AI features (summarization, chat, quiz/flashcard generation) **on-device** by default via a WebAssembly model runtime, with an optional cloud fallback using a student's own free API key. Offline behaviour is provided by a service worker that caches the app shell, static assets, and previously-visited content, plus a local IndexedDB store that mirrors a student's downloaded course materials, progress, and AI-generated content.

The full current architecture — every component, which layer it runs in, and how data moves between them — is diagrammed in [`docs/architecture/system-architecture.drawio`](./architecture/system-architecture.drawio) (open in [app.diagrams.net](https://app.diagrams.net) or the draw.io desktop app; see `docs/architecture/README.md`). In summary, four layers:

- **Client device** — the React app, service worker, on-device AI worker, PDF/DOCX text extraction, and two local IndexedDB stores (device-wide settings/cache, and per-account downloaded content/progress).
- **Vercel deployment** — a Nitro serverless function handling server-rendering and server-side request handlers, plus static asset hosting.
- **Supabase backend** — Postgres (43 schema migrations), Auth, a secrets vault for user-supplied AI keys, and a scheduled job runner for Moodle sync.
- **External services** — NUST's Moodle instance, an optional third-party AI API, public AI-model hosting, and Google OAuth.

## 3. Evaluation methodology

### 3.1 Technical evaluation

Rather than a single end-of-project test pass, technical claims in this system were verified continuously against **real artifacts**, not synthetic stand-ins — a deliberate, consistently-applied project convention:

- **Extraction accuracy**: every fix to the PDF/DOCX text-extraction pipeline was re-verified against the growing real-document corpus in `TestDoc/` (55 real files as of this report — lecture PDFs, scanned documents, financial/legal documents, slide decks, Word documents — not synthetic test fixtures), uploaded through the actual running app.
- **Performance**: measured with Google Lighthouse against both a local production build (`NITRO_PRESET=node-server`, since the dev server does not represent real caching/bundling behaviour) and the live Vercel deployment, under real throttled-network profiles (Slow 3G, Fast 3G/Slow 4G), not assumed numbers.
- **Accessibility**: a manual WCAG 2.1 AA audit (semantic HTML, keyboard operability, colour contrast), with contrast ratios measured directly rather than eyeballed.
- **Offline/service-worker behaviour**: verified with Playwright's real network-condition emulation and, where that proved unreliable for worker-script fetches specifically, targeted request-blocking to force genuine failure conditions.
- **Real-device testing**: a standing checklist (`REAL_DEVICE_TESTING.md`) run on actual phones/PCs over real mobile data and Wi-Fi, covering install-to-home-screen, first-load timing, data usage on repeat visits, genuine offline access to downloaded content, and AI model download/chat behaviour — the one category of testing that cannot be simulated in a development sandbox.

### 3.2 Usability evaluation

An NUST ethics-approved study collects, after real usage of the deployed app:

- **Consent** — recorded per respondent, with an explicit choice to be identified (real name, and student number where applicable) or to stay anonymous.
- **System Usability Scale (SUS)** — the standard 10-item, 5-point Likert instrument, scored with the standard SUS algorithm (odd items scored `answer − 1`, even items scored `5 − answer`, summed and multiplied by 2.5 for a 0–100 score).
- **TAM/UTAUT-style perceived usefulness** (5 items) — covering ease of access, the offline download feature specifically, AI summary usefulness, download ease, and navigation clarity.
- **Data-efficiency & satisfaction** (5 items) — covering perceived data savings versus the standard Moodle site, practicality for limited-connectivity students, task success, likelihood to recommend, and overall satisfaction.
- **Open-ended questions** (3) — best feature, most difficult part, improvement suggestions.

This data is collected in-app and is visible only to super-admin accounts, at `/admin/super/research` (exportable as CSV from that screen).

## 4. Technical evaluation results

### 4.1 Extraction accuracy and robustness

The text-extraction pipeline (PDF via `pdfjs-dist` with layout-aware heading/list/table detection, OCR fallback via a self-hosted `tesseract.js` for scanned pages, DOCX via `mammoth`) was tested against the full real-document corpus at several points as it grew:

| Milestone | Corpus size | Result |
|---|---|---|
| Feature 65 baseline | 25 real files | All 25 extracted without errors or timeouts |
| Feature 66 | 25 real files | Zero thin/low-quality flashcard backs across all 25 documents' real extracted text, verified directly against Postgres |
| Feature 67–68 | 40 real files | Three real bugs found and fixed via full-corpus batch runs (scrambled reference sections, bare-digit numbered lists, a heading/bullet interaction bug) |
| Feature 69–70 | 40 real files | Partial, honestly-scoped fix for multi-column/infographic layouts; a real financial/legal-document row-numbering bug fixed |
| Current | 55 real files | Corpus continues to grow with each new real document type encountered (legal declarations, investment mandates, faculty documents, government ID scans) |

Each fix in this history was root-caused against the *specific* real document that exposed it (not a synthetic reproduction), then re-verified across the whole corpus to check for regressions — a pattern applied consistently rather than as a one-off audit.

### 4.2 Performance

A real Lighthouse audit (Moto G Power emulation, Slow 4G, mobile) on the live deployment's `/dashboard` initially returned:

| Metric | Before | After (2 rounds of real fixes) |
|---|---|---|
| Performance score | 25/100 | 32/100 |
| Accessibility score | 89/100 | 96/100 |
| Best Practices score | 77/100 | 96/100 |
| First Contentful Paint | 13.3s | 5.0s |
| Largest Contentful Paint | 24.6s | not re-measured directly, improved with FCP |
| Total Blocking Time | 15,960ms | 1,540ms (~10× reduction) |
| Speed Index | 33s | 18.6s |

Root causes found and fixed: (1) an eager route-precaching pass was competing with the current page's own render on every load — deferred to idle time and skipped entirely on `saveData`/slow connections; (2) the dashboard's server-rendered response was carrying every module's full extracted document text (187KB) when list views only needed ~5.4KB of metadata — a 34× payload cut for the server-rendered path specifically, while preserving the full-content client-side fetch that offline caching depends on.

Both rounds of fixes were validated against real, measured numbers (actual production bundle chunk sizes, an actual live Supabase query byte-count comparison) — not estimated. The remaining gap is attributed partly to genuine infrastructure overhead (a measured 4.3s Vercel cold-start TTFB vs ~0.9s warm) rather than assumed to be fully closeable in-app.

Separately, controlled throttled-network measurements against a local production build showed:

| Profile | Cold (first visit) | Warm (repeat visit) |
|---|---|---|
| Slow 3G (400kbps, 400ms latency) | ~19.6s, ~899KB | ~0.65s, ~0KB additional |
| Fast 3G / Slow 4G (1.6Mbps, 150ms latency) | ~5.3s, ~899KB | ~0.6s, ~0KB additional |

confirming the service worker's cache-first strategy for static assets genuinely eliminates repeat-visit data cost, which is directly relevant to the app's stated goal of reducing mobile-data usage for students versus the standard Moodle site.

### 4.3 Offline resilience

Real, Playwright-driven testing (not just code inspection) found and fixed two genuine offline-access gaps over the project's history: (1) navigating to any route not already cached under its own URL failed outright while offline, fixed by caching every successful navigation under a shell fallback key and proactively pre-seeding it; (2) a second downloaded PDF could fail to open offline in the same session because the PDF-rendering worker script's own file extension was missing from the service worker's cache-first pattern. Both were confirmed fixed against the exact failure conditions that exposed them, using targeted request-blocking (not just the network condition toggle, which was found not to reliably reach dedicated Worker script fetches in this environment).

### 4.4 Accessibility (WCAG 2.1 AA)

A manual audit covering semantic HTML, keyboard operability, and colour contrast found and fixed several real issues, including a desktop sidebar contrast ratio measured at 4.39:1 against the required 4.5:1 minimum (fixed by darkening the text token). Scope was deliberately limited to WCAG-specific requirements, with loading-state/error-message/confirmation-dialog work tracked and completed as separate, explicitly-scoped items rather than folded in under an "accessibility" label they don't belong under.

### 4.5 Real-device testing

A standing checklist (`REAL_DEVICE_TESTING.md`) was run against the live deployment on real phones/PCs, since this is the one category of testing a development sandbox cannot substitute for (no real hardware, real mobile data, or real airplane-mode toggle). This surfaced 6 real bugs in one round alone (Feature 61) that simulated testing had not caught, plus real, since-fixed issues in AI model download reliability on mobile (interrupted/failed downloads, a broken chat state after a failed download) and a real bug where an on-device AI feature falsely reported itself ready on an Android device.

### 4.6 Known, honestly-scoped limitations

- A "site crashes during AI download/use" report from real-device testing has not been reproduced despite repeated attempts in both simulated and real conditions — logged as open rather than assumed fixed.
- Quiz-generation timing per question has not been confirmed on real end-user hardware; a generation timeout was added as a safety net rather than a fix for the underlying speed.
- Production deployment access was blocked for a period by a Vercel Hobby-plan private-repository collaboration restriction (an account/billing constraint, not a code defect) — documented in `DEV_LOG.md` rather than worked around.

## 5. Usability study results

**Pending real data.** The consent/SUS/TAM-UTAUT/data-efficiency/open-ended responses live in Supabase (`research_consent`, `research_survey_responses`) and are visible only to super-admin accounts at `/admin/super/research`, which already has a working **Export CSV** button producing exactly the columns needed for this section (`anonymous_id`, `full_name`, `student_number`, consent fields, `sus_1`…`sus_10`, `tam_11`…`tam_15`, `data_16`…`data_20`, `continue_development_21`, `open_22`…`open_24`).

To complete this section:

1. Sign in as a super admin and open `/admin/super/research`.
2. Click **Export CSV**.
3. Share the exported file (or paste its contents) back into this conversation, or drop it at `docs/research-export.csv` in this repo.

Once available, this section will report: number of consent/survey responses; the standard 0–100 SUS score (mean, and the accepted "above/below 68 = above/below average usability" benchmark); TAM and data-efficiency category means; and a thematic summary of the open-ended responses, alongside 1–2 representative real quotes per theme (attributed only where a respondent chose to be identified).

## 6. Discussion

The technical evidence supports a system that works as designed for its core offline-first, low-data promise — verified with real measurements rather than assumed from the architecture alone — while being honest about where evidence is still incomplete (real-device AI stability, real quiz-generation timing) rather than treating "no reproduction yet" as "resolved." The usability evaluation (§5) is the piece that will most directly answer the thesis's actual research question — whether real students find the offline/AI approach usable and worth the tradeoff versus the standard Moodle experience — and should be prioritized for completion once real survey volume is sufficient to report meaningfully (check the response count before drawing conclusions from a very small sample).

## 7. Conclusion

*To be finalized once §5 is complete — the overall evaluation verdict should synthesize both the technical results above and the real usability-study findings, not be written from technical results alone.*

---

*Sources: `DEV_LOG.md` (features 1–84), `REAL_DEVICE_TESTING.md`, `supabase/migrations/0025_research_study.sql` and `0042`/`0043`, `src/lib/research-study.ts`, `src/components/ResearchSurveyModal.tsx`, `src/routes/admin.super.research.tsx`, `docs/architecture/`.*
