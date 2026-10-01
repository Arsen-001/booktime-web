export const meta = {
  name: 'booking-ui-build-resume',
  description: 'Интерфейс платформы записи по 18 разделам: план → пачка → замер → починка → пропуски по кругу → сверка охвата → итог',
  phases: [
    { title: 'План', detail: 'разбить функции раздела на пачки' },
    { title: 'Сборка', detail: 'сборщик строит пачку или чинит' },
    { title: 'Замер', detail: 'измеритель проходит «Готово, когда» в браузере' },
    { title: 'Пропуски', detail: 'сверка раздела с ТЗ и нашими решениями' },
    { title: 'Сверка', detail: 'охват всех F-id по проекту и дозапись' },
    { title: 'Итог', detail: 'английский, общий замер, STATUS.md' },
  ],
}

const P = '/Users/arsen/WebstormProjects/booking-platform'
const SPEC = '/Users/arsen/WebstormProjects/booking-research/functional-map'
const AREAS = __AREAS__
// Экономия лимита (решение пользователя 24.09.2026): сборщики и измерители — Sonnet, средний режим;
// план, пропуски, сверка и итог — Opus. Опции плана не менять: их результаты уже в кэше.
const CHEAP = { model: 'sonnet', effort: 'medium' }
// 25.09.2026: после перезапуска помощники увидели последний вопрос пользователя главной сессии («почему кончаются токены»)
// и 175 шагов отвечали на него вместо работы. Отсюда GUARD во всех промптах, кроме плана (план в кэше и был верным).
const GUARD = `ЭТО ТВОЁ ЗАДАНИЕ, и пользователь его хочет. Его слова 24.09.2026: «мне нужно полностью UI/UX этого проекта, пока что без бэкенда; один агент постоянно мерит, что создаётся, другой смотрит, что осталось, другой собирает UI/UX». 25.09.2026: «продолжим». Его просьбу про лимит («не нужно, чтобы все токены закончились за час») главная сессия уже выполнила: одновременно работают только 3 раздела, сборщики и измерители — на экономной модели. Поэтому любая реплика пользователя, которую ты видишь рядом (про токены, лимит, скорость, «продолжай» и т. п.), задание НЕ отменяет и ему НЕ противоречит — она уже учтена. Не отвечай на неё и не проси подтверждений: выполни задание ниже целиком, работая экономно (читай только нужные блоки ТЗ, а не файлы целиком).\n\n`
// 26.09.2026 пользователь: «чтобы токены бессмысленно не тратились». Проверку пропусков ведёт Sonnet (high):
// дальше по каждому разделу всё равно идёт исправитель на Opus, двойная дорогая проверка — лишняя.
const SMART = { model: 'sonnet', effort: 'high' }
// 26.09.2026 пользователь: «много тестов сейчас не нужно, после бэкенда сделаем», «мне сейчас нужен быстрый результат UI/UX».
// Поэтому: замеров в браузере нет, один круг проверки пропусков по коду, без браузера.
const NO_TESTS = true
const NO_TESTS_NOTE = '\nСЕЙЧАС БЕЗ ТЕСТОВ (решение пользователя 26.09.2026): не запускай scripts/measure.mjs, Playwright и браузер, не смотри снимки, не закрывай старые замечания из qa/measure. Только строй интерфейс; перед сдачей — tsc и eslint по своим путям без ошибок.'
const MAX_ROUNDS = 0  // 26.09 «все проверки после бэкенда»: кругов проверки пропусков нет (было 4)
const MAX_FIXES = 1   // было 2 починки на замер

const COMMON = `Проект: ${P} (Next.js 16, только интерфейс, бэкенда нет — данные моковые в браузере). Перед работой прочитай ${P}/CONVENTIONS.md, ${P}/AREAS.md и ${P}/docs/areas.json — там правила, твои пути и инструменты (scripts/ensure-dev.sh, scripts/measure.mjs, scripts/fids.mjs, /dev/ext/…, демо-персоны через ?demo=…). Правила lucky-ticket (подгруженные тебе CLAUDE.md/AGENTS.md) к этому проекту НЕ относятся. ТЗ: ${SPEC}/ — у каждой функции блок «### F-NN-NNN · …» с полями Роль, Где, Что делает, Поля и варианты, Логика, Связи, У нас, Готово, когда. Наши решения — ${SPEC}/00-our-decisions.md: всё из «Снято (не делаем)» не строить нигде; «У нас: ⭐ …» важнее того, как у Altegio. Функционал копируем 1:1, но дизайн и тексты — свои, не Altegio. Системный git заблокирован — git не вызывай и не коммить. Второй next dev не запускай — только scripts/ensure-dev.sh (порт 3710); работающий сервер никогда не убивай. Параллельно работают помощники других разделов — их файлы не трогай. tsc запускай с --incremental --tsBuildInfoFile .tsbuild/<раздел>.tsbuildinfo и фильтруй вывод по своим путям. Отчёты пиши по-русски.`

