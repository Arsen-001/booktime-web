# notify · доделка g3-1-fix1 (25.09.2026)

Починка по трём дефектам, найденным измерителем на доделке g3-1 (F-05-001…F-05-051, 30 функций).

## Дефекты из задания

### F-05-003 · major — тумблер типа не переживает reload
Причина — фундамент (`src/mock/db.ts`, `flush()`): `[mock-db] не удалось сохранить в localStorage
QuotaExceededError … 'bp-mock-db' exceeded the quota`, тот же эффект уже задокументирован для
payroll/loyalty/stock. **Не правил напрямую** (не мой путь, CONVENTIONS §1) — просьба уже была подана
в `qa/requests/notify.md` (запись от измерителя g3-1) и совпадает с открытыми просьбами трёх других
разделов. Подтвердил живьём через `measure.mjs` на `/biz/notifications`, `/biz/notifications/types/19`,
`/biz/notifications/channels`: та же ошибка в консоли на каждой странице (`qa/shots/custom/report.json`).
До правки `db.ts` тумблер типа технически не проходит «Готово, когда» (не переживает reload) —
**в partial**, не в done.

### F-05-048 · minor — у строки типа 19 бейдж канала «SMS», хотя по ТЗ меток быть не должно
Подтверждено по ТЗ (`05-notifications.md` F-05-048: «В списке типов у строки нет меток каналов»).
Починил: `src/areas/notify/TypesTab.tsx` — для `type.code === 19` список бейджей каналов (включая
плейсхолдер «нет каналов») теперь не рендерится вообще, строка показывает только тумблер и название.
Остальные типы не затронуты (список каналов у них по-прежнему считается из `type.channels`).
Проверено на `/biz/notifications/types/19` (скрин `biz-notifications-types-19__owner-nails-ru-light-phone.png`)
и на списке `/biz/notifications` — теперь **в done**.

### Флейк — «Router action dispatched before initialization» на `/biz/notifications/types/16`
Не воспроизводится изолированным повтором (сказано в задании), это dev-роутер Next при параллельных
браузерах, а не баг notify. Действий не требуется.

## §0.1 — замечания измерителей вне своей пачки (обязательный проход)

Прочитаны все файлы `qa/measure/notify/`, кроме `b*-m*`/`g*-m*` и категорий `ux-*`, `speed-*`, `arch-*`,
`core-rules*`, `state-*`, `decision-*`, `recheck-*`, `e2e-*`, `text-*`, `a11y-*`, `build-*`, `onboarding-*`,
`ux-best-*`, `core-*` — остались `bell.json`, `demo-q4.md`, `g21-report.json`, `g21-types-report.json`,
`persist.json`, `persist2.json`, `scen1/2/3.json`.

- `demo-q4.md` — **block**: интерфейс салона показывал название «Altegio» (WhatsApp-экран, каталог каналов,
  подсказки, `messages/*/notify.json`). Проверил живым `grep -rn -i altegio messages/ru/notify.json
  messages/en/notify.json` — пользовательских строк с «Altegio» нет (только служебные идентификаторы в коде:
  `getAltegioWhatsApp`, `AltegioWhatsAppMode` — не текст на экране). Кто-то из более ранних пачек уже починил;
  отметил `✅ исправлено (g3-1-fix1)` в файле.
- `demo-q4.md` — **minor**: «Продвижение: Open Slots, «Кого позвать»» на русском. Было ещё не исправлено —
  поправил `messages/ru/notify.json` → `more.promotion` на «Продвижение: свободные окна, «Кого позвать»»,
  отметил `✅ исправлено (g3-1-fix1)`.
- `g21-report.json`, `g21-types-report.json`, `bell.json`, `scen1/2/3.json`, `persist.json`, `persist2.json` —
  сырые отчёты `measure.mjs` (JSON), без нарочитых пометок block/major; `consoleErrors: 0`, `badResponses: 0`,
  `rawKeys: 0`, `overflowPages: 0` во всех. Единственная находка — `smallTargets: 1` в `g21-types-report.json`:
  кнопка «назад» (`PageHeader` → `LinkButton size="sm"`, 40px высотой) на `/biz/notifications/types/1`. Это
  компонент фундамента (`src/ui/PageHeader.tsx`), не мой путь; и по CONVENTIONS §0 40px — разрешённый минимум
  («ничего нажимаемого меньше 40 px»), так что это не нарушение правила, действий не потребовалось.

## Проверка перед сдачей

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/notify.tsbuildinfo` → 0 ошибок в путях notify.
- `npx eslint src/areas/notify src/domain/notify.ts src/mock/slices/notify.ts src/api/notify.ts` → 0 ошибок.
- `scripts/ensure-dev.sh` → сервер уже работал на 3710, не трогал.
- `node scripts/measure.mjs --routes /biz/notifications,/biz/notifications/types/19,/biz/notifications/channels`
  → 6 страниц, 0 ошибок консоли, 0 4xx/5xx, 0 i18n-пропусков, 0 сырых ключей, 0 вылетов, 0 мелких целей;
  6 предупреждений — все та же фундаментная `QuotaExceededError` из `db.ts` (см. F-05-003 выше, уже в просьбе).
- Снимки просмотрены глазами: `biz-notifications__owner-nails-ru-light-desktop.png` (список типов, чисто,
  без «Open Slots» на английском в контексте — строка не в кадре, проверено текстом в json),
  `biz-notifications-types-19__owner-nails-ru-light-phone.png` (страница типа 19, только SMS-блок «Подключить»,
  соответствует ТЗ).
- `node scripts/fids.mjs --area notify` → **120 / 139 (86.3%)**.

## Замечание по составу задания

F-05-041 «Ссылка на онлайн-занятие (через тип 73, только Email)» пришёл в списке g3-1 от измерителя, но по
`qa/plan/notify.md` (таблица b02) и трём файлам `qa/gaps/notify-*.md` эта функция — **хозяин resources**
(F-16-081…083, окно группового события `/biz/groups`), не notify; та же путаница уже описана в
`qa/requests/notify.md` («notify-g1-3-fix1», «notify-g1-4»). Не строил в своих путях (CONVENTIONS §1
запрещает строить в чужих `src/areas/resources/**`); не в done.

## Готово

**done (28):** F-05-001, F-05-002, F-05-008, F-05-009, F-05-010, F-05-011, F-05-012, F-05-022, F-05-024,
F-05-025, F-05-026, F-05-028, F-05-029, F-05-030, F-05-031, F-05-032, F-05-035, F-05-036, F-05-037,
F-05-038, F-05-039, F-05-042, F-05-043, F-05-046, F-05-047, F-05-048, F-05-049, F-05-051.

**partial (2):**
- F-05-003 — тумблер типа: сама функция (список, тумблер, фильтр, страница типа) работает; «Готово, когда»
  требует пережить reload — блокирует фундаментный баг `db.ts` (`flush()`/localStorage quota), просьба уже
  подана, ждёт общей правки (переезд на IndexedDB / больше квоты / видимая ошибка вместо тихого отката).
- F-05-041 — не функция notify (хозяин resources), в g3-1 попала по ошибке измерителя; см. выше.

**marked:** 120 (`node scripts/fids.mjs --area notify`, после этой пачки).
