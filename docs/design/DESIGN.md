# BookTime — design (approved by the owner on 26.09.2026)

The source of truth for the look. The mockups are in `docs/design/mockups/` (`*.png` to look at, `*.dc.html` for
exact numbers); the canvas with every option is https://claude.ai/artifact/Ruy7bZqyJuwTyGhnbvZVPX.

## How it was chosen (in the owner's words)
- "I don't like the design of /biz/journal… make everything so beautiful that it is more convenient and nicer for Altegio users and all similar programs."
- Of the 3 journal layouts, the owner chose **A · Calm**, plus **the day panel from B, collapsible** (the A2 row).
- The booking card: the ordinary one ("a flat block with a coloured header") was rejected as "disposable, like everywhere else". **"C · Tone"** was chosen.
- Animations: **Motion** (`motion/react`) for opening and closing elements + **`<ViewTransition>` from React** (Next 16) for page transitions. react-motion is not used (abandoned since 2017).

## Journal (docs/design/mockups/A2-*.png)
1. **One control row** (72px, white, bottom border): ‹ › · "Friday, 26 September" + "today" ⌄ (a month calendar opens on click) ·
   empty space · segmented control Day/Week/Month · a stack of master avatars + "All masters" · search · one primary "New booking".
   No big "Journal" heading, no star, no rows of filters: the extra filters go under "⋯" or into the master selector.
2. **Day totals row** under the controls, 13px: "**15** bookings · **142 000 ֏** revenue · **7** free slots · **3** awaiting confirmation" (the last in the warning colour).
3. **Grid**: a white card with radius 16. Column headers: master avatar 32 + name 14/600 + a load bar 4px in the master's colour + "N bookings" (correct plurals!).
   Only the working hours (from the earliest start to the latest end of the masters that day), no long grey mornings. Thin lines #f0f0f5.
   The **"now"** line is 2px danger colour with a time pill on the left.
4. **"Needs attention" panel** on the right (292px), **collapsible**: open at width ≥1440, collapsed on narrower screens into a 56px strip with icons and counters.
   Order: (1) yellow "N awaiting confirmation — reply by HH:MM", one line per request with a ✓ button to confirm on the spot;
   (2) "You can fill a slot: Lala is free 14:00–16:30, 2 clients on the waitlist" + "Offer the slot"; (3) "Next": 3 bookings with a lacquer drop.
5. **Phone**: header 56 (menu · title/salon · search · bell) → week strip (day buttons 46×58, the current one filled with primary) →
   a yellow bar "N awaiting confirmation · by HH:MM" → grid with 2 masters (the rest scroll sideways) → FAB "+ Booking" at the thumb → bottom menu with 4 items.
   If "Find a slot" does not fit next to the yellow bar, it wraps to the next line — the bar is never squeezed to "1 …".
6. **Day views** (owner 29.09.2026, ⭐ ours): a segmented control at the right end of the day totals row — "Columns · Overview ·
   Timeline · List" (icons below 1280px, words from 1280px; on the phone — words only, in "⋯ More"). The choice is personal and
   stored in the staff account (`useDayLayout`); the journal keeps its skeleton until it arrives, so "Columns" never flash first.
   - **Columns** — the grid above (the default).
   - **Overview** — every master a narrow column (≥ 44px), the whole working day fits the screen height; bookings are colour bars
     (the card tone, 3px top edge in the drop colour), time only when the bar is ≥ 18px; details on hover (one light card per view,
     no requests); click — the booking window, click on empty space — a new booking at that time.
   - **Timeline** — masters as rows (200px name column, 116px on the phone), time runs left to right and fits the width
     (≥ 1.0 px/min — a 13-hour day still fits a laptop; narrower screens scroll sideways); rows 40–64px fit the height, so 15–20 masters are visible at once.
     A bar shows its time from 34px (10px type under 48px so it is never cut to "16:3…") and the client name from 90px.
   - **List** — every booking of the day by time: time–end, client (+ phone), services, master, status, sum; today opens on
     "Upcoming" with "All" next to it, and a red "Now HH:MM" line between past and upcoming; paged 10/20/50/100 like every long list.
   - Find-a-slot gaps are drawn in Overview and Timeline too; awaiting-confirmation bars have a dashed warning outline.
   - **Moving by drag** (Columns and Timeline, right "Reschedule"): in Timeline a bar drags sideways for time (15-min step) and up/down
     for the master (mouse; touch keeps scrolling). While dragging, a dashed ghost marks the target slot — green with "14:00–14:30",
     amber "outside hours" (allowed), red with the reason "Taken: 14:00 Gagik A." / "Taken: Chair" (dropping there bounces back).
     The ghost is computed from the day already loaded (no request per move); the label floats above the dragged card.
   - Each master's day revenue (active bookings): Timeline — right of "N bookings" in the name column (not on the phone);
     Overview — a line under the count when columns are ≥ 60px, always in the header tooltip.
   - A group class is one dashed grey bar / row with its seats "9/10" (the name in the tooltip when the bar is narrow); its
     participants are not drawn as separate bookings. The day range covers classes too, so a 19:00 class is never past the edge.

