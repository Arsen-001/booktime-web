# Отчёт починки g3-2-fix2 — раздел schedule

25.09.2026. Измеритель проверил доделку g3-2 и нашёл 20 дефектов (16 block + 4 major). Это шестая пачка
подряд с идентичным списком (g1-2-fix2 → g2-2-fix1 → g2-2-fix2 → g3-2 → g3-2-fix1 → g3-2-fix2). Полная
проверка сделана заново, не по памяти — файловая система и grep дали те же результаты, что и в прошлой
пачке; подробности и команды — в новой записи `qa/requests/schedule.md` (раздел «g3-2-fix2»).

## Вывод по каждому F-id

**16 block — физически не в путях `schedule`, ничего не строила повторно:**

| F-id | Владелец | Почему не мой путь |
|---|---|---|
| F-02-022 | staff | платные места/лицензия — не мой домен |
| F-02-058 | services | длительность услуги у сотрудника — форма услуги |
| F-02-060 | services | техперерыв услуги — форма/список услуги |
| F-02-063 | services | «Операции с Excel» услуг |
| F-02-018 | settings (onboarding) | шаг 3 быстрого старта |
| F-02-074 | settings | часовой пояс локации — поле в настройках локации |
| F-02-088 | settings | часы работы локации в контактах (текст) |
| F-02-011 | network | «Типы нерабочих дней» сети |
| F-02-040 | notify | тип уведомления 19 (SMS) |
| F-02-084 | reports | отчёт «Заполненность» |
| F-02-096 | payroll | зарплата «за рабочий день» |
| F-02-093 | integrations | внешние ИИ-боты/маркетплейс |
| F-02-101 | integrations | Google Карты |
| F-02-104 | — | мобильного приложения в проекте нет вовсе — предложено снять с плана |
| F-02-094 | — | решения по Power BI нет в `00-our-decisions.md` — предложено снять с плана до решения владельца |
| F-02-036 | journal | сам ТЗ помечает 🔒 мобильное; веб-эквивалент (клик по пустому месту журнала) строит `journal` по F-01-184 |

Готовые контракты для всех 16 (`getScheduleEnd`, `getScheduledMinutes`, `getWorkDays`, `addWorkDays`,
`getBufferMin`/`setBufferMin`, `DayTypeId`, `Location.timezone`) уже есть в `src/api/schedule.ts` /
`src/domain/schedule.ts` и не менялись — экранов у владеющих разделов ещё нет (перепроверено сегодня, см.
`qa/requests/schedule.md`).

**4 major — проверены действием:**

- **F-02-066 — done.** `SettingsHub.tsx` (`/dev/ext/settingsHub/schedule`) → `setAllowOnlineOverNoShow` →
  `computeFreeSlots`/`isBookingInactive` в `src/api/schedule.ts` → потребитель `online`
  (`BookingWizard.tsx` → `getFreeSlots`) реально видит окно свободным у записи со статусом `no_show`, когда
  флажок включён. Проверено переключением флажка и повторным чтением `getFreeSlots` — сквозная цепочка
  внутри моих файлов + `core.bookings`.
- **F-02-081/082/083 — partial.** Пишущая сторона в `src/areas/schedule/extensions/StaffCard.tsx`
  (`/dev/ext/staffCard/schedule`) работает и переживает перезагрузку (`setIncludeInFillRate`,
  `setHiddenInJournal`, `setJournalMarkupMin` пишут в `Staff` из `core.ts`). Читающая сторона — колонка
  сотрудника в `journal` и расчёт заполненности в `reports` — не построена в тех разделах (0 совпадений
  `grep`), эффект нельзя показать без их экранов.

## Проверки

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/schedule.tsbuildinfo` — 0 ошибок по путям schedule.
- `npx eslint` по своим путям (`src/app/biz/schedule/**`, `src/areas/schedule/**`, `src/domain/schedule.ts`,
  `src/mock/slices/schedule.ts`, `src/api/schedule.ts`) — 0 ошибок.
- `scripts/ensure-dev.sh` — сервер уже работал на 3710, не трогала.
- `/dev/ext/staffCard/schedule` и `/dev/ext/settingsHub/schedule` открыты и проверены действием (переключение
  флажков, сохранение, повторное чтение через API) — без изменений с прошлой пачки, работают.
- `node scripts/fids.mjs --area schedule` — см. `marked` ниже.

## done

Из этой пачки:
- F-02-066 (подтверждена повторно — уже была done в g3-2-fix1)

## partial

- F-02-081 — тумблер «учитывать в заполненности» пишет верно, расчёт заполненности не в моих путях (`reports`)
- F-02-082 — тумблер «не отображать в журнале» пишет верно, скрытие колонки не в моих путях (`journal`)
- F-02-083 — разметка пишет верно, отображение в колонке журнала не в моих путях (`journal`)
- F-02-022/058/060/063/018/074/088/011/040/084/096/093/101 — экран/поле целиком в чужих путях
  (services/settings/network/notify/reports/payroll/integrations/staff) — готовый контракт в
  `src/api/schedule.ts` есть, экрана нет; повторная просьба в `qa/requests/schedule.md`
- F-02-036 — веб-эквивалент строит `journal` (F-01-184); в самом ТЗ помечено 🔒 мобильное
- F-02-104 — предложено снять с плана: мобильного приложения в проекте нет
- F-02-094 — предложено снять с плана до решения владельца по Power BI (00-our-decisions.md)

## assumed

- Все 16 block-находок измерителя относятся к экранам, формально закреплённым за другими разделами в
  `qa/plan/schedule.md` (таблица notOurs) и `docs/areas.json`; сборка в чужих путях запрещена
  CONVENTIONS.md §1, поэтому вместо кода — контракт в `src/api/schedule.ts` + запись-просьба.
- F-02-104 и F-02-094 предложено снять с плана раздела (нет мобильного приложения; нет решения владельца).

## checks

tsc --incremental (schedule paths): 0 ошибок · eslint (schedule paths): 0 ошибок · dev-сервер: уже работал
на 3710, не перезапускала · `/dev/ext/staffCard/schedule` и `/dev/ext/settingsHub/schedule` проверены
действием.
