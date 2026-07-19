
# eLearn — Mobile-first Learning Platform (v1 shell)

Build a beautiful, professional, mobile-first PWA-style learning app with the "Modular atelier" direction as the visual reference. All screens ship with realistic mock data. No emojis anywhere — icons are Lucide line icons only. No backend yet.

## Design system

Locked tokens carried into `src/styles.css`:
- Palette: deep emerald `#064e3b`, mid emerald `#0d7a5f`, gold `#c9a84c`, cream `#f5f0e0`, plus ink/foreground and muted tones derived from them (all oklch).
- Type: Sora (display) + Manrope (body), loaded via `<link>` in `__root.tsx` head.
- Radius scale, ring-based hairlines (`ring-1 ring-prestige-deep/10`), gold accent frame around featured cards, subtle cream/white cards.
- Semantic tokens: `--background` (cream), `--foreground` (deep emerald), `--card`, `--primary` (deep emerald), `--accent` (gold), `--muted`, `--border`.
- Global metadata in `__root.tsx`: title "eLearn — Learn Anywhere", proper description, og/twitter tags.

## Screens & routes

Flat file-based routes under `src/routes/`:

```text
/                      Onboarding (3-step carousel) → CTA to /dashboard
/dashboard             Home dashboard (index of learner shell)
/courses               Course library grid
/courses/$moduleId     Module detail (materials, AI summary, progress)
/courses/$moduleId/read/$docId    PDF-style reader (mock pages)
/summaries             All AI summaries feed
/progress              Progress & achievements
/profile               Profile & storage settings
```

The `/` placeholder is replaced with a 3-step onboarding that hands off to `/dashboard`. Each route sets its own `head()` (title + description + og).

## Shared layout

- `MobileShell` component: max-width 480px column on mobile, expands into sidebar + content on `lg:` for desktop. Bottom tab bar on mobile (Home, Library, Summaries, Progress, Profile — Lucide icons: `Home`, `BookOpen`, `Sparkles`, `BarChart3`, `User`), promotes to left sidebar on desktop.
- `TopBar`: greeting eyebrow ("Academic Dashboard") + name, avatar with emerald ring/gold hairline.
- `SectionHeader`: small caps eyebrow + Sora title + optional right-side action (gold-underlined link).

## Screen details

1. **Onboarding** — 3 slides (Offline learning / AI summaries / Track progress) with page dots, Skip + Next, using illustrative gold/emerald abstract shapes (no stock photos, no emoji). Final CTA → `/dashboard`.

2. **Dashboard** — matches the atelier prototype exactly:
   - Greeting header + avatar
   - 3 stat tiles (Modules, Notes, Rank) in cream/emerald tiles with ring hairlines
   - Featured "Continuing Now" card: deep emerald with gold hairline frame, gold play chip, progress bar
   - "Available Offline" list with download icon tiles, file size, `Get` button
   - Storage indicator (thin gold-on-emerald bar)

3. **Courses** — magazine editorial grid: one featured module hero at top, then 2-column card grid on mobile / 3-column on desktop. Each card shows faculty eyebrow, Sora title, chapter count, offline badge.

4. **Module detail** — hero (title, lecturer, gold rule), Materials list (slides/notes with size + download state), AI Summary card (deep emerald, gold-inset border, Regenerate + Copy actions using `RotateCw` / `Copy` icons), progress footer.

5. **Reader** — top bar with page indicator, mock long-form typography column (Sora headings, Manrope body), page-turn controls, floating "Summarize this page" gold button.

6. **Summaries** — chronological list of AI summaries, each a small card with source module eyebrow, first 3 lines, timestamp, copy action.

7. **Progress** — three panels: overall completion ring, per-module bars, weekly streak grid (7×N cells using emerald tints — no emoji).

8. **Profile** — avatar + name header, storage usage panel with gold progress, list rows (Downloads, Sync, Appearance, Sign out) using Lucide icons and gold chevrons.

## Icons

Strictly Lucide line icons at `strokeWidth={1.75}`. Curated set: `Home`, `BookOpen`, `Sparkles`, `BarChart3`, `User`, `Download`, `Play`, `RotateCw`, `Copy`, `ChevronRight`, `Search`, `Menu`, `Cloud`, `CheckCircle2`, `FileText`, `Bookmark`, `Settings`. No emoji glyphs in code or copy.

## Mock data

Single `src/lib/mock-data.ts` exporting typed arrays for modules, materials, summaries, downloads, progress, streak — reused across routes so numbers stay coherent.

## Motion

Light, tasteful: fade-up on section reveal (200ms stagger), gold underline on link hover, subtle `active:scale-[0.98]` on tap targets. No parallax, no showy hero animation.

## Responsive

- Mobile (base): single column, bottom nav, max-width 480px centered on tablet.
- `lg:` (≥1024px): promote bottom nav to a fixed left sidebar (240px), place featured hero + stats + downloads in a 2-column magazine grid, sticky right rail for storage + streak on `/dashboard`.
- All rows follow the grid+`min-w-0`+`shrink-0` responsive pattern for header text/icon combos.

## Technical notes (for the developer)

- Update `src/styles.css` to add prestige tokens under `@theme inline` and remap `--background`/`--foreground`/`--primary`/`--accent`/`--card`/`--border` to them so shadcn components inherit the palette.
- Add font `<link>` tags in `src/routes/__root.tsx` head; register `--font-sora` and `--font-manrope` in `@theme`.
- Replace `src/routes/index.tsx` with the onboarding component; do not create a sibling. Route to `/dashboard` on completion.
- Use TanStack Router `<Link>` everywhere; no `<a href>` for internal nav.
- Each new route file sets `head()` with route-specific title + description.
- No Supabase / Lovable Cloud in v1 (mock data only). Auth, sync, and real PDFs are out of scope for this plan.

## Out of scope (later phases)

Real auth, real backend, IndexedDB caching, service worker + PWA manifest, real PDF.js reader, on-device summarization model, sync API. All designed for but not built in v1.
