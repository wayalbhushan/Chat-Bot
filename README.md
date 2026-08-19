# Chat Interface

A responsive, accessible chat interface built for the Darwix AI frontend assessment.

**Live demo:** https://chat-bot-ecru-gamma.vercel.app/
**Repository:** https://github.com/wayalbhushan/Chat-Bot

The demo opens with a short seeded conversation. Use the **10k demo** button in the header to load 10,000 messages and inspect scrolling and rendering performance.

---

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

Node 20.19+ or 22.12+ (Vite 8's requirement). Developed on Node 22.20.

---

## Stack

| Choice | Why |
| --- | --- |
| React 18 + TypeScript | Typed message and action unions caught several state bugs at compile time |
| Vite | No SSR or routing requirement; fastest dev loop |
| Tailwind CSS v4 | Consistent spacing and type scale without a separate design system |
| react-virtuoso | Variable-height virtualization, discussed below |
| lucide-react | Consistent monochrome icon set |

Four runtime dependencies total: `react`, `react-dom`, `react-virtuoso`, `lucide-react`. Nothing else was added.

---

## Architecture decisions

### Virtualization: react-virtuoso

Chat messages are variable height, which rules out the simplest options.

- **No virtualization** — fails the large-dataset requirement outright.
- **react-window** — smallest bundle, but assumes fixed row heights. Variable heights require `VariableSizeList` plus a manual measurement cache and `resetAfterIndex` calls on every mutation.
- **TanStack Virtual** — handles dynamic measurement well, but is headless: scroll anchoring, stick-to-bottom, and away-from-bottom detection are all left to the caller.
- **react-virtuoso** — measures variable heights automatically and exposes the scroll-position callbacks this UI needs.

**Trade-off:** a heavier dependency in exchange for correctness on the most failure-prone interaction in a chat UI. Given that scroll anchoring still produced four separate bugs during this build (see Verification), the trade was worth it.

### Scroll anchoring: a single owner

Two mechanisms competing for scroll position was the root cause of repeated bugs. Virtuoso's `followOutput` scrolls to the last row's edge *before* that row is measured, landing short; that short landing then emits a scroll event past the at-bottom threshold, which disabled the corrective pin permanently. The symptom only appeared during message bursts, when `followOutput` fires repeatedly.

Current implementation:

- `followOutput={false}` — Virtuoso does not manage scroll position.
- A `ResizeObserver` on the rendered list pins to the bottom, firing *after* layout when heights are real.
- The pin is gated on live scroll position rather than Virtuoso's `atBottom` flag, so a single short landing cannot latch it off.
- `initialTopMostItemIndex` is frozen at its first non-empty value. Virtuoso reads it only at mount, so recomputing it on every message meant a moving prop fighting its own scroll position.

### State: `useReducer` + split contexts

One message array and three flags. A state management library would be over-engineering at this scale.

`ChatStateContext` and `ChatDispatchContext` are separate so the composer does not re-render on every incoming message. With virtualization only ~10–15 rows are mounted, so context re-render cost is bounded regardless.

Messages carry `status: 'sending' | 'sent' | 'failed'`, which is what makes retry, the typing indicator, and crash recovery straightforward rather than special-cased.

### Persistence: localStorage

- **localStorage** — synchronous, ~5MB, string-only. Sufficient here.
- **IndexedDB** — effectively unlimited but needs a wrapper or significant boilerplate. Not justified at this scale.
- **Mock service worker** — more realistic, but adds a service worker and deployment surface for no evaluable gain.

Implementation notes:

- Writes debounced 500ms. Synchronous writes on every message would block the main thread and undermine the app's own performance goals.
- `QuotaExceededError` is caught; the most recent 500 messages are retained and the write retried once.
- Corrupt or wrong-shaped stored data loads as empty rather than throwing.
- `'sending'` is never written to disk — it is coerced to `'failed'` on write. A persisted `'sending'` would be unrecoverable, since the promise it awaited died with the tab. Storing it as `failed` makes it the one state the user can act on.
- The 10,000-message demo dataset is never persisted.

### Simulated backend

`src/lib/mockApi.ts` is the single seam where a real API would be substituted. Failure rate and latency bounds are named constants rather than inline magic numbers.

- Send: 400–900ms latency, 5% failure rate — low enough not to interrupt a demo, high enough that the failed state and its retry are reachable by hand.
- Bot reply: 800–1500ms latency, drawn from a small array of canned responses.
- Failed sends surface an inline error with a Retry control. Retry is user-initiated only — no auto-retry, no backoff.
- Bot replies are serialized to preserve ordering and typing-state correctness; a burst drains sequentially rather than in parallel.

### Accessibility: live region placement

`aria-live` is deliberately **not** on the virtualized list. Virtuoso mounts and unmounts rows during scroll, so a live region there would announce old messages as if they were new — worse than no live region at all.

Instead:

- A separate visually-hidden `aria-live="polite" aria-atomic="true"` region holds only the newest state change.
- The list container carries `role="log"` and `aria-live="off"`.
- Verified: scrolling the entire 10k list leaves the live region's content byte-identical.

---

## Features

**Layout** — header, virtualized scrollable log, fixed composer. `100dvh` rather than `100vh` so the mobile keyboard cannot push the composer off screen.

**Messages** — distinct user and bot styling, bot icon, consecutive same-sender messages grouped, relative timestamps with full detail on hover via `<time dateTime>` and `title`.

**Composer** — auto-growing textarea capped at 160px then internal scroll, Enter to send, Shift+Enter for newline, newline-on-Enter at coarse-pointer widths, 4000-character cap with a counter past 3500, disabled on empty input.

**Scroll** — opens at the newest message, stays pinned when at the bottom, never moves the viewport when the user has scrolled up, unread pill with count when messages arrive while scrolled away.

**Errors** — failed messages remain in place with an inline "Not delivered" state and Retry. Retry preserves position and identity.

**Persistence** — history restores on reload, inline two-step confirm for clearing.

**Accessibility** — skip link, full keyboard operation, `<article>` per message with a labelled sender and timestamp, focus moved to the composer after Retry, Escape clears the draft, visible focus rings throughout.

---

## Verification

Eight scripts in `scripts/verify/` drive a real Chromium instance via Playwright. Each has a header stating its prerequisites; all eight run green from a clean checkout.

`composer-sends.mjs` drives sends through the composer UI — real per-character typing and Enter presses — rather than through state. That distinction matters: setting the input value in one shot skips the auto-grow height changes that a person triggers, and it hid a real bug (below).

Playwright is intentionally **not** a dependency, to keep `npm install` from pulling ~300MB of browser binaries. Install it separately:

```bash
npm install --no-save playwright
npx playwright install chromium
node scripts/verify/<script>.mjs
```

### Measured results

**Virtualization at 10,000 messages**

| Metric | Value |
| --- | --- |
| `<article>` elements rendered | 9 at rest, 15 mid-list |
| Total DOM nodes | 132 |
| Virtual scroll height | 611,052px |

The count is 9–15 rather than higher because the seed includes ~1,600-character messages rendering ~500px tall, so fewer rows fill the viewport.

**Scroll behaviour** — opens at newest (gap 0); appending while scrolled up leaves `scrollTop` unmoved; unread pill shows a correct count and clears on click; sending at bottom and 20-message bursts both settle at gap 0 with no pill.

**Frame timing** — 0 frames over 50ms under realistic wheel scrolling. A synthetic teleport stress test (60 jumps of 10,000px) ranges 0–7 depending on machine load; the wheel figure reflects real use.

**Mock API over 2,000 calls** — observed failure rate matched the declared constant to within 0.002 when measured at 0.15; latencies within declared bounds.

**Burst integrity** — 20 rapid sends: 0 messages lost, 0 duplicate IDs, 0 stuck in `sending`, exactly one bot reply per successful send and none for failures.

**Persistence** — verified across fresh load, restore, corrupt JSON, valid-JSON-wrong-shape, mid-send crash recovery, clear, and a forced `QuotaExceededError` (4.4MB of junk, 2,000 messages attempted, exactly 500 retained, no throw).

**Contrast** — measured by rasterizing each colour to sRGB pixels. Body text, timestamps, placeholder, header text and controls range from 7.58:1 to 17.83:1. The three lowest are white-on-blue-600 at 5.25:1, the Retry link at 5.25:1, and the "Not delivered" red at 4.77:1. WCAG AA requires 4.5:1, so everything clears with margin. Typing indicator dots sit at 4.35:1 against WCAG 1.4.11's 3:1 requirement for graphical state indicators.

**Height-change seam** — retry at the bottom keeps the list pinned (gap 0); the typing footer being replaced by a reply never moves the viewport at 10k (max gap 0 sampled over six seconds); resizing 1440→375→1440 while parked at the bottom holds gap 0 throughout.

**Responsive** — 320/375/768/1024/1440px: no horizontal scroll, header holds at 56px, header controls are 44×44 and 83×44, composer caps correctly at 320px with 12 lines of input.

### Bugs found by measurement

Six scroll bugs and four measurement bugs surfaced during this build. Each was found by instrumented measurement rather than visual inspection.

- **"Jump to latest" stopped 103px short and never cleared the pill.** The pill's handler had two paths: long jumps settled onto the scroller's true bottom, short ones aligned the last row's edge — leaving the footer below the fold, past the at-bottom threshold, every time. Only the long path had ever been tested, because the test always clicked from mid-list of 10,000. The short path now animates the scroller to its own bottom and settles there. The test covers 400px, 900px and 1600px as well as the long jump.
- **The composer pushed the newest message out of view while typing.** The bottom-pin observed the rendered list and the typing footer — both *inside* the scroller. The composer sits outside it, so growing the textarea to five lines took 81px of client height from the scroller without changing any observed element: the observer never fired, `scrollTop` never moved, and the gap crossed the at-bottom threshold mid-sentence, raising an unread pill before Enter was ever pressed. The scroller is now observed too. This survived every earlier script because they set the input value in one shot and only sampled *after* send, when the box had already reset to 40px.
- **Two owners of scroll position** (described above). Only appeared under bursts, and adding console logging perturbed timing enough to hide it — the scripts caught what tracing could not.
- **Unread count could never clear.** After a pill jump the list settled 95px from the bottom, just past an 80px threshold. `align: 'end'` stops at the last row's edge, leaving the footer below the fold. Without unread messages present it landed at 75px and appeared fine — a 15px margin between working and permanently stuck.
- **Smooth scroll could not converge across 10,000 rows.** Unrendered rows are height-estimated, so `scrollHeight` grew as rows were measured and the target receded faster than the animation closed.
- **Unread badge counting the user's own messages** — a burst of 20 ended 1,563px short showing "22 new messages".
- **Two verification scripts were silently passing.** One reported virtualization PASS while measuring a 15-message seed after the demo seed changed underneath it. Both now load the 10k dataset through the UI themselves. A green check that proves nothing is worse than no check.
- **Contrast measurement was wrong on the first pass.** Tailwind v4 emits `oklch()`, which `getComputedStyle` returns verbatim; a naive parser read those three values as RGB and reported the bot bubble at 1.1:1. Caught because the number was implausible, then rebuilt by rasterizing each colour to real sRGB pixels.
- **The contrast script hardcoded a colour it was supposed to measure.** Placeholder contrast was pinned to slate-500's literal `oklch()` value, so after the palette was darkened it kept reporting the old 4.76:1 while every sibling moved to 7.58:1. It now reads `::placeholder` from the live element. The app was correct; the measurement was stale.

One accessibility issue found the same way: Virtuoso's scroller is focusable, correctly, but its accessible name was the run-together text of every rendered message. It now carries an explicit label.

---

## Known limitations

**Simulated backend.** No network layer. Bot replies are canned strings, not generated.

**Serialized bot replies.** Replies queue rather than run in parallel, preserving ordering and typing-state correctness. A 20-message burst therefore drains over ~18 seconds.

**Storage ceiling.** localStorage holds roughly 5MB, about 20–30k short messages. Beyond that, IndexedDB with paged loading would be required.

**Resize while scrolled into history drifts reading position.** Scroll offset is preserved, but narrower viewports make rows taller, so the visible message shifts by roughly four positions. Resizing while at the bottom stays pinned correctly, and resizing back restores the original position exactly. The fix is to capture and restore the top visible index across a resize; deferred.

**Retry of a row above the viewport is untested.** The test placed the failed message at index 72 of 80 while scrolled to the bottom, so it was on screen. The numbers were clean but do not test the stated case.

**Screen reader testing not performed.** Live-region behaviour was verified structurally — one visually-hidden `aria-live="polite"` region, `role="log"` with `aria-live="off"` on the list, and scrolling the full 10k list leaves the region's content byte-identical — but no NVDA or VoiceOver pass has been run, so what a screen reader actually announces is unconfirmed.

**No physical device testing.** Layout was verified via Chromium emulation at 320–1440px, including the composer growing to its 160px cap at 320px without displacing the message list. It has not been opened on a physical iOS or Android device, so the mobile keyboard interaction with `100dvh` is reasoned rather than observed.

**No automated test suite.** Verification is the eight Playwright scripts above, which cover behaviour rather than units.

---

## With more time

- Real backend with optimistic updates and reconciliation.
- IndexedDB with paged history loading.
- Re-anchoring scroll to the top visible index across resize.
- Unit tests around the reducer, alongside the existing behavioural scripts.
- Message search across long histories.
