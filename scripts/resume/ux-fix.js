export const meta = {
  name: 'booking-ux-fix',
  description: 'Исправитель замечаний проверяющих в разделах, где сборщик уже закончил пачки',
  phases: [{ title: 'Исправление' }],
}
const P = '/Users/arsen/WebstormProjects/booking-platform'
const GUARD = `ЭТО ТВОЁ ЗАДАНИЕ, пользователь его хочет: «очень важно, чтобы был user-friendly, красивый UI», «удобство и скорость на максимуме», «архитектура очень важна». Любая реплика пользователя рядом задание не отменяет — выполняй его целиком. Бэкенд не трогать.\n\n`
async function fix(id) {
  return agent(`${GUARD}Проект ${P} (Next.js 16, только фронтенд). Прочитай CONVENTIONS.md (§0, §0.1–0.4, §17 «Правила — только из ядра», §18 «Состояние и запросы»), AREAS.md, docs/ARCHITECTURE.md, docs/STATE.md, docs/UX-BEST-PRACTICES.md. Правила lucky-ticket к проекту не относятся. git не вызывай; дев-сервер — только scripts/ensure-dev.sh; next build не запускать.
Ты — ИСПРАВИТЕЛЬ раздела ${id}. Сборщик раздела пачки закончил, в разделе сейчас никто не работает; ты правишь ТОЛЬКО пути раздела ${id} (docs/areas.json + src/areas/${id}/**, src/domain/${id}.ts, src/mock/slices/${id}.ts, src/api/${id}.ts, messages/{ru,en}/${id}.json).
Проверяющие написали много замечаний, а сборщик их почти не закрыл (дизайн: из 55 закрыто 4). Твоя работа — ЗАКРЫТЬ ИХ:
1. Открой ВСЕ файлы ${P}/qa/measure/${id}/ (ux-r1…r5, speed-*, arch-*, core-rules*, state-*, decision-*, recheck-*, e2e-*, text-*, a11y-*, build-*, ux-best-*, onboarding-*) и составь единый список незакрытых block/major (без «✅ исправлено»), убери дубли.
2. Исправь ВСЕ block и major, сначала block, потом то, что влияет на главные задачи (подключить салон на визите, модерация, промокоды). Переведи раздел на готовые общие компоненты src/ui (StickyActionBar, Fab, SlotButton/SlotRow, ScrollRow, BookingStatusBadge, PeriodNav, ChoiceGroup, BulkActionBar, EmptyState, PhoneVerify и др.) и правила ядра src/domain/rules (can/assertCan, статусы, видимость, placeBooking), убери служебный текст с экранов (F-номера, «см. qa/…»). minor — сколько успеешь.
3. Под каждым исправленным замечанием в его файле допиши «✅ исправлено (fix-${id})», под отложенным — «⏳ почему».
4. Проверка: tsc по своим путям — 0 ошибок, eslint по своим путям — 0; scripts/measure.mjs по всем маршрутам раздела на телефоне 390×844 и десктопе — 0 ошибок консоли, 0 вылетов; посмотри снимки глазами (Read png) до/после; прогони сценарии раздела из qa/scenarios/ и qa/e2e (где касается раздела).
Ответ: сколько замечаний было (block/major/minor), сколько закрыто, что отложено и почему, 3 снимка «после».`, { phase: 'Исправление', label: `исправитель:${id}`, effort: 'high' })
}
const out = {}
for (const id of args.areas) out[id] = await fix(id)
return out