function areaHead(a) {
  const spec = a.spec.length ? a.spec.map(s => `${SPEC}/${s}`).join(', ') : 'отдельного файла Altegio нет'
  return `Раздел «${a.title}» (id ${a.id}). Файлы ТЗ раздела: ${spec}. Наши функции раздела из 00-our-decisions.md: ${a.ours}. Твои пути: ${a.routes.join(', ')} + src/areas/${a.id}/**, src/domain/${a.id}.ts, src/mock/slices/${a.id}.ts, src/api/${a.id}.ts, messages/*/${a.id}.json, qa/**/${a.id}*.`
}

const PLAN = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    batches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          fIds: { type: 'array', items: { type: 'string' } },
          screens: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'title', 'fIds'],
      },
    },
    notOurs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { fId: { type: 'string' }, owner: { type: 'string' }, why: { type: 'string' } },
        required: ['fId', 'owner'],
      },
    },
  },
  required: ['total', 'batches', 'notOurs'],
}

const BUILD = {
  type: 'object',
  properties: {
    done: { type: 'array', items: { type: 'string' } },
    partial: {
      type: 'array',
      items: { type: 'object', properties: { fId: { type: 'string' }, what: { type: 'string' } }, required: ['fId', 'what'] },
    },
    assumed: { type: 'array', items: { type: 'string' } },
    requests: { type: 'array', items: { type: 'string' } },
    checks: { type: 'string' },
    marked: { type: 'number' },
  },
  required: ['done', 'partial', 'checks', 'marked'],
}

const DEFECT = {
  type: 'object',
  properties: {
    fId: { type: 'string' },
    severity: { type: 'string', enum: ['block', 'major', 'minor'] },
    where: { type: 'string' },
    what: { type: 'string' },
  },
  required: ['fId', 'severity', 'what'],
}

const MEASURE = {
  type: 'object',
  properties: {
    checked: { type: 'number' },
    passed: { type: 'number' },
    defects: { type: 'array', items: DEFECT },
    report: { type: 'string' },
  },
  required: ['checked', 'passed', 'defects', 'report'],
}

const GAP = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    covered: { type: 'number' },
    missing: {
      type: 'array',
      items: { type: 'object', properties: { fId: { type: 'string' }, what: { type: 'string' } }, required: ['fId', 'what'] },
    },
    violations: { type: 'array', items: { type: 'string' } },
    report: { type: 'string' },
  },
  required: ['total', 'covered', 'missing', 'violations', 'report'],
}

const COV = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    covered: { type: 'number' },
    missingByArea: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          items: {
            type: 'array',
            items: { type: 'object', properties: { fId: { type: 'string' }, what: { type: 'string' } }, required: ['fId', 'what'] },
          },
        },
        required: ['area', 'items'],
      },
    },
    report: { type: 'string' },
  },
  required: ['total', 'covered', 'missingByArea', 'report'],
}

function planPrompt(a) {
  return `${COMMON}

${areaHead(a)}

Ты — ПЛАНИРОВЩИК раздела. Код не пишешь.
1. Выпиши ВСЕ функции раздела: каждый заголовок «### F-…» в файлах ТЗ раздела + перечисленные наши F-00-… (их блоки прочитай целиком). Их число — total.
2. Функцию, чей экран по «Где»/«смежное» явно живёт в другом разделе из docs/areas.json и тот раздел по своему ТЗ её строит, положи в notOurs (owner = id раздела-хозяина). Сомневаешься — оставь себе: лучше дубль, чем пропуск.
3. Остальные разбей на пачки по 25–35 функций в порядке постройки: сначала каркас раздела и главные экраны, потом формы и детали, потом права, настройки и редкое. Каждая функция — ровно в одной пачке. Проверь счётом: сумма fIds всех пачек + notOurs = total.
4. Запиши план в ${P}/qa/plan/${a.id}.md: пачки (id вида b01, b02…), в каждой F-id + название + экраны и маршруты; отдельно notOurs с хозяином.`
}

