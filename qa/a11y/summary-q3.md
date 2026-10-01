I ran the full a11y/weak-phone audit across all 18 built sections of booking-platform.

## Method
Playwright + CDP: 360×740 phone, CPU throttling ×4, slow network (~400/200 kbit/s, 300ms latency), dark theme, two passes per route — `ru`/normal font and `hy`/`font=large`. Measured FCP, full-load time, long tasks, CLS, horizontal overflow, tap targets <44px, unlabeled icon buttons, heading order, WCAG AA contrast (computed-style heuristic), keyboard focus visibility, JS weight, truncated text. Script: `/Users/arsen/WebstormProjects/booking-platform/qa/a11y/_probe-q3.mjs`.

**Coverage: 94 routes × 2 passes = 188 measures, 188 successful, 0 errors** (all 18 sections, excluding `/dev/ext/*` internal extension hosts).

Mid-run the dev server went unreachable (`ERR_CONNECTION_REFUSED`) for ~46 routes for about 7 minutes — someone else's edit broke the build momentarily (matches CONVENTIONS §0.1). I didn't touch the server; it recovered on its own, and I re-ran the script (it resumes from `raw.json`, skipping already-succeeded measures) to fill the gap. 4 more measures landed on a live compile error and are flagged `†` as invalid (not real perf numbers).

## Headline numbers (vs q1/q2)
- FCP mean (clean): **3.6s** (q1: 3.3s, q2: 5.9s) — best of the three rounds
- FCP worst case (clean): **5.5s** (q1: 11.7s, q2: 22.6s)
- Load (DCL+load+1.2s), mean: **~29.8s** — flat vs prior rounds; verified manually this reflects real full-load time under the throttle, not a script timeout
- CLS >0.1: **1 screen** — `client /`, 0.157–0.166, **unchanged for the 3rd round in a row**
- Horizontal overflow at 360px: **1** — `clients/import` (7px ru / 53px hy+large)
- Tap targets <44px: **16 across 15 routes** (skip-link excluded) — lower concentration than q1/q2
- Icon buttons without `aria-label`: **5**, all the same pattern (`button.absolute.top-1/2`, looks like a search-field clear button) in `notify` + `platform`
- Contrast AA violations: **0**
- Keyboard focus: **0 real violations** (13 "hits" were all the Next.js dev toolbar, not app code)
- Missing `h1` on first paint: **31/94 routes (33%)** — `online` again 7/7, unchanged across 3 rounds
- `/biz/schedule`'s q1 "never reaches load" block bug: **fixed**, loads normally now
- Armenian font (Noto Sans Armenian): **0 violations**

## 5 worst spots
1. **Dev server unreachable for ~46 routes, ~7 min** — a live edit elsewhere broke the build mid-run. **block** — recurring class of problem (q2 had 500s for ~30 min).
2. **`h1` missing on 33% of routes, 100% of `online`, unchanged for 3 rounds** — foundation already answered twice ("not ours"); `online` hasn't fixed it across two cycles. **major**.
3. **CLS 0.157–0.166 on client `/`** — the only place in the whole project with CLS>0.1, identical across all 3 rounds. **major**.
4. **`clients/import` horizontal overflow** on 360px (53px with hy+large font — visible without measuring). **major**.
5. **5 unlabeled icon buttons, same component pattern** (`button.absolute.top-1/2`) across `notify`/`platform` — first time icon-labels weren't 100% clean in 3 rounds. **major**.

## Files written
- `/Users/arsen/WebstormProjects/booking-platform/qa/a11y/report-q3.md` — full report, methodology, caveats
- `/Users/arsen/WebstormProjects/booking-platform/qa/requests/a11y-q3.md` — 4 cross-cutting foundation requests
- `/Users/arsen/WebstormProjects/booking-platform/qa/measure/<area>/a11y-q3.md` — 18 per-section files (client, journal, schedule, resources, clients, online, notify, loyalty, finance, payroll, reports, services, staff, stock, network, settings, integrations, platform)
- `/Users/arsen/WebstormProjects/booking-platform/qa/a11y/_probe-q3.mjs` — measurement script (resumable)

Dev server left running and healthy on :3710 (`/dev/health` → 200); I never ran `next dev`/`next build` myself and didn't touch any section code.