## Booking card "C · Tone" (docs/design/mockups/Cards2.png, column C)
- **The whole card is a light tone of the client's lacquer colour** (nails: the chosen shade, F-… shade in the booking; other spheres:
  the colour of the service category — picked per **service**, not per category, so a category with several services doesn't paint
  the whole day one colour). Tint = mix(colour, white) at 16%.
- **One type scale, always** (owner 27.09.2026 — "I don't like that the elements have different sizes"): time is always 30px/800,
  letter-spacing −1px, in **a dark tone of the same colour** (a light shade gets ×0.45 darkness; a dark shade is used as is); the
  client name is always 13–14px/600 in the main text colour, directly under it; padding, the lacquer-drop size (18px) and position
  are the same on every card, short or tall. There is no smaller "22px"/"18px" time variant any more — a shrunk font on a short card
  was the bug, not a size to preserve. From 96px height: "service · until HH:MM" in the dark tone. From 120px: a white pill at the
  bottom "status · lacquer name" — those two thresholds are unchanged, only gated by real card height.
- **As in the mockup** (owner 27.09.2026: «нравится дизайн как в макете», after trying "all info on every card"): fonts are the
  same on every card; content follows the height as in A2 — from 76px time + name stacked, from 96px + "service · until HH:MM",
  from 120px + the pill "status · lacquer". A booking shorter than that (under an hour) is one row of the same fonts: time on the
  left, name and service on the right; it never covers the next booking. Scale 1.6 / 2.0 / 2.4 px per minute (15 / 10 / 5-minute
  step): an hour is 96px, a 30-minute booking 48px (`CARD_MIN_HEIGHT` 44). Everything else about a booking is in its status card
  and booking window.
- **Lacquer drop** at top right: an 18px circle of the shade with a 3px ring of a lighter tone — same size on every card.
- Awaiting confirmation: a 1.5px dashed outline in the warning colour, offset **−3px (inward)**. A positive offset draws outside the
  card's own box and, on two bookings with no gap between them, bleeds onto the next card — inward offset stays inside this card's
  rectangle no matter what follows it. No coloured headers, no stack of icons.
