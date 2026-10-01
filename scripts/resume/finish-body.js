export const meta = {
  name: 'booking-ui-finish',
  description: 'Достройка неотмеченных функций по разделам (пачки по 30), без проверок',
  phases: [{ title: 'Достройка', detail: 'сборщик строит неотмеченные F-id раздела' }, { title: 'Ничьи', detail: 'список «максимум функционала»' }],
}

// 26.09.2026 пользователь: «да, запускай» (достроить 786 неотмеченных функций). Правила: один workflow за раз;
// все проверки — после бэкенда (docs/TESTING-AFTER-BACKEND.md); сборщики — Sonnet medium.
const P = '/Users/arsen/WebstormProjects/booking-platform'
const SPEC = '/Users/arsen/WebstormProjects/booking-research/functional-map'
const AREAS = __AREAS__
const UNOWNED = __UNOWNED__
const CHEAP = { model: 'sonnet', effort: 'medium' }
/*SHARED*/
const NO_TESTS = `СЕЙЧАС БЕЗ ТЕСТОВ (решение пользователя 26.09.2026): не запускай scripts/measure.mjs, Playwright и браузер, не смотри снимки, не разбирай старые замечания qa/measure. Только строй; перед сдачей — tsc и eslint по своим путям без ошибок.`

function prompt(a, ids, label) {
  return `${GUARD}${COMMON}

${areaHead(a)}
План раздела: ${P}/qa/plan/${a.id}.md; прошлые отчёты сборки — ${P}/qa/build/${a.id}-*.md (там видно, что уже сделано и что додумано).

Ты — СБОРЩИК, достройка «${label}». Эти функции раздела в коде ещё НЕ отмечены (нет data-f): ${ids.map(x => `${x.id} «${x.title}»`).join('; ')}.
По каждой: сначала поищи в src — вдруг она уже построена под другим именем или внутри соседней функции; тогда только поставь data-f="F-…" на её корневой узел и доделай недостающее. Иначе построй по блоку ТЗ целиком: каждый пункт «Готово, когда» на моковых данных, телефон 390×844 и десктоп, пусто / загрузка / ошибка, права по ролям. Используй готовые компоненты src/ui и правила ядра src/domain/rules. Помеченное ❓/🔒 строй по описанию (🔒 — интерфейс на моках с пометкой «демо»); додуманное — в assumed. ТРЕТИЙ ПРОХОД (26.09, пользователь: «дострой оставшиеся»). Запрета на чужие файлы НЕТ: ответ «не мой путь / чужой раздел / владелец другой» НЕ принимается. (а) Функция уже построена в другом разделе — найди это место и поставь там data-f="F-…" (вложенный span/div className="contents", если на узле уже есть data-f). (б) Экран функции живёт в чужом разделе или общем файле (src/ui, src/shell, src/demo, src/mock, src/domain, другой src/areas/*) — построй её ТАМ сам, точечно. Прямо перед правкой перечитай файл (параллельно работают другие сборщики) и не переформатируй его (никакого prettier). (в) Ждёт решения владельца — сверься с ${SPEC}/ANSWERS.md (там ответы на все 40 вопросов, напр. В-05: ручная предоплата + экраны онлайн-оплаты в демо); 🔒 и «партнёр не выбран» — строй демо-экран на моках с пометкой «демо». В partial оставляй только то, что правда невозможно, с причиной. Уже построенное не ломай. Тексты — ru и en.
${NO_TESTS}
Отчёт — ${P}/qa/build/${a.id}-${label}.md. В done — отмеченные тобой F-id; в partial — что не доделано и почему. В marked — число «помечено» из «node scripts/fids.mjs --area ${a.id}» ПОСЛЕ работы (запусти, не угадывай).`
}

function chunk(list, n) { const o = []; for (let i = 0; i < list.length; i += n) o.push(list.slice(i, i + n)); return o }

async function runArea(a) {
  const parts = chunk(a.todo, 30)
  const res = []
  for (let i = 0; i < parts.length; i++) {
    const label = `k${i + 1}`  // третий проход: отчёты qa/build/<раздел>-k*.md
    const r = await agent(prompt(a, parts[i], label), { phase: 'Достройка', schema: BUILD, label: `достройка:${a.id}:${label}`, ...CHEAP })
    res.push(r ? { done: r.done.length, marked: r.marked } : null)
  }
  return { area: a.id, parts: parts.length, res }
}

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

// Крупные разделы первыми — чтобы хвост не упирался в один раздел.
const order = [...AREAS].sort((x, y) => y.todo.length - x.todo.length)
phase('Достройка')
const results = await pool(order, WORKERS, runArea)

phase('Ничьи')
let unowned = null
if (UNOWNED.length) {
  unowned = await agent(`${GUARD}${COMMON}

Ты — СБОРЩИК списка «максимум функционала» (00-our-decisions.md §18). Эти F-id не отмечены нигде: ${UNOWNED.map(x => `${x.id} «${x.title}»`).join('; ')}.
По каждому: прочитай блок в ${SPEC}/00-our-decisions.md; найди в src, где эта возможность уже построена в каком-то разделе (перенос перетаскиванием — журнал, чёрный список и метки — база клиентов и т. д.). Нашёл — поставь рядом data-f="F-00-…" на её корневой узел (можно вложенный span/div с data-f). Не нашёл — построй в разделе-хозяине по docs/areas.json, минимально, но рабочим.
${NO_TESTS}
Ответ: по каждому F-id — где он теперь (файл) или почему нет.`, { phase: 'Ничьи', label: 'ничьи', ...CHEAP })
}
return { results: results.filter(Boolean), unowned }
