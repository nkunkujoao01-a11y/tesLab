# Prompt: render a polished system-architecture diagram

Paste everything below into an AI design/diagramming tool (e.g. an image-generation model, a "diagram from text" tool, or another LLM you'll ask to produce SVG/HTML) to get a more polished visual than the draw.io export. It describes the same architecture as `system-architecture.drawio` — use that file as the ground truth if the two ever disagree.

---

## Task

Design a single, professional **system architecture diagram** for a software product called **eLearn (learn-seamless-flow)** — an offline-first Progressive Web App for university students. The diagram must be immediately legible to both engineers and non-technical stakeholders (lecturers, university IT). It will be used in planning documents and slide decks.

## Hard style rules (do not deviate)

- **No emoji, no clipart, no photorealistic imagery, no glossy/3D/skeuomorphic effects.** Flat, modern, vector-style only.
- Use exactly **five shape types**, applied consistently by meaning (a shape legend is required — see below):
  - **Rounded rectangle** — an application/service component (e.g. "React App", "Nitro Serverless Function").
  - **Hexagon** — a background worker or scheduled/automated process (e.g. "Service Worker", "AI Worker", "pg_cron").
  - **Cylinder** — a database or persistent storage layer (e.g. "Postgres", "Dexie IndexedDB").
  - **Cloud outline** — an external third-party service reached over the network (e.g. "Google Gemini API", "Hugging Face", "NUST Moodle").
  - **Simple person/actor icon** (plain geometric outline, not a photo or emoji) — the end user, placed once at the top of the diagram as the entry point.
- **Every arrow must have a clear arrowhead and a short label** describing what moves along it (e.g. "sign in", "extracted text stored", "SSR data fetch"). No unlabeled connectors.
- **Route connectors orthogonally (right-angle bends) or with gentle curves — minimize line crossings.** Where two components are logically close, place them physically close so their connector is short and direct. This is the single most important quality bar: a viewer should be able to follow any one arrow from source to destination without their eye getting lost in a tangle of lines.
- **Color has exactly two jobs, and they must not be confused:**
  1. **Background fill of each layer band** (a light, low-saturation tint) indicates *where a component runs*.
  2. **Arrow stroke color** indicates *what kind of data is moving*, independent of which layer it crosses.
  A legend must map both systems explicitly (see Legend section).
- **Typography**: one clean sans-serif family throughout (e.g. Inter, Helvetica, or Roboto). Title 24–28px bold. Layer band titles 14–16px bold, uppercase, letter-spaced. Component labels 11–13px, regular/medium weight, max 3 short lines each (name + 1–2 line description/file reference). Never shrink text to illegible size to fit — widen the shape instead.
- **Generous whitespace.** Pad every shape at least 20px from its neighbors and from its layer band's edge. Do not let shapes touch or overlap.
- **Flat fills only** — no gradients, no drop shadows, no bevels. A 1–2px solid stroke per shape is enough definition.
- Output as a **wide landscape canvas**, roughly **1920×1600px** (or proportional), on a plain white or very light-gray background — must look correct printed in black-and-white too, so don't rely on color alone (shape already carries meaning redundantly).

## Layout

Four horizontal layers/bands, stacked top to bottom in this exact order, each a full-width bounded region with its own light background tint and a bold label in its top-left corner:

1. **CLIENT DEVICE — Browser / Installed PWA** (tint: soft blue, e.g. `#EAF2FB` fill / `#3E6FA8` stroke)
2. **VERCEL DEPLOYMENT — Nitro Serverless** (tint: soft green, `#E7F6EF` / `#2F8F5B`)
3. **SUPABASE BACKEND** (tint: soft purple, `#F1EAFB` / `#6E43A8`)
4. **EXTERNAL SERVICES** (tint: soft amber, `#FCF1E3` / `#B9791F`)

Place a single **person icon labeled "Student / Lecturer"** above layer 1, as the diagram's single entry point — the only element outside the four bands.

Below the four bands, include a **Legend** panel (same width as the bands, white background, thin border) with two columns: a **Shapes** key (one row per shape type above, with a 1-line meaning) and a **Data flow** key (one colored line sample per flow category below, with its label).

## Components (place inside the matching layer, group related ones close together to keep arrows short)

**Layer 1 — Client device:**
- React 19 App (TanStack Start/Router) — rounded rectangle
- shadcn/ui + Tailwind component library — rounded rectangle
- Service Worker (cache-first assets, route precache, background download support) — hexagon
- On-device AI Worker (runs local summarization/chat models) — hexagon
- PDF/DOCX text extraction (+ OCR fallback for scanned pages) — rounded rectangle
- Local device-wide storage (settings, catalog cache, in-progress downloads) — cylinder
- Local per-account storage (downloaded content, progress, personal documents, AI-generated outputs, cached course data) — cylinder

**Layer 2 — Vercel deployment:**
- Serverless function (server-side rendering + server-side request handlers) — rounded rectangle
- Static asset bucket (compiled JS/CSS/app-icon files) — rounded rectangle
- Scheduled-sync webhook endpoint — rounded rectangle

**Layer 3 — Supabase backend:**
- Authentication service (email/password, Google sign-in, institution ID login) — rounded rectangle
- Postgres database with row-level security (the primary relational data store) — cylinder
- Secrets vault (encrypts user-supplied API keys) — rounded rectangle
- Scheduled job runner (triggers periodic external sync) — hexagon

**Layer 4 — External services:**
- University learning-management system (course/grade/assignment source) — cloud
- Third-party generative-AI API (optional, user-supplied key) — cloud
- Public model-weight hosting (source for downloadable on-device AI models) — cloud
- OAuth identity provider — cloud

## Data flows (draw each as one labeled arrow; group by color)

**Authentication flow — purple `#8E44AD`:**
1. Person → React App: "opens app"
2. React App → Authentication service: "sign in"
3. Authentication service → OAuth identity provider: "OAuth handshake"
4. Authentication service → University LMS: "institution ID login"

**Content/browsing flow — blue `#2E75B6`:**
5. React App → Serverless function: "page load"
6. Serverless function → Postgres: "server-side data fetch"
7. React App → Postgres: "direct client queries"
8. React App → device-wide storage: "cache catalog for offline browsing"

**Offline storage flow — green `#2E7D32`:**
9. React App → per-account storage: "save downloads, progress, generated content"
10. PDF/DOCX extraction → per-account storage: "store extracted text"
11. React App → Service Worker: "register + trigger precache"
12. Service Worker → device-wide storage: "persist in-progress model downloads"

**AI processing flow — orange `#E07B00`:**
13. React App → On-device AI Worker: "summarize / chat / generate quiz"
14. On-device AI Worker → public model-weight hosting: "download model weights (first use only)"
15. React App → third-party generative-AI API: "optional cloud request, falls back to on-device on failure"

**Sync & integration flow — teal `#00838F`, dashed:**
16. Per-account storage ↔ Postgres: "two-way sync, most-recent-change wins"
17. Scheduled job runner → scheduled-sync webhook endpoint: "trigger sync"
18. Scheduled-sync webhook endpoint → University LMS: "pull latest courses/grades"
19. Scheduled-sync webhook endpoint → Postgres: "write synced data"
20. Postgres → per-account storage: "mirror synced data for offline viewing"

## Title block

Top-left of the canvas: **"eLearn — System Architecture"** as the main title, with a one-line subtitle underneath: *"Offline-first learning app · web client + serverless backend + institutional/AI integrations."* Keep this generic/product-level — do not name specific vendors in the title itself, only inside the diagram body.

## What "done" looks like

A viewer with no prior context should be able to: (1) find the single entry point (the person icon), (2) follow any one colored flow top-to-bottom without ambiguity, (3) tell at a glance which of the four environments any given component runs in purely from its band, and (4) understand every shape and color without needing to ask a question — because the legend already answered it.