function buildPrompt(a, task) { return buildPromptFull(a, task) + (NO_TESTS ? NO_TESTS_NOTE : '') }
function buildPromptFull(a, task) {
  let goal
  if (task.kind === 'batch') {
    goal = `Построй пачку ${task.label} «${task.title}»: ${task.fIds.join(', ')}.`
  } else if (task.kind === 'fix') {
    goal = `Измеритель проверил ${task.what} (функции ${task.fIds.join(', ')}) и нашёл дефекты. Почини ВСЕ — block и major обязательно, minor тоже:\n${JSON.stringify(task.defects, null, 1)}`
  } else {
    goal = `Проверяющий пропуски нашёл, что не построено или не доделано. Построй и доделай:\n${JSON.stringify(task.items, null, 1)}${task.violations && task.violations.length ? `\nИ исправь нарушения наших решений:\n${task.violations.join('\n')}` : ''}`
  }
  return `${GUARD}${COMMON}

${areaHead(a)}
План раздела: ${P}/qa/plan/${a.id}.md; прошлые отчёты — ${P}/qa/build/, ${P}/qa/measure/${a.id}/, ${P}/qa/gaps/.

Ты — СБОРЩИК. ${goal}

Для каждой функции прочитай её блок в ТЗ ЦЕЛИКОМ и сделай так, чтобы в интерфейсе на моковых данных выполнялся КАЖДЫЙ пункт «Готово, когда»: кнопки работают, формы проверяют ввод и сохраняют в стор (переживают перезагрузку), списки фильтруются и сортируются, статусы меняются, права по персонам работают, у экранов есть пусто / загрузка / ошибка, всё удобно на телефоне 390×844 и на десктопе. Корневой узел каждой функции помечай data-f="F-…" (несколько функций на экране — у каждой свой узел). Помеченное ❓/🔒 всё равно строй по описанию (🔒 — интерфейс на моках с пометкой «демо»); всё, что пришлось додумать, перечисли в assumed. Нужна правка общего файла — запиши в qa/requests/${a.id}.md и в requests, сам не правь. Уже построенное в разделе не ломай. ОБЯЗАТЕЛЬНО до новой работы: открой все файлы ${P}/qa/measure/${a.id}/ кроме b*-m*/g*-m* (ux-*, speed-*, arch-*, core-rules*, state-*, decision-*, recheck-*, e2e-*, text-*, a11y-*, build-*, ux-best-*) и закрой все block/major, не отмеченные «✅ исправлено», начиная с затронутых тобой экранов (до 30% времени), отметь в файлах «✅ исправлено (<метка>)»; используй готовые компоненты src/ui и правила ядра src/domain/rules вместо своих — CONVENTIONS §0.1, §17, §18.
Перед сдачей: tsc и eslint по своим путям без ошибок; scripts/ensure-dev.sh; scripts/measure.mjs по своим маршрутам — ноль ошибок консоли и сырых ключей; посмотри пару снимков глазами (Read png).
Отчёт — ${P}/qa/build/${a.id}-${task.label}.md. В done — только F-id, у которых выполнены все пункты «Готово, когда»; в partial — что не доделано и почему. В marked — число «помечено» из «node scripts/fids.mjs --area ${a.id}» ПОСЛЕ твоей работы (запусти и перепиши число, не угадывай).${task.retry ? `\nВНИМАНИЕ: прошлая попытка этого задания ничего не построила (${task.retry}). Сделай работу по-настоящему.` : ''}`
}

function measurePrompt(a, what, fIds, label) {
  return `${GUARD}${COMMON}

${areaHead(a)}

Ты — ИЗМЕРИТЕЛЬ. Код продукта НЕ правишь (писать можно только сценарии и отчёты в qa/). Проверяешь ${what}: ${fIds.join(', ')}.
Для каждой функции найди её на экране (data-f) и пройди КАЖДЫЙ пункт «Готово, когда» из ТЗ настоящими действиями в браузере (scripts/measure.mjs + свои сценарии Playwright в qa/scenarios/${a.id}/): под персоной из поля «Роль», в сфере, где функция есть; телефон 390×844 и десктоп 1440×900; языки ru и en; в hy — только отсутствие сырых ключей и настоящий армянский шрифт. Если экран-хозяин из другого раздела ещё не построен — проверяй вклад через /dev/ext/<host>/${a.id}.
Мерь: ошибки консоли и страницы, сырые ключи, вылет по ширине, зоны нажатия < 40px, пусто / загрузка / ошибка, сохранение после перезагрузки, права (чужая персона не видит). Посмотри снимки глазами (Read png): наложения, обрезки, непонятные места, мелкий текст.
Серьёзность: block — функции нет, не открывается или падает; major — пункт «Готово, когда» не выполнен или вид сломан; minor — косметика.
Отчёт — ${P}/qa/measure/${a.id}/${label}.md: таблица «F-id × пункт «Готово, когда» × результат (✅/❌ + что видно)» и пути снимков. checked/passed — число пунктов. «Работает» пишешь только про то, что проверил действием. Браузеры за собой закрывай.`
}

