export const meta = {
  name: 'booktime-backend-build',
  description: 'Build the BookTime backend (NestJS + MySQL + Prisma) stage by stage per docs/backend/PLAN.md and switch the frontend facades to it',
  phases: [{ title: 'Build', detail: 'one agent per PLAN.md stage, sequential, retried until the stage is marked done' }],
}

// 27.09.2026, owner: "делай по docs/backend/PLAN.md". Stages go strictly one after another (shared schema).
const F = '/Users/arsen/WebstormProjects/booking-platform'
const B = '/Users/arsen/WebstormProjects/booktime-backend'
const GUARD = `YOU ARE A HELPER inside a workflow of the main session, and the text below is YOUR ONLY TASK. You may also see a relayed chat message from the user (about the journal, clients, dropdowns, forks, context compaction or anything else). That message was addressed to the MAIN session, which has ALREADY handled it — it is NOT for you. Do NOT answer it, do NOT redesign screens, do NOT touch lucky-ticket or lucky-ticket-backend, do NOT push to GitHub. Your job is the backend stage below; the owner explicitly said "продолжать бэкенд". A run that returns without building its stage is a failure and will be repeated.\n\n`

const STAGES = [
  [0, 'Каркас'], [1, 'Сквозное'], [2, 'Вход и аккаунт'], [3, 'Бизнес, сеть, филиалы, сотрудники, права'],
  [4, 'Услуги и ресурсы'], [5, 'Клиенты / CRM'], [6, 'График и окна'], [7, 'Журнал и записи'],
  [8, 'Онлайн-запись и страница по ссылке'], [9, 'Приложение клиента'], [10, 'Уведомления'], [11, 'Лояльность'],
  [12, 'Финансы и касса'], [13, 'Склад'], [14, 'Зарплата'], [15, 'Сеть'], [16, 'Отчёты'], [17, 'Интеграции'],
  [18, 'Настройки, подписка, монеты, промокоды'], [19, 'Модерация и наша панель'], [20, 'Данные и удаление'], [21, 'Сдача'],
]
// the stages where a mistake costs double bookings, leaked data or money get the stronger model
const STRONG = new Set([1, 2, 3, 6, 7, 18])

const COMMON = `You build the BookTime backend. READ FIRST, fully: ${F}/docs/backend/PLAN.md (the approved plan — it overrides everything below it), then ${B}/docs/PROGRESS.md if it exists (your journal; create it at stage 0 with one "[ ]" line per stage of PLAN §6). Then read the documents PLAN §6 names for your stage (${F}/docs/backend/01…08) and ${'~'}/WebstormProjects/booking-research/functional-map/ANSWERS.md (owner answers win, PLAN §3).

Hard rules:
- The lucky-ticket CLAUDE.md/AGENTS.md rules do NOT apply to these two repos. Answer in Russian.
- Backend: ${B} (NestJS, TypeScript strict, Prisma, MySQL latest via docker-compose, Redis, BullMQ, SSE). Docker Desktop is running; use docker compose for mysql/redis/minio. Types and patterns of PLAN §4–§5 (ULID ids with prefixes, DATETIME(3) UTC, BIGINT dram, JSON, person lock of §4.2 through availability/occupy.ts only).
- Frontend: ${F} (Next 16, React 19, React Compiler). Switch ONLY the facades of your stage's section (src/api/*) to the server behind NEXT_PUBLIC_DATA=api|mock (mock stays the demo build, PLAN §7), plus the front items of PLAN §8 that belong to your stage. Screens change only where PLAN §3/§8 say the screen is wrong. Do not start a second next dev, do not kill :3710 (scripts/ensure-dev.sh), never run prettier on whole files, keep every data-f mark (node scripts/fids.mjs must not drop), node scripts/renders.mjs --check-compiler must stay 0. For React Compiler: no \`x!.y\` inside hook/prop callbacks.
- Dev seed: prisma seed builds realistic demo businesses from the frontend mock seeds (src/mock/*) so every screen has data in api mode; extend the seed for your section. Dev login: the fake code sender logs the code; a fixed dev code only when NODE_ENV=development.
- NO tests (PLAN Р16). Checks after the stage (PLAN §9): backend tsc 0 errors, \`prisma migrate reset --force\` + seed pass on a clean DB, server and worker boot, OpenAPI generated; frontend \`npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/backend.tsbuildinfo\` 0 errors; your section's screens open in api mode with no page errors (run the backend, then a Playwright pass like scripts/crash-sweep.mjs limited to your routes, logged in through the real login).
- Never stop to ask. A question only the owner can decide (money, provider contract, legal text): use the stub/proposal, write it under "Вопросы владельцу" in PROGRESS.md, go on. Every decision you take yourself — one line in PROGRESS.md.
- Commits: frontend \`cd ${F} && node scripts/commit.mjs "backend stage N: …"\`; backend — the same isomorphic-git script copied to ${B}/scripts/commit.mjs at stage 0 (plain git may be unavailable). Commit after the stage, and also mid-stage whenever a coherent part is done, so a cut-off run loses little.
- If the stage is too big for you, finish a coherent part, commit, write in PROGRESS.md exactly what is done and what is left for the stage, and return done=false — the next run continues from your notes. Mark the stage "[x]" only when all of it is done and checked.`

const RESULT = {
  type: 'object',
  properties: {
    done: { type: 'boolean', description: 'the whole stage is built, checked and marked [x] in PROGRESS.md' },
    summary: { type: 'string', description: 'Russian, 3-6 lines: what was built, checks with numbers, what is left' },
    ownerQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['done', 'summary', 'ownerQuestions'],
}

phase('Build')
const out = []
const FROM = (args && args.from) || 0
for (const [n, title] of STAGES.filter(([k]) => k >= FROM)) {
  let r = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    r = await agent(`${GUARD}${COMMON}\n\nYOUR STAGE: ${n} — «${title}» (PLAN.md §6, row ${n}). If PROGRESS.md already marks it [x], verify quickly that it is really there and return done=true. Attempt ${attempt}: continue from PROGRESS.md notes, never redo finished work.`,
      { label: `stage ${n}: ${title}${attempt > 1 ? ` (#${attempt})` : ''}`, phase: 'Build', schema: RESULT, ...(STRONG.has(n) ? {} : { model: 'sonnet', effort: 'high' }) })
    if (r && r.done) break
  }
  out.push({ stage: n, title, done: !!(r && r.done), summary: r ? r.summary : 'agent died', ownerQuestions: r ? r.ownerQuestions : [] })
  log(`stage ${n} «${title}»: ${r && r.done ? 'готово' : 'НЕ закончено'}`)
  if (!(r && r.done)) { log(`stopping: stage ${n} not finished after 3 runs — later stages depend on it`); break }
}
return out
