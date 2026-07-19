# Real-device testing checklist

Everything in this file has to be run by hand, on your own phone and PC — it's the one part of validation Claude can't do directly (no access to your hardware, your actual Wi-Fi/mobile data, or a real "airplane mode" toggle). Simulated versions of most of this were already run against a local production build (see DEV_LOG.md, Feature 29); this checklist is the real-world confirmation pass.

Use the live deployment for all of this: **https://learn-seamless-flow.vercel.app/**

## 1. Install to home screen (phone)

- [ ] Open the URL above in Chrome (Android) or Safari (iOS).
- [ ] Look for an "Add to Home Screen" / install prompt. A real 192×192/512×512 icon set now exists (Feature 42 — a designed wordmark, not a real logo file, since none was available), so this should look reasonable now rather than falling back to a blurry favicon — report exactly what you see either way.
- [ ] If it installs, confirm it opens in its own standalone window (no browser address bar), not just a bookmark tab.

## 2. First load timing — actually watch the clock

- [ ] On mobile data (not Wi-Fi), note how long the very first load takes before the login screen is usable.
- [ ] Compare against the simulated number: ~19.5s on a real "Slow 3G" throttle profile for ~900KB. Real mobile networks vary a lot — just sanity-check it's not wildly worse (e.g. 60s+) or suspiciously different from that.

## 3. Data usage — repeat visits should be nearly free

- [ ] Close the app/tab fully, reopen it, and reload the same page a couple of times.
- [ ] If your phone has a data-usage monitor (Android: Settings → Network → Data usage → per-app), check how much data the browser/app used for the *second and third* visits compared to the first. It should be dramatically less — the simulated test showed close to zero extra bytes on repeat visits (service worker cache-first for JS/CSS/fonts).

## 4. Offline — modules and downloaded content

Feature 29 found a real gap here (a downloaded module could still fail to open once genuinely offline); Feature 30 fixed it and it was re-verified against a real production build — but not yet against a real device, which is what this section is for.

- [ ] Sign in, download a module while online (tap "Get" on the module or on individual materials).
- [ ] **Without closing the tab**, turn on airplane mode, then tap into that same downloaded module and try to open a material. This is the best-case path.
- [ ] Now fully close the app/tab, stay in airplane mode, and reopen the app (tap the home-screen icon or reopen the URL). Try to reach the same downloaded module, and also try a module you *didn't* individually open before (just visiting `/dashboard` or `/courses` once while online should be enough to cache the whole catalog).
- [ ] **Expected now:** both should work — real module content, not an error screen, though it may take a few seconds to settle on the very first offline load after reopening. If you instead see "Something went wrong," that's a regression worth reporting clearly (which module, how long you waited).
- [ ] Report exactly what you see at each step — that detail matters more than a pass/fail.

## 5. PDF upload + extraction (needs a real file)

- [ ] Go to "My documents" and upload a real PDF from your phone/PC (lecture notes, a syllabus, anything with actual text — not a scanned image-only PDF, which won't extract text by design).
- [ ] Confirm the extracted text on the detail page actually matches the PDF's real content, not placeholder text — and that real headings/bullet lists in the source PDF show up as real formatting, not raw text.
- [ ] Tap "Summarise" and confirm the generated summary is coherent and actually about your document's content.
- [ ] Try a PDF over 25MB if you have one — confirm it's rejected with a clear message before it tries to process it, not a silent failure.
- [ ] Try the "library planner": create a collection, add a document to it, confirm it shows up there and not in the uncategorized list.

## 6. AI summary — first run download

- [ ] The neural summarizer model downloads once, in the background, the first time you use AI summaries on a given device. Note how long that first download takes on your actual connection, and whether the app clearly tells you it's downloading (vs. just looking stuck).
- [ ] Confirm summaries after that first download are fast (no repeat download).

## 7. Ask AI — on-device assistant, including its known offline gap

- [ ] Go to the "Ask AI" tab, download the assistant (a separate, smaller download from the summarizer, ~150-300MB depending on connection — genuinely takes a few minutes; watch for it switching to "Finishing up" near the end instead of just looking stuck).
- [ ] Ask a real question, confirm you get a real (if noticeably simple/limited) answer, not an error.
- [ ] Ask a follow-up that depends on the first message (e.g. "my name is ___, remember that" then "what's my name?") to confirm it's a real conversation, not a one-off Q&A.
- [ ] **Without closing the tab**, turn on airplane mode and ask another question — this should work, since the model stays loaded in memory for the rest of the session.
- [ ] Now fully close the app/tab, stay in airplane mode, and reopen it. Go to "Ask AI" and try asking something.
- [ ] **Known, unresolved gap going in:** simulated testing found this step sometimes fails ("The assistant couldn't respond") because the model's weight file didn't actually get saved for reuse — a real Chrome Cache API error, not something this app's code controls directly. If the download showed a small warning banner ("couldn't save the assistant for offline reuse") at the time, this failure is expected. If it *didn't* show that warning but this still fails, that's new information worth reporting — it would mean the detection itself is missing a case, not just the underlying caching gap.
- [ ] **If you've reported the app crashing or freezing during an AI download or while chatting (see DEV_LOG.md, Features 35/36):** this hasn't reproduced in simulated testing despite repeated real downloads and real conversations, but that testing can't see real device memory pressure the way your phone/PC can. If it happens again, please note exactly: which step (download vs. chatting), roughly how far into it, and what "crash" looked like — the whole tab/app closing, the page freezing but still there, or the browser itself warning about memory. That detail is what's currently missing to make progress on this.
- [ ] Also try the newer "Ask this collection" chat (My documents → open a collection with at least one document → "Ask this collection") — it shares the exact same on-device model and download as "Ask AI" above, so it's relevant to the same crash reports, just a different entry point worth covering too.

## 7b. Flashcards and quiz generation (Phase J)

- [ ] Open a document with real headings (My documents → upload a PDF with section headings, or open one already there), tap "Flashcards." This should be instant — no download, no wait. Confirm the cards' front/back make sense and flipping/Next/Previous work.
- [ ] On the same document, tap "Quiz" (needs the assistant downloaded first — same model as "Ask AI"). Time how long it actually takes to go from tapping "Quiz" to seeing "Submit quiz." **Simulated testing in this project's sandboxed dev environment found this took several minutes per question** — slow enough that it's unclear whether that's realistic for an actual phone/laptop or an artifact of the test sandbox specifically. Please report the real number, even a rough one — this directly decides whether the question count can go back up from 3.
- [ ] While a quiz is generating, check whether the rest of the app (scrolling, tapping other tabs) feels sluggish or genuinely frozen — this is worth knowing regardless of the exact timing.

## 8. General feel

- [ ] Note anything that feels janky, slow, or unclear on your actual device that wasn't obvious from a desktop browser — screen size, touch targets, keyboard behavior on forms, etc.
- [ ] The mobile bottom nav now has 6 items (Home, Library, Summaries, Ask AI, Progress, Profile) instead of 5 — check it doesn't feel cramped on a smaller phone screen.

---

Report back whatever you find, including things that don't match the "expected" notes above — those expectations are based on simulated testing, and real devices sometimes behave differently.