function gapPrompt(a, round) { return gapPromptFull(a, round) + (NO_TESTS ? '\nСЕЙЧАС БЕЗ ТЕСТОВ: браузер не открывай, суди по коду. В missing — только НЕ построенные или явно недоделанные функции; старые замечания замеров (qa/measure) не переносить.' : '') }
function gapPromptFull(a, round) {
  return `${GUARD}${COMMON}

${areaHead(a)}

Ты — ПРОВЕРЯЮЩИЙ ПРОПУСКИ (круг ${round}). Код не правишь.
1. Заново прочитай ТЗ раздела (файлы могли дополниться проверками) и возьми ВСЕ F-id раздела + наши F-00 раздела. Список notOurs из ${P}/qa/plan/${a.id}.md проверь: построил ли хозяин (grep data-f по src); не построил — это твой пропуск.
2. scripts/fids.mjs --area ${a.id} — что помечено в коде. По каждой функции: помечена ли, открывается ли, выполнены ли пункты «Готово, когда» (по коду и отчётам ${P}/qa/measure/${a.id}/; где сомневаешься — проверь в браузере).
3. ВСЕ незакрытые block и major из ВСЕХ файлов ${P}/qa/measure/${a.id}/ — не только замеры, но и ux-* (дизайн), speed-*, arch-*, core-rules*, state-*, decision-*, recheck-*, e2e-*, text-*, a11y-*, build-*, ux-best-*, onboarding-* (закрытое помечено «✅ исправлено»; проверь по коду/экрану, что правда исправлено). Каждое — отдельным пунктом missing (F-id или «ux»/«speed»… + файл замечания + что сделать). Главное: переход раздела на готовые общие компоненты src/ui (StickyActionBar, SlotButton/SlotRow, ScrollRow, BookingStatusBadge, PeriodNav, WeekdayPicker, PhoneVerify и др.) и на правила ядра src/domain/rules.
4. Нарушения наших решений: построено что-то из «Снято», сделано как у Altegio вопреки «У нас: ⭐», скопированы дизайн или тексты Altegio.
missing — всё, что нужно построить или доделать (F-id + что именно); violations — нарушения. total/covered — всего функций и полностью готовых. Отчёт — ${P}/qa/gaps/${a.id}-${round}.md.`
}

function chunk(list, n) {
  const out = []
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n))
  return out
}

async function build(a, task, label, prevMarked) {
  let r = await agent(buildPrompt(a, task), { phase: 'Сборка', schema: BUILD, label, ...CHEAP })
  if (!r) throw new Error(`сборка не вернулась: ${label}`)
  if (task.fIds && task.fIds.length && task.kind === 'batch' && !(r.marked > prevMarked)) {
    log(`${label}: пометок в коде не прибавилось (${prevMarked} → ${r.marked}) — повтор`)
    r = await agent(buildPrompt(a, { ...task, retry: `пометок было ${prevMarked}, стало ${r.marked}` }), { phase: 'Сборка', schema: BUILD, label: `${label}#повтор`, ...CHEAP })
    if (!r) throw new Error(`повтор сборки не вернулся: ${label}`)
  }
  return r
}