- Contrast: the time and text must hold ≥4.5:1 against the tint (check it with a function, don't eyeball it).

## Motion (tokens in `src/ui/motion.ts`)
- Durations: fast 150ms, normal 220ms, large 320ms. One spring for "physical" things (sheet, panel, drag): stiffness ~400, damping ~34.
- Animate only transform and opacity. Honour `prefers-reduced-motion`: animations collapse to a crossfade or turn off.
- Where: open/close of Modal, Sheet (swipe down on the phone), Popover/Dropdown/Select, Toast; collapsing the "Needs attention" panel;
  adding/removing cards in lists (layout); the booking card → booking window (shared element via `<ViewTransition>`); route transitions.

## Everything else
The same language on every screen: white cards with radius 16 on #f7f7fb, one primary accent per screen, air (≥24px between blocks),
large numbers as the "headline" of a card where there is a number (money, time, count), status as a word/pill, not colour alone.
The rules of CONVENTIONS §0 remain in force.

## Dropdowns: always with a chevron (owner, 26.09.2026)
- Every control that opens a list, menu or picker (Select, Combobox, a DropdownMenu/Popover button such as "Sell", the date in a
  heading, "All masters", filter buttons with a list, DatePicker/TimePicker/DateRangePicker, PeriodNav, the user menu) carries a
  **ChevronDown at its right edge: lucide, 16px, muted colour** (on a filled button: the text colour at 75%).
- When open the chevron turns 180° smoothly (transform, 150ms); under `prefers-reduced-motion` it flips instantly.
- Built into the kit: `DropdownChevron` (`src/ui/DropdownChevron.tsx`); `Button` adds it by itself when it has `aria-haspopup`
  (every Popover/DropdownMenu trigger spreads it) and no own `rightIcon`; `chevron={false}` removes it.
- Exceptions: "⋯" / "⋮" (more actions) and other icon-only square buttons (`IconButton`) — no chevron.

## Page width (owner, clients-review 27.09.2026)
One rule for every `/biz` screen, cabinet-wide, not just clients — the old per-screen widths (a full-width
list next to a ~900px summary next to a ~670px catalogue next to a ~770px import screen) made a section
feel unfinished, jumping width on every click:
- **Tables and summaries** (a list with rows, a dashboard of stat tiles/cards) run the **full width** of
  the content column — no `max-w-*` on the root wrapper.
- **Forms and settings** (a single form, a catalogue/settings page, an import/log/consent screen) sit in
  **one width, 760px** (`max-w-[760px]`), centred with `mx-auto`.

## Long lists: pages of 10, choice 10/20/50/100 (owner, 29.09.2026 — «как в Записях — для всех таких мест»)
Every list that grows with business data is shown in pages: **10 by default**, «1–10 из N» on the left and
«На странице 10 ▾ (10/20/50/100)» + page numbers on the right, under the list (`Pagination`, `PAGE_SIZES`,
`DEFAULT_PAGE_SIZE` in `src/ui/Pagination.tsx`). The shared `Table` does it by itself (`pagination`, on by default;
sort first, then slice; «select all» = the current page); a screen whose pages come from the server passes
`pagination={false}` / `manualSort` and renders its own `<Pagination>` with the same sizes. A list that is not a `Table` (cards,
`<ul>`, a hand-written `<table>`) uses `usePagedList(items)` → `{ pageItems, pager }` from the same file. Changing a filter, search,
sort or page size goes back to page 1. Fixed-size tables (a schedule grid, a receipt, settings) are not paged.
The services catalog (`/biz/services`) is not paged either (owner, 29.09.2026): its collapsible categories and
drag-to-reorder already split a long list, and pages would cut a category in two.

## Money, arrival and the master's view (owner, 30.09–01.10.2026, after the full test)
- **One waitlist** (30.09): the journal panel and `/biz/waitlist` show the same entries; slot offers, «Уведомлён» and
  «Записать → Закрытая» work for every entry. Since 01.10 it is one view too (`WaitlistBoard`: the page and the journal
  panel), and every entry point writes into it — staff, the client app («Сообщить, когда освободится») and the online
  booking widget; there is no separate «notify me» list or channel.
- **Prepayment is money in finance** (01.10): a prepayment the client transferred to the master's requisites is
  recorded as its own finance operation when «Деньги пришли» is confirmed; «Вернул» records the reverse. The visit
  payment adds only the remainder — the day's money is counted once.
- **A required extra booking field never blocks «Пришёл»** (01.10): arrival is a fact, not a form save.
- **7-day introduction** (01.10): a business that registers itself gets 7 days to try, then the usual «продлите»;
  promo codes apply to the first payment.
- **«Быстрый старт» only for who sets up the company** (01.10): hidden from roles without settings permission
  (master, admin by default).
- **Owner, 01.10 («делай как советуешь»):** the admin runs the cash shift (`finance.shift`) and sells loyalty
  (`loyalty.manage`) but sees neither other salaries nor reports; prepayment is set in one place — the master's
  online settings (finance shows it read-only); analytics revenue = money received (booked value shown as a second
  line); payroll «за записи» only for visits that happened; «В отпуске до…» never moves bookings silently — it lists
  them with «Перенести / Отменить с уведомлением»; services go live without pre-moderation (photos and texts are
  moderated, clients can «Пожаловаться»); a late client cancel burns a membership visit like a prepayment; after
  «Я оплатил» the status reads «Ждёт мастера»; the 12-hour format shows AM/PM; English shows names transliterated.
- **A master sees only their own** in «Требует внимания» and «Сейчас» (01.10): own late clients, overruns, requests,
  «Завтра не подтвердили». Salon-wide only with the `journal.others` permission.
- **Push reminder follows the salon's «Отправлять за»** (01.10): service → booking → type 1 setting, default 1 h, server
  and mock alike; Telegram (clients without the app) stays fixed at 24 h and 2 h.
- **One waitlist, one right** (01.10): the journal tile and /biz/waitlist use the single resources right «Видит лист
  ожидания» (`viewWaitlist`); the journal's own «Показывать лист ожидания» checkbox is gone.

## Shell (owner, clients-review 27.09.2026 — tried without the top bar, reverted same day)
Every `/biz` page, **including the journal**, keeps the top shell bar (location switcher, search, bell,
user menu) exactly as it always has — a same-day attempt to move those into the sidebar and drop the bar
was reverted ("I don't like it without the header"); do not reopen this without the owner asking again. The
sidebar itself is wide with labels everywhere **except** `/biz/journal`, which still defaults to the
collapsed 72px icon rail (`useDenseScreen`) — the person can expand it, and that choice sticks
everywhere and survives a reload (`sidebarManual` in `src/demo/store.ts`).
Sidebar behaviour (owner, 29.09.2026 — «не нравится, как работает collapse»): the collapse/expand button sits at the
**top**, next to the logo, in both states. Hovering the icon rail slides the full labelled menu **over** the page
(nothing shifts; opacity + transform only); groups in the rail are split by a thin divider.
All groups are **always open** (owner 29.09.2026: «нижние меню сделай так, как Calendar, Bookings…»): every item with
its icon is visible, the group name is a plain caption with no chevron. An item that has sub-pages carries a chevron
(down — closed, up — open); the current item's sub-pages show under it.
Long names wrap to two lines, never «…».
Opening/closing a sub-list is one motion: the block folds like a shutter (clip-path) while everything
below slides with its edge (FLIP via transform, `Fold` in `NavList.tsx`) — nothing vanishes first and jumps after. `/biz/clients/consent/[clientId]` is the one route `BizShell` renders with no chrome
at all — a client opens it by link, not through the cabinet.

## Performance — nothing may lag (owner, 26.09.2026)
Mandatory for every stage; a violation is a major.
- **Only transform and opacity** are animated. Never height/width/top/left/box-shadow/filter/backdrop-filter.
  Collapse/expand: content fades and shifts (`Collapse`), the block itself takes its place at once; if a size really has to
  move — a fixed-size transform (scaleY on a wrapper, clip-path) or a Motion `layout` on ONE container, never per item.
- **Motion only through LazyMotion + `m.*`** (`import * as m from 'motion/react-m'`), features = `domAnimation`, loaded as a
  separate chunk after first paint (`src/ui/MotionProvider.tsx`, `strict` forbids `motion.*`). No `domMax`: layout/drag are
  not loaded. Sliding indicators (Tabs, SegmentedControl) use the Web Animations API (`useSlidingIndicator`), the Sheet swipe
  uses a MotionValue + pointer events — both without extra bundles.
- **Mass lists are CSS only**: no `m.*`, `layout` or `AnimatePresence` in the journal grid, tables and lists with 50+ rows —
  hover/press there are CSS transitions of 150ms. Skeleton → content: no animation at all (see «Page change» below).
- `will-change` only while an animation runs (Motion/WAAPI manage it), never permanently. No JS animations on scroll.
- No heavy blur or big shadows on moving layers: overlays have no `backdrop-blur`, the top bar is solid (no blur under a
  scrolling page), moving panels use `shadow-lg` at most.
- Animations must not re-render components: drag writes a MotionValue, indicators write to the DOM, presets are constants;
  `node scripts/renders.mjs --check-compiler` must stay at 0.
- **Page change = ONE picture change: the old page → the new page, already with data** (owner 30.09.2026: «после каждого
  редиректа мигает… чтобы страницы очень плавно и быстро менялись»). Before, a click showed four pictures in 0.6 s (old
  page → a generic skeleton → the old page again fading out → the new page's skeleton → rows fading in) — that was the
  blinking. Rules:
  - **No fades and no generic skeleton between pages.** Menu / tab bar / browser back: the swap is instant
    (`PageTransition`, View Transitions with `default: 'none'`; the root's default 250 ms crossfade is off). A fade from
    transparent is a frame of empty background — the eye reads it as a blink; two pages at once — «всё наливается друг на
    друга» (29.09). Only drill-down (`nav-forward`) and «Назад» (`nav-back`) move: the new page slides 24 px, opaque.
  - **The old page waits for the new one's data.** If the new page mounts with skeletons, the old page's snapshot stays
    on screen until the skeletons fill, at most 300 ms (`PageTransition` → `vt-hold`); then the new page appears already
    filled. Slower data — after 300 ms its exact skeleton shows.
  - **The page is there before the click.** Menu and tab-bar links `prefetch` the whole page; table rows that open a
    page use `Table rowHref` (prefetch on hover, progress bar from the click) instead of `router.push` in `onRowClick`;
    other code navigations call `useNavigate().go(href)` (`src/ui/navigation`). In `next dev` prefetch is off —
    `ensure-dev.sh` pre-builds every route after starting the server.
  - **The click answers at once**: the new menu item / tab lights up and a thin bar runs at the top (`NavPendingFeedback`,
    owner 29.09.2026: «нажимаю — как будто не работает»); the old page stays as it is.
  - **Content that replaces a skeleton appears without animation** — no `animate-fade-in` / `animate-rise` / stagger on
    data arrival, on tab panels or on cards that are part of the page. Entrance animations only for what the user just
    caused (a toast, an added row, the next step of a form).
  Mock requests answer in 40–120 ms (`?api=slow` for slow-network checks).
- Measure, don't eyeball: Playwright with CDP CPU throttling ×4, open/close Modal and Sheet 5× and a page transition,
  count frames via requestAnimationFrame. Target: average ≥ 55 fps, longest frame ≤ 32 ms. Report JS chunk sizes before/after
  from `.next` after `next build`.

## Nothing blinks, only what changed updates (owner, 27.09.2026)
Owner's words: "абсолютно ничего не мигало, моргало, всё идеально плавно открывалось и закрывалось; любая часть должна
раздельно обновляться, а не вся страница или большой блок; загрузка каждого такого элемента — скелетоны". A violation is a major.
- **No blink on refetch.** A skeleton is shown only when there is NO data yet (`isLoading`), never on `isFetching`.
  Data that is already on screen stays until the new data replaces it (keepPrevious / optimistic update). No spinner over
  the whole block because one number is being recalculated.
- **Granular updates.** After a save, only the changed element re-renders: patch the cache (`patchInList`,
  `removeFromList`, `optimistic`) instead of invalidating a whole list or page; split screens into small components with
  their own queries so a neighbour does not re-render. No `key` that remounts a big block, no conditional that swaps the
  whole page for a loader. Checked with `node scripts/renders.mjs` (renders/dom per action).
- **Skeleton per element.** Every block that loads its own data has its own skeleton of the same size and shape as the
  content (the same height, rows, columns), inside its own place — the page frame, header, tabs and filters render at once.
  Skeleton → content: the block just fills in, no fade (`Reveal`). No layout shift when the content arrives (CLS 0 on the action).
- **The skeleton IS the page, before the data** (owner, 30.09.2026: «скелетоны изначально сразу идеально на каждом
  элементе до загрузки… сейчас со скелетоном моргает больше, чем без него»). When data arrives nothing moves, grows or
  appears from nowhere — the grey places just fill in. How:
  - **Same element, same classes.** A value's skeleton is `<SkeletonText width="14ch" />` INSIDE the element that will hold
    the text (`<p className="text-sm">{loading ? <SkeletonText … /> : phone}</p>`) — its box is exactly one line (1lh) of
    that font. Not a separate `<Skeleton className="h-4 …" />` with a guessed height. Multi-line text — `Skeleton lines={n}`
    inside the text element (each line 1lh). Text known in advance but not shown until the answer (an empty state's title) —
    `<SkeletonOver>{text}</SkeletonOver>`: the real text, invisible, under a grey plate of exactly its size.
  - **Same component.** A list row / card has a `XxxSkeleton` next to it with the same markup (avatar circle of the same
    size, badges' slots, buttons' boxes, chevron). `Table`: per-column `skeleton` for non-text cells (avatar + name, a 40 px
    button), `width` on every column (the column never shrinks under a bar or stretches under text — long text truncates),
    `mobileCardSkeleton` whenever there is a `mobileCard`. `StatCard loading`, `Chip countLoading`, a tab badge —
    `<SkeletonText width="2ch" />`.
  - **Same count.** Paged lists — the page size; others — the typical count (`loadingRows`). `Table` remembers the last
    row count and column widths itself (`useSkeletonCount` / `useRememberedLayout` for your own lists).
  - **Nothing appears after load.** Counters («90 клиентов»), toolbar buttons shown only with data, the location name,
    the user name — rendered during loading in the same place (bar inside, or the button disabled). Heights never depend
    on data: an optional badge does not make a row taller (fixed row height), a number pill fits two digits.
  - **First frame in the right layout.** The server knows the viewport width (`ViewportHintProvider`: cookie `bp-vw`, first
    visit by user agent), so `useMediaQuery`/`useIsMobile` answer correctly already in the server HTML — prefer CSS
    (`md:hidden`) anyway for layout.
  - Measured: `node scripts/skeletons.mjs --area <id> --shots` — every page must be ✓ (cls < 0.01, 0 boxes not in place).
- **Smooth open/close everywhere.** Every Modal, Sheet, Popover, Dropdown, Select, Tooltip, Toast, collapse and tab switch
  opens AND closes with the motion tokens above — nothing appears or disappears in one frame, nothing jumps on close
  (exit animations run before unmount; content does not reflow during the exit).
- **Buttons keep their size**: a pending button shows its spinner inside the same box; a label change does not move neighbours.
- Measured, not eyeballed: `scripts/flicker.mjs` — per screen and main action: skeleton flashes with data present,
  remounted blocks, layout shift, open/close without animation. Target: 0 everywhere.
- **Kit tools for this** (`src/ui`, `src/api/request.ts`):
  - Overlay mounted by a condition → `<ExitHold value={row}>{(row) => <RowSheet row={row} … />}</ExitHold>` (Modal/Sheet
    inside, even with `open` always true, close by it and unmount after the exit), or the hook
    `useExitHold(row)` → `{ value, open, mounted, onExitComplete }` with `onExitComplete` on Modal/Sheet. `value` must be
    stable (state, query data, an element found in it). Never `{x && <Modal open …/>}`.
  - Tabs: `keepMounted` keeps visited panels in the tree (`hidden`), so switching back rebuilds nothing.
  - List row → detail: `seedApiQuery(key, row)` puts what the row already has into the cache; `useApiQuery(key, fn,
    { initialData })` starts from known data of the same shape and refetches in the background;
    `prefetchOnHover(key, fn)` returns pointer/focus/touch handlers for the row that prefetch the detail
    (mouse after 120 ms, touch and keyboard focus at once).
  - Popover/Select/Dropdown/Tooltip exit with `TRANSITION.exitSoft` (fast, ease-out: visible from the first frame);
    toasts stack away from the anchored edge and collapse their place after fading out.

## Speed — the site must be very fast (owner, 28.09.2026)
«наш сайт должен работать очень быстро» — applies to the front AND the server, every stage; a violation is a major.
- **Front load:** the client app and the public booking page open fast on a phone over mobile internet. Code-split per route,
  no heavy libraries on first paint, images through `next/image` with sizes, fonts preloaded. Targets (Lighthouse mobile,
  throttled): LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1; report the JS size of each route after `next build`.
- **Server:** every list is paginated; no N+1 (one query with include/join or a batch, not a query per row); every foreign key
  and every filter/sort column has an index; select only the fields the screen needs. Target: p95 ≤ 200 ms for reads,
  ≤ 400 ms for writes on the demo seed; slow queries are logged.
- **Between them:** a screen does one or a few requests, not one per block; cache on the client (keepPrevious, seeds from
  the list row, prefetch on hover), never refetch what did not change.
- **Never a full page reload** (owner: Altegio is slow and reloads the whole page on every action — we must not). Internal
  navigation only through `next/link` / `router.push|replace`, never a plain `<a href="/…">`, `location.href =` or
  `location.reload()`; after a write, patch the cache instead of reloading. Grep for these in the final check.
- Measure, don't assume: Lighthouse + `next build` sizes on the front, request timing on the server.

**Слово «неявка» не используем (владелец, 01.10.2026).** В интерфейсе — «Не пришёл» (статус, счётчик «Не пришёл: N»,
«штраф, если клиент не пришёл», «засчитается как «не пришёл»»). В коде и комментариях термин no_show / «неявка» остаётся.
