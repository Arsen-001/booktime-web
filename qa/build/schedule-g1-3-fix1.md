# schedule — починка g1-3, пачка fix1 (25.09.2026)

Измеритель прислал 11 дефектов на доделку g1-3 (F-02-088, F-02-011, F-02-040, F-02-084, F-02-104,
F-02-096, F-02-092, F-02-093, F-02-094, F-02-101, F-02-091).

## Что выяснила

Сверила каждый F-id с таблицей «notOurs» в `qa/plan/schedule.md` (строки 181–191) и с
`node scripts/fids.mjs --area schedule` (44 не помечены — ровно совпадают со списком notOurs).
Результат: **9 из 11 дефектов — экраны, которые строят другие разделы**, не schedule:

| F-id | Экран из дефекта | Владелец |
|---|---|---|
| F-02-011 | `/biz/network/staff/off-days` | network |
| F-02-040 | `/biz/notifications/types/[typeId]` (тип 19) | notify |
| F-02-084 | `/biz/reports` | reports |
| F-02-104 | `/biz/reports` (аналитика приложения) | reports |
| F-02-096 | `/biz/payroll` | payroll |
| F-02-092 | `/biz/integrations` (Beauty AI) | integrations |
| F-02-093 | `/biz/integrations` (внешние боты) | integrations |
| F-02-094 | `/biz/integrations` + `/biz/reports` (Power BI) | integrations |
| F-02-101 | `/biz/integrations` (Google Карты) | integrations |
| F-02-091 | `src/app/biz/apps/stories` | client (F-00-155…158 не входят в наш список 00 §5) |

Я не владею этими путями (правило 1 CONVENTIONS.md: «пишите только в своих путях») и не должна трогать
файлы других разделов, пока с ними параллельно работают их сборщики. Строить сами экраны — не могу.

Проверила, что **со стороны schedule контракт под все эти функции уже готов** и не пострадал:
- `DayTypeId = SystemDayTypeId | \`custom:${string}\`` (src/domain/schedule.ts) — задел под F-02-011 на месте.
- `getScheduleEnd`, `getScheduledMinutes`, `getWorkDays` (src/api/schedule.ts) — экспортированы, покрывают
  F-02-040/084/096/104.
- Для F-02-092/093/094/101/091 (внешние интеграции и приложение) наш вклад — тот же `getFreeSlots`/
  `getNearestSlots`/`computeFreeSlots`, сигнатуры не менялись.

Записала это подробно в `qa/requests/schedule.md` (запись от 25.09.2026), с просьбой к измерителю
сверяться с таблицей notOurs по F-id, а не по владельцу пачки.

**F-02-088** («Часы работы локации в контактах — только текст») — единственный формально «наш» по
владению (settings строит экран, schedule снабжает данными) — со стороны schedule ничего не менялось,
данные графика для него отдаются как раньше.

## Проверки

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/schedule-fix1.tsbuildinfo` — 0 ошибок в
  путях schedule (весь проект тоже чист).
- `npx eslint` по `src/app/biz/schedule/**`, `src/areas/schedule/**`, `src/domain/schedule.ts`,
  `src/mock/slices/schedule.ts`, `src/api/schedule.ts` — 0 ошибок.
- `scripts/ensure-dev.sh` — сервер уже работал на :3710, не трогала.
- `node scripts/fids.mjs --area schedule` — 77/121 (63.6%), не изменилось (регрессии нет).

Замеры страниц (measure.mjs) не гоняла отдельно — ни один экран в моих путях в этой пачке не менялся,
менять было нечего.

## done

(пусто — все 11 присланных дефектов относятся к экранам, недоступным моему разделу; ни один пункт
«Готово, когда» не мог быть закрыт правкой в моих путях)

## partial

- F-02-011, F-02-040, F-02-084, F-02-104, F-02-096, F-02-092, F-02-093, F-02-094, F-02-101 — не
  дефект schedule; экран строит другой раздел (см. таблицу выше и `qa/requests/schedule.md`). Наш
  контракт (API/типы) под каждую готов и проверен.
- F-02-091 — то же: картинка сторис живёт в `client`/`apps`, не в schedule; наша часть (F-00-051…064)
  этой функции не касается.
- F-02-088 — наша сторона (данные графика для текста в контактах) не менялась, готова с прошлой пачки;
  сам текстовый вывод строит `settings`.

## assumed

- Ничего не додумывала — правки не делала, только проверила границы владения по существующим
  документам (`qa/plan/schedule.md`, `docs/areas.json`, `AREAS.md`).

## marked

77 (`node scripts/fids.mjs --area schedule`, после этой пачки; без изменений — правок в коде не было).