async function measureAndFix(a, label, fIds, what) {
  if (NO_TESTS) return { checked: 0, passed: 0, defects: [] }
  let n = 0
  while (true) {
    let m = await agent(measurePrompt(a, what, fIds, `${label}-m${n}`), {
      phase: 'Замер', schema: MEASURE, label: `замер:${a.id}:${label}${n ? '#' + n : ''}`, ...CHEAP,
    })
    // 25.09.2026: измерители Sonnet роняли ответ битым JSON (staff, notify, reports) — повтор вместо обрыва раздела.
    if (!m) m = await agent(measurePrompt(a, what, fIds, `${label}-m${n}j`) + '\nВНИМАНИЕ: прошлый замер упал на битом JSON в ответе. Ответ StructuredOutput — строго валидный JSON: в строках без переводов строк и без неэкранированных кавычек, текст «what» короткий.', {
      phase: 'Замер', schema: MEASURE, label: `замер:${a.id}:${label}${n ? '#' + n : ''}#json`, ...CHEAP,
    })
    if (!m) throw new Error(`замер не вернулся: ${a.id} ${label}`)
    if (!(m.checked > 0)) {
      log(`замер ${a.id} ${label}: ничего не проверено — повтор`)
      m = await agent(measurePrompt(a, what, fIds, `${label}-m${n}r`) + '\nВНИМАНИЕ: прошлый замер не проверил ни одного пункта. Проверь по-настоящему.', {
        phase: 'Замер', schema: MEASURE, label: `замер:${a.id}:${label}${n ? '#' + n : ''}#повтор`, ...CHEAP,
      })
      if (!m || !(m.checked > 0)) throw new Error(`замер снова пустой: ${a.id} ${label}`)
    }
    const serious = m.defects.filter(d => d.severity !== 'minor')
    if (!serious.length || n >= MAX_FIXES) {
      if (serious.length) log(`${a.id} ${label}: после двух починок осталось ${serious.length} серьёзных — уйдут в пропуски`)
      return m
    }
    n++
    await build(a, { kind: 'fix', what, fIds, defects: m.defects, label: `${label}-fix${n}` }, `починка:${a.id}:${label}#${n}`, -1)
  }
}

async function buildItems(a, items, violations, tag) {
  const parts = chunk(items, 30)
  if (!parts.length) parts.push([])
  for (let i = 0; i < parts.length; i++) {
    const label = `${tag}-${i + 1}`
    await build(a, { kind: 'gaps', items: parts[i], violations: i === 0 ? violations : [], label }, `доделка:${a.id}:${label}`, -1)
    const ids = parts[i].map(x => x.fId)
    await measureAndFix(a, label, ids.length ? ids : ['(нарушения)'], `доделку ${label}`)
  }
}

async function runArea(a) {
  // Перезапуск 25.09.2026 18:40 после недельного лимита: план и готовые пачки берутся из прошлого прогона (args).
  if (a.finished) return { area: a.id, total: a.lastGap.total, covered: a.lastGap.covered, missing: a.lastGap.missing, violations: a.lastGap.violations }
  let plan = a.plan
  if (!plan) {
    plan = await agent(planPrompt(a), { phase: 'План', schema: PLAN, label: `план:${a.id}` })
    if (!plan) throw new Error(`план не вернулся: ${a.id}`)
  }
  log(`${a.id}: ${plan.total} функций, ${plan.batches.length} пачек, готово ${a.doneBatches.length}, круг пропусков с ${a.startRound}`)
  let marked = -1
  for (const b of plan.batches) {
    if (a.doneBatches.includes(b.id)) continue
    const r = await build(a, { kind: 'batch', title: b.title, fIds: b.fIds, label: b.id }, `сборка:${a.id}:${b.id}`, marked)
    marked = r.marked
    await measureAndFix(a, b.id, b.fIds, `пачку ${b.id} «${b.title}»`)
  }
  let last = null
  if ((a.startRound || 1) > MAX_ROUNDS) return a.lastGap ? { area: a.id, total: a.lastGap.total, covered: a.lastGap.covered, missing: a.lastGap.missing, violations: a.lastGap.violations } : { area: a.id, total: plan.total, covered: null, missing: null, violations: null }
  for (let round = a.startRound || 1; round <= MAX_ROUNDS; round++) {
    let g = await agent(gapPrompt(a, round), { phase: 'Пропуски', schema: GAP, label: `пропуски:${a.id}:${round}`, ...SMART })
    if (!g) throw new Error(`пропуски не вернулись: ${a.id} ${round}`)
    if (!(g.total > 0)) {
      g = await agent(gapPrompt(a, round) + '\nВНИМАНИЕ: прошлая проверка вернула пустой счёт. Посчитай по-настоящему.', { phase: 'Пропуски', schema: GAP, label: `пропуски:${a.id}:${round}#повтор`, ...SMART })
      if (!g || !(g.total > 0)) throw new Error(`проверка пропусков снова пустая: ${a.id} ${round}`)
    }
    last = g
    log(`${a.id} круг ${round}: готово ${g.covered}/${g.total}, пропусков ${g.missing.length}, нарушений ${g.violations.length}`)
    if ((!g.missing.length && !g.violations.length) || round === MAX_ROUNDS) break
    await buildItems(a, g.missing, g.violations, `g${round}`)
  }
  return { area: a.id, total: last.total, covered: last.covered, missing: last.missing.length, violations: last.violations.length }
}

