export const meta = {
  name: 'booking-redesign-rest',
  description: 'Redesign stage 3b: the remaining 13 sections (including the client app) to the approved design, no lag',
  phases: [{ title: 'Redesign', detail: 'one helper per section' }, { title: 'Final', detail: 'crash sweep, screenshots' }],
}

// 26.09.2026. Owner: "I don't like the design… make it beautiful and convenient, better than Altegio";
// "nothing may lag"; then 3a (5 main sections) is done, this is 3b — everything else. One workflow at a time.
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
IMPORTANT (lesson of stage 3a): do not settle for "the screen is already on the new kit". Take screenshots BEFORE, put them next to docs/design/after/journal-1600.png and clients-card-1440.png, and honestly list what looks worse (a wall of buttons/filters, small numbers, tables on the phone, old underlined links, empty grey spaces, inconsistent radii, cramped spacing) — then fix it. For each section, at least the 3 main screens must visibly move towards the reference; save BEFORE/AFTER screenshots to docs/design/after/<section>-*-before.png and -after.png.
Answer in Russian, 5–8 lines: which screens were redone, what exactly changed, fids before/after, what's left.`

const AREAS = [
  { id: 'client', what: 'THE CLIENT APP (the most important thing after the journal: this is what salon clients see): home ("Free near you", stories, my bookings), search and map, master card and salon card, the booking flow step by step, my bookings, profile. Mobile-first, beautiful and "alive": master photos/avatars, large times of free slots, the tone of the service colour on booking cards (tone.ts) as in the journal' },
  { id: 'loyalty', what: 'loyalty: card types, certificates, memberships, cashback, promotions; large balance/bonus numbers, the card as a "card" (beautiful, like a bank card)' },
  { id: 'notify', what: 'notifications and mailings: templates, message list, mailing settings; the inbox list is light, without walls of toggles' },
  { id: 'reports', what: 'reports and analytics: dashboard (large KPI numbers + clean charts), report tables' },
  { id: 'staff', what: 'employees: list, employee card, access rights (grouped, not a wall of 100 checkboxes), positions' },
  { id: 'settings', what: 'cabinet settings: settings hub (tiles), subscription/billing, business profile, mobile apps' },
  { id: 'stock', what: 'stock: products, stock levels, documents, stock-taking; tables → cards on the phone' },
  { id: 'payroll', what: 'payroll: calculation schemes, statements, payouts; large amounts' },
  { id: 'network', what: 'branch network: dashboard across branches, switching, network settings' },
  { id: 'integrations', what: 'integrations: showcase of partner cards (beautiful tiles with logos/icons), connection screens' },
  { id: 'resources', what: 'resources and group events: rooms/equipment, events, waitlist (/biz/waitlist)' },
  { id: 'services', what: 'services catalogue: categories, service card, prices and durations' },
  { id: 'platform', what: 'OUR panel (/platform): salon visits, onboarding, moderation, ads, metrics' },
]


async function pool(items, k, fn) {
  const out = new Array(items.length).fill(null)
  let next = 0
  await parallel(Array.from({ length: k }, () => async () => {
    while (next < items.length) {
      const j = next++
      try { out[j] = await fn(items[j]) } catch (e) { log(`${items[j].id}: ${e && e.message ? e.message : e}`) }
    }
  }))
  return out
}

phase('Redesign')
const res = await pool(AREAS, 8, a => agent(`${GUARD}${COMMON}\n\nYour section: ${a.id}. What to redo: ${a.what}.`, { label: `redesign:${a.id}`, phase: 'Redesign', ...MODEL }))

phase('Final')
const fin = await agent(`${GUARD}Project ${P}. The lucky-ticket rules do NOT apply; do not call git, do not kill :3710. Do not edit code. 1) \`node scripts/crash-sweep.mjs\` → how many screens crashed/are empty (list them). 2) \`npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/all.tsbuildinfo\` → number of errors. 3) \`node scripts/fids.mjs\` → total marked out of 2896. Answer in Russian, 3 lines of numbers.`, { label: 'final', phase: 'Final', model: 'sonnet', effort: 'medium' })
return { res, fin }
