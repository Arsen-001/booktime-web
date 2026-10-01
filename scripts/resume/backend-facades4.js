export const meta = {
  name: 'booktime-facades-4',
  description: 'Stage 21 round 4: notify.ts leftovers (send log, mailings, audience, payment link) on the server; then hand over',
  phases: [{ title: 'Facades', detail: '1 lane' }, { title: 'Handover', detail: 'stage 21 close-out' }],
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
- If the stage is too big for you, finish a coherent part, commit, write in PROGRESS.md exactly what is done and what is left for the stage, and return done=false — the next run continues from your notes. Mark the stage "[x]" only when all of it is done and checked.
- PARALLEL LANES (owner asked to finish 2x faster, 27.09): no other lane runs now; only the main session may touch files in the SAME two repos at the same time. Rules so you do not break each other:
  * schema.prisma: add your models in one contiguous block with a comment "// === stage N ===", never reorder or reformat the rest; if a model you need to extend was changed by the other lane, merge, do not overwrite.
  * Everything that touches the shared DB, Redis or ports — \`prisma migrate dev/reset\`, seed, booting server/worker, the Playwright pass — ONLY while holding the lock: \`until mkdir /tmp/booktime-db.lock 2>/dev/null; do sleep 5; done\` … then \`rmdir /tmp/booktime-db.lock\` (always release, also on failure; if the lock dir is older than 30 min it is stale — remove it). Name migrations with your stage: \`stageN_<what>\`. If migrate fails because of the other lane's half-written schema, wait for the lock again and retry; do not delete their code.
  * tsc errors in files of the other lane's section are not yours — note them, do not fix them, do not block on them (re-check once later). Your own files must compile.
  * PROGRESS.md: edit only your stage's row and add your own history section. Commits include all files (commit.mjs adds everything) — that is fine.`

const RESULT = {
  type: 'object',
  properties: {
    done: { type: 'boolean', description: 'the whole stage is built, checked and marked [x] in PROGRESS.md' },
    summary: { type: 'string', description: 'Russian, 3-6 lines: what was built, checks with numbers, what is left' },
    ownerQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['done', 'summary', 'ownerQuestions'],
}


const FRONT_GUARD = `
- FRONT FIXERS ARE ACTIVE: a few helpers are editing the frontend RIGHT NOW (src/areas/** and some src/api/* files). In ${F}/src/api you ONLY add the api-mode branch to functions that still read the mock (\`if (isApiMode()) return …server call…\`), following the pattern already used in the same file. Always use small Edit replacements after re-reading the file just before editing — NEVER rewrite a whole file (Write) and never reformat. If an Edit fails because the file changed, re-read and retry. Do not change function signatures or mock behaviour. Do not edit src/areas/**.`

const LANES = [
  { key: 'notify-log+mailings', files: 'src/api/notify.ts — the 17 left per «Этап 21 — Сдача, попытка 5 (итог)» in PROGRESS.md: the send log (listLog/listScheduledLog, multilingual, from booking events), mailings (listMailings/createMailing/sendTestMailing/countAudience with segments: long-absent, by service, by master, new/returning; scheduled send), countRecentAppPushes, sendOneOffMessage, the payment link. The type catalog is DECIDED: 29 + 2 service types (F-05-004), server built to the screen — build on NotifyRichTypesService, not the 13-kind model. SMS: short defaults and short links already exist (ShortLinksService, notify-sms-defaults.ts) — use them; SMS parts priced 25 ֏ per part. SKIP partner chat/Meta WhatsApp/AI agent (Р19). SPEED: paginate the log, one query per page with include, index the filter columns.', strong: true },
]

async function lane(l) {
  let r = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    r = await agent(`${GUARD}${COMMON}${FRONT_GUARD}\n\nYOUR JOB (stage 21, lane «${l.key}»): run \`node scripts/facade-audit.mjs\` in the frontend and read the stage 21 history in PROGRESS.md (esp. «Этап 21 — Сдача, итог»), then make EVERY listed function of ${l.files} work against the real server in api mode: add missing server endpoints in ${B} (module/controller/service, Prisma, seed data) where needed, then the facade branch. Other lanes do other files at the same time — only your files. Checks as in the common rules, limited to your functions (curl the endpoints, open the screens that use them in api mode). Write in PROGRESS.md under stage 21 a line «лейн ${l.key}: закрыто N из M, осталось: …». Return done=true only when all functions of your files are on the server. Attempt ${attempt}: continue from PROGRESS.md notes and the files on disk.`,
      { label: `facades: ${l.key}${attempt > 1 ? ` (#${attempt})` : ''}`, phase: 'Facades', schema: RESULT, ...(l.strong ? {} : { model: 'sonnet', effort: 'high' }) })
    if (r && r.done) break
  }
  log(`lane ${l.key}: ${r && r.done ? 'готово' : 'НЕ закончено'}`)
  return { lane: l.key, done: !!(r && r.done), summary: r ? r.summary : 'agent died', ownerQuestions: r ? r.ownerQuestions : [] }
}

phase('Facades')
const lanes = (await parallel(LANES.map(l => () => lane(l)))).filter(Boolean)
phase('Handover')
const final = await agent(`${GUARD}${COMMON}${FRONT_GUARD}\n\nYOUR STAGE: 21 — «Сдача» (PLAN.md §6, row 21), close-out. The round-4 notify lane just finished (their lines are in PROGRESS.md). Re-run the facade audit script approach from the stage 21 history over ALL of src/api, fix any small leftovers, verify a real-login pass over the main screens in api mode, finish .env.example/README/docs, write the final summary in PROGRESS.md and mark stage 21 [x] if all facades are on the server (otherwise list exactly what remains and return done=false).`,
  { label: 'stage 21: сдача', phase: 'Handover', schema: RESULT })
return { lanes, final }
