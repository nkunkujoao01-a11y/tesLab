# Architecture & UI diagrams

Two [draw.io](https://app.diagrams.net) files documenting **learn-seamless-flow ("eLearn") as it currently exists** — not a proposal. Use them as the shared baseline when planning changes: annotate a copy, or use File → Save As to branch off a redesign.

## Files

- **`system-architecture.drawio`** — one-page diagram of the current system, laid out in four color-coded horizontal layers (client / Vercel edge / Supabase backend / external services). Uses distinct shapes by convention — actor for the end user, cylinders for databases, hexagons for background workers/schedulers, clouds for third-party services, rounded rectangles for application components — and 25 arrows color-coded by flow type (auth, content/browsing, offline storage, AI processing, sync & Moodle integration) rather than by layer, so you can trace one kind of data movement across the whole system at a glance. Includes a legend explaining both the shape and color conventions.
- **`architecture-design-prompt.md`** — a ready-to-paste prompt for handing this same architecture to another AI/design tool to produce a polished visual render, if you want something beyond draw.io's own look.
- **`wireframes.drawio`** — a 9-tab file, one tab per core screen (Auth, Dashboard, Library/Module detail, Reader, Quiz & Flashcards, Assistant/Chat, Documents, Profile, Settings). Desktop layout only, low-fidelity (gray boxes + labels, no real styling), each built from the actual component structure in `src/routes/` and `src/components/` rather than generic mockups. Mobile is a known collapse of the same content (sidebar → bottom tab bar); it isn't drawn separately.

## Opening them

Both are plain [mxGraph XML](https://www.diagrams.net/) with a `.drawio` extension — no import/conversion needed:

- **draw.io desktop app**: File → Open → pick the file.
- **[app.diagrams.net](https://app.diagrams.net)** (browser, no account needed): File → Open from → Device.
- **VS Code**: the "Draw.io Integration" extension opens `.drawio` files directly in the editor.

`wireframes.drawio`'s 9 screens are separate pages — use the tab strip at the bottom of the draw.io window to switch between them.

## Keeping these current

These are a snapshot as of **2026-08-06**. The codebase is under active development (see `DEV_LOG.md`) — re-derive or hand-edit these diagrams when a change meaningfully alters a layer (e.g. a new backend service, a new core screen) rather than assuming they stay accurate indefinitely.
