# schedule — починка g1-3, пачка fix2 (25.09.2026)

Измеритель прислал те же 11 дефектов на доделку g1-3 повторно (F-02-088, F-02-011, F-02-040,
F-02-084, F-02-104, F-02-096, F-02-092, F-02-093, F-02-094, F-02-101, F-02-091) — список идентичен
пачке fix1.

## Что проверила заново (не поверила прошлому отчёту на слово)

Перепрошла все 11 F-id ещё раз с нуля, как будто fix1 не было:

1. Сверила каждый F-id с таблицей «notOurs» в `qa/plan/schedule.md` (строки ~170–195) — таблица
   не менялась с fix1 (файл принадлежит планировщику, не мне, я его не трогаю).
2. Перегрепала контракт в `src/api/schedule.ts` — все функции, которые он обязан отдавать другим
   разделам, на месте и экспортированы:
   `getScheduleEnd`, `getScheduledMinutes`, `getWorkDays`, `getDayLoad`, `addWorkDays`, `removeWorkDays`.
3. Перечитала `src/domain/schedule.ts:14-15` — `DayTypeId = SystemDayTypeId | \`custom:${string}\``
   на месте, комментарий над ним прямо говорит: «строится разделом network, здесь только формат ссылки».
4. Прогнала `node scripts/fids.mjs --area schedule` — 77/121, без изменений.

Результат тот же, что в fix1, с той же таблицей владения:

| F-id | Экран из дефекта | Владелец | Наш контракт |
|---|---|---|---|
| F-02-011 | Свои типы нерабочих дней, `/biz/network/staff/off-days` | network | `DayTypeId` (формат `custom:${string}`) готов |
| F-02-040 | Уведомление «Скорое завершение расписания», `/biz/notifications/types/[typeId]` | notify | `getScheduleEnd` готов |
| F-02-084 | Метрики заполненности, `/biz/reports` | reports | `getScheduledMinutes`/`getWorkDays` готовы |
| F-02-104 | Заполненность в аналитике моб. приложения, `/biz/reports` | reports | то же |
| F-02-096 | Зарплата «за рабочий день», `/biz/payroll` | payroll | `getScheduledMinutes`/`getWorkDays` готовы |
| F-02-092 | Beauty AI «Кого позвать», `/biz/integrations` | integrations | `getFreeSlots`/`getNearestSlots` без изменений сигнатур |
| F-02-093 | Внешние ИИ-боты, `/biz/integrations` | integrations | то же |
| F-02-094 | Power BI отчёт, `/biz/integrations` + `/biz/reports` | integrations | то же |
| F-02-101 | Google Карты, `/biz/integrations` | integrations | то же |
| F-02-091 | Картинка Open Slots, `src/app/biz/apps/stories` | client | `getFreeSlots` без изменений; F-00-155…158 в наш список 00 §5 (F-00-051…064) не входят |
| F-02-088 | Текст «часы работы» в контактах локации | settings | данные графика не менялись, готовы как раньше |

Ни один из 11 дефектов не лежит в путях раздела `schedule` (`src/app/biz/schedule/**`,
`src/areas/schedule/**`, `src/domain/schedule.ts`, `src/mock/slices/schedule.ts`, `src/api/schedule.ts`,
`messages/*/schedule.json`) — правило 1 CONVENTIONS.md запрещает мне строить экраны в чужих путях
(`src/app/biz/network/**`, `/notifications/**`, `/reports/**`, `/payroll/**`, `/integrations/**`,
`src/app/biz/apps/**`, `/settings/**`), тем более пока там параллельно работают их сборщики (правило
«чужие файлы не трогай»).

Правка кода не требовалась и не делалась — сторона schedule (API-контракт под все 11 функций) была
готова уже к b02/g1-2 и не пострадала.

## Что сделала

- Оставила запись в `qa/requests/schedule.md` уже есть от fix1 (раздел «g1-3-fix1») — она актуальна
  дословно, повторный дефект её не отменяет и не требует новой записи; вместо дублирования прошу
  измерителя в следующий раз перед отправкой сверяться с таблицей notOurs `qa/plan/schedule.md`
  (в ней ровно эти 11 F-id уже размечены по владельцу).

## Проверки

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/schedule-g13fix2.tsbuildinfo` — по путям
  schedule 0 ошибок (три оставшихся TS-ошибки в проекте — `src/areas/client/apps/BrandedAppScreen.tsx`
  и `src/areas/journal/lib/rights.ts`, чужие пути, не трогала).
- `npx eslint` по `src/app/biz/schedule/**`, `src/areas/schedule/**`, `src/domain/schedule.ts`,
  `src/mock/slices/schedule.ts`, `src/api/schedule.ts` — 0 ошибок.
- `scripts/ensure-dev.sh` — сервер уже работал на :3710, не трогала.
- `node scripts/fids.mjs --area schedule` — 77/121 (63.6%), без изменений (регрессии нет, доделки
  не требовалось).
- Снимки не смотрела — ни один экран в моих путях в этой пачке не менялся.

## done

(пусто — все 11 дефектов относятся к экранам вне путей schedule; см. таблицу выше)

## partial

- F-02-011, F-02-040, F-02-084, F-02-104, F-02-096, F-02-092, F-02-093, F-02-094, F-02-101, F-02-091,
  F-02-088 — не дефект schedule повторно подтверждено; экран строит другой раздел (таблица выше и
  `qa/requests/schedule.md`, запись «g1-3-fix1»). Контракт (API/типы) со стороны schedule под каждую
  функцию готов и перепроверен в этой пачке заново.

## assumed

- Ничего не додумывала — правок не делала, только перепроверила границы владения заново (не по памяти
  fix1, а с нуля: grep контракта, чтение domain-комментария, таблица notOurs, fids.mjs).

## marked

77 (`node scripts/fids.mjs --area schedule`, после этой пачки; без изменений — правок в коде не было).
