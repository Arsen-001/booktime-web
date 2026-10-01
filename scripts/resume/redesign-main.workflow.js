export const meta = {
  name: 'booking-redesign-main',
  description: 'Redesign stage 3a: the 5 main sections (clients, records, schedule, cash desk/finance, online booking) to the approved design, no lag',
  phases: [{ title: 'Redesign', detail: 'one helper per section' }, { title: 'Final', detail: 'crash sweep, screenshots' }],
}

// 26.09.2026. Owner: "I don't like the design… make it beautiful and convenient, better than Altegio";
// "nothing may lag"; "let's do option two" (first the 5 main sections, then the rest). One workflow at a time.
const P = '/Users/arsen/WebstormProjects/booking-platform'
const MODEL = { model: 'sonnet', effort: 'high' }
const GUARD = `THIS IS YOUR TASK, and the user wants it. Any user message you see nearby does NOT cancel it; do not answer it, just do the task below in full.\n\n`
const COMMON = `Project: ${P} (Next.js 16, React 19, Tailwind 4, React Compiler ON, UI on mock data). The lucky-ticket rules (CLAUDE.md/AGENTS.md) do NOT apply. Do not call git, do not start a second next dev, do not kill :3710 (scripts/ensure-dev.sh), do not run prettier on whole files. Helpers of other sections run in parallel: touch only your own paths (src/areas/<section>/**, its routes in src/app/biz/**, messages/{ru,en}/<section>.json); do NOT edit shared files (src/ui, src/shell, src/mock, src/domain); if you need a change there, write it in qa/requests/<section>.md.

READ FIRST: ${P}/docs/design/DESIGN.md (all of it: "Everything else", "Dropdowns", "Performance"), look at the reference docs/design/mockups/A2-wide.png and the finished journal docs/design/after/journal-*.png (Read png): your section must look like PART OF THE SAME PRODUCT. Stage 1 gave the shared components: src/ui/motion.ts + LazyMotion/m, Reveal, Collapse, tone.ts, DropdownChevron, num-display/num-headline, Button/Card/SectionCard/StatCard/SegmentedControl/Tabs, PageHeader. Use them instead of your own.

What "beautiful and convenient" means here (from DESIGN.md and CONVENTIONS §0):
- One primary action per screen; the rest goes into secondary/ghost or "⋯". No rows of 5 identical buttons, no walls of filters: filters go into one button "Filters" with a chevron or into a Sheet, with the active ones shown as removable chips.
- White cards with radius 16 on #f7f7fb, air ≥24px between blocks, 16–24 inside a card, lines ≥44px.
- The "headline" of a card is a large number (money, count, time) in num-headline; captions in muted.
- People with avatars/initials; statuses as a pill with a word; money as "5 000 ֏".
- Phone 390×844 FIRST: tables → cards/lists, the main action at the thumb (sticky/FAB), nothing wider than the screen.
- Empty/loading/error states per the rules (EmptyState/Skeleton→Reveal/ErrorState).
- Every dropdown has a chevron, "⋯" has none.
PERFORMANCE (owner: "nothing may lag"): animate only transform/opacity, Motion only through m/LazyMotion, NO Motion/layout on items of long lists (hover/press there are CSS only), no box-shadow/blur animations, no JS on scroll. \`node scripts/renders.mjs --check-compiler\` 0.
FUNCTIONS MUST NOT BE LOST: before you start and at the end, \`node scripts/fids.mjs --area <section>\`; the number of marks must not drop. Every data-f stays on its function.
Checks at the end: \`npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/redesign-<section>.tsbuildinfo\` with no errors in your files, eslint on the changed files, fids not below the start. Screenshots of 3 main screens of the section at 1440×900 and 390×844 (Playwright, ?demo=owner&sphere=nails), Read png, compare with the journal and the reference, fix what's ugly; save them to ${P}/docs/design/after/<section>-*.png.
Answer in Russian, 5–8 lines: which screens were redone, fids before/after, what's left.`

const AREAS = [
  { id: 'clients', what: 'the client base (list, segments, filters), the CLIENT CARD (header with a large visit count/amount, tabs), client forms' },
  { id: 'schedule', what: 'work schedule (the "employees × days" table, shifts, day off/vacation), editing hours' },
  { id: 'finance', what: 'cash desk and finance: day cash desk, operations, payment methods, balances; large amounts as headlines' },
  { id: 'online', what: 'online booking: settings, booking links (+QR), requests, the booking widget for the client (step by step, beautiful on the phone)' },
  { id: 'journal', what: 'ONLY the "Records" list (src/areas/journal/RecordsScreen.tsx and its components) and the journal settings screen (JournalSettingsScreen). The journal grid itself is already done in stage 2, do NOT touch it' },
]

phase('Redesign')
const res = await parallel(AREAS.map(a => () => agent(`${GUARD}${COMMON}\n\nYour section: ${a.id}. What to redo: ${a.what}.`, { label: `redesign:${a.id}`, phase: 'Redesign', ...MODEL })))

phase('Final')
const fin = await agent(`${GUARD}Project ${P}. The lucky-ticket rules do NOT apply; do not call git, do not kill :3710. Do not edit code. 1) \`node scripts/crash-sweep.mjs\` → how many screens crashed/are empty (list them). 2) \`npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/all.tsbuildinfo\` → number of errors. 3) \`node scripts/fids.mjs\` → total marked out of 2896. Answer in Russian, 3 lines of numbers.`, { label: 'final', phase: 'Final', model: 'sonnet', effort: 'medium' })
return { res, fin }