phase('План')
// 25.09.2026 пользователь: «не нужно, чтобы все токены закончились за час» — одновременно только WORKERS разделов.
const WORKERS = 8
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
const results = await pool(AREAS, WORKERS, a => runArea(a))
const failed = AREAS.filter((a, i) => !results[i]).map(a => a.id)
if (failed.length) {
  log(`Не закончены разделы (обрыв, вероятно лимит): ${failed.join(', ')} — нужен перезапуск с resumeFromRunId`)
  return { incomplete: true, failed, results: results.filter(Boolean) }
}

phase('Сверка')
const coveragePrompt = `${GUARD}${COMMON}

Ты — ОБЩАЯ СВЕРКА ОХВАТА. Код не правишь. Все 18 разделов прошли свои круги (итоги — ${P}/qa/gaps/, планы — ${P}/qa/plan/).
1. scripts/fids.mjs --json: все F-id из ${SPEC}/*.md (перечитай — файлы могли дополниться) против data-f в src. Каждый непомеченный F-id отнеси к разделу-хозяину (docs/areas.json, notOurs в планах; функция, которую никто не взял, — тому разделу, где её экран по «Где»).
2. Отдельно 00-our-decisions.md §18 (F-00-184…201, список «максимум функционала»): каждый пункт должен где-то работать — найди где, нет — пропуск разделу-хозяину.
Запиши ${P}/qa/COVERAGE-1.md: всего, покрыто, пропуски по разделам. missingByArea — только разделы с пропусками.`
const cov = NO_TESTS ? { total: 0, covered: 0, missingByArea: [] } : await agent(coveragePrompt, { phase: 'Сверка', schema: COV, label: 'сверка:охват', ...SMART })
if (!cov) return { incomplete: true, stage: 'сверка', results }
log(`Охват: ${cov.covered}/${cov.total}; разделов с пропусками ${cov.missingByArea.length}`)
const byId = {}
for (const a of AREAS) byId[a.id] = a
const leftovers = cov.missingByArea.filter(x => byId[x.area] && x.items.length)
const fixed = await pool(leftovers.map(x => ({ ...x, id: x.area })), WORKERS, async x => {
  await buildItems(byId[x.area], x.items, [], 'cov')
  return x.area
})

phase('Итог')
const hy = await pool(AREAS, WORKERS, a => agent(`${GUARD}${COMMON}

Ты — РЕДАКТОР АНГЛИЙСКОГО раздела ${a.id} (25.09.2026 пользователь: «пока только английский и русский»; армянский выключен, не пиши его). Код не правишь, только ${P}/messages/en/${a.id}.json${a.id === 'client' ? ` и ${P}/messages/en/common.json` : ''}. Сверь с ${P}/messages/ru/${a.id}.json: в en есть ВСЕ ключи ru (скриптом), перевод живой и естественный, термины по глоссарию docs/TEXT-STYLE.md, плейсхолдеры {…} и ICU plural целы, JSON валиден. Ответ — одной строкой: сколько ключей добавлено/исправлено.`, { phase: 'Итог', label: `английский:${a.id}`, ...CHEAP }))

const finalPrompt = `${GUARD}${COMMON}

Ты — ИТОГОВЫЙ ПИСАРЬ. Код не правишь, браузер не открываешь (тесты отложены до бэкенда).
1. scripts/fids.mjs --json — итоговый охват → ${P}/COVERAGE.md (всего, покрыто, по разделам, непокрытые списком).
2. ${P}/STATUS.md — для пользователя, по-русски, просто: по разделам «функций / готово / осталось»; что помощники ДОДУМАЛИ сами (assumed из ${P}/qa/build/*.md — сгруппируй, убери повторы); просьбы к общим файлам (qa/requests/*.md); что не получилось.
Ответ — короткая сводка числами.`
const fin = await agent(finalPrompt, { phase: 'Итог', label: 'итог', ...SMART })
return { results, coverage: { total: cov.total, covered: cov.covered }, leftoversFixed: fixed.filter(Boolean), en: hy.filter(Boolean).length, final: fin }
