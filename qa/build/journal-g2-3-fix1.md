# journal — пачка g2-3-fix1 (починка дефектов измерителя после g2-3)

25.09.2026. Дефекты из отчёта измерителя (после доделки g2-3, функции ux):

## F-01-018 (major) — «Расписание не установлено» ложно на телефоне, ~1 из 6 открытий

**Причина (гонка данных, verified чтением кода):** `hoursQuery` (график сотрудников,
`getStaffHoursMap`) грузится ВТОРЫМ шагом — её ключ и `enabled: allStaffIds.length > 0` зависят
от `staffQuery.data`, доступного только следующим рендером после ответа `staffQuery`. При этом
общий `isLoading` экрана считался из `staffQuery/bookingsQuery/clientsQuery/servicesQuery` —
`hoursQuery` в него не входила. При задержке мока 150–400 мс (`scripts/mock/request.ts`, не мой
путь) `hoursQuery` иногда не успевала прийти к моменту, когда экран уже прошёл гейт загрузки:
`staffWithSchedule` (фильтр `hoursQuery.data?.[s.id]?.length > 0`) в этот момент пуст → `DayGrid`
рисует `EmptyDayState` («Расписание не установлено», хотя график есть) → та же пустая
`staffWithSchedule` прячет Fab «+» (условие `staffWithSchedule.length > 0`), единственный способ
создать запись с телефона (F-01-184) пропадает. Разница timing между этим и `staffQuery` также
годный кандидат на замеченный один раз hydration-mismatch (несинхронный переход состояния сразу
после монтирования) — отдельно не воспроизведён, но устранён тем же фиксом (гонка была единственной
находкой, объясняющей оба симптома).

**Правка:** `src/areas/journal/JournalScreen.tsx` — `hoursQuery.isLoading` добавлен в `isLoading`,
`hoursQuery.isError` в `isError`, `hoursQuery.refetch()` в `onRetry` у `ErrorState`. Экран теперь
ждёт график сотрудников наравне с остальными запросами дня — `staffWithSchedule` не может быть
пустым «по гонке», только по факту (график действительно не выставлен).

**Проверка:** `node scripts/measure.mjs --area journal --persona master,owner-empty --routes
/biz/journal --device phone,desktop --full` — 0 ошибок консоли, 0 4xx, 0 сырых ключей; снимок
`master phone` показывает реальный график и записи (не EmptyDayState). Гонку саму по себе
детерминированно не воспроизвести без искусственной задержки — фикс убирает причину (учёт запроса
в гейте), а не следствие, так что переигрывать её незачем.

## F-01-184 (minor) — Fab «+» перекрывает угол последней карточки на телефоне

**Причина:** `Fab` — `position: fixed` относительно вьюпорта, не часть потока сетки; скролл-контейнер
`DayGrid` (`overflow-auto`, `maxHeight: calc(100vh - 22rem)`) не оставлял запаса снизу, так что
последняя видимая запись заканчивалась вплотную к нижнему краю, а Fab (56 px + отступы) наезжала на
её правый нижний угол.

**Правка:** `src/areas/journal/components/DayGrid.tsx` — `pb-20 md:pb-0` на скролл-контейнере
(`overflow-auto` div). На телефоне это даёт запас прокрутки: последнюю карточку можно докрутить
выше Fab. На десктопе Fab скрыта (`md:hidden` в `Fab.tsx`) — запас не добавляется.

## Попутно — empty-d1.md #1 (major, найден по правилу §0.1, ещё не был отмечен)

Экран, который я и так трогаю (`JournalScreen.tsx`/`DayGrid.tsx`/`EmptyDayState.tsx`). Пустой
бизнес (owner-empty, individual-empty — нет услуг, нет сотрудников) показывал «Расписание не
установлено» и звал настраивать график — при том что настраивать нечей график (нет сотрудников) и
незачем (нет услуг). Кнопка «Новая запись» в шапке при этом была активна и вела в черновик записи
без адресата и без услуги.

**Правка:**
- `src/areas/journal/components/EmptyDayState.tsx` — новые пропсы `hasServices`/`hasStaff`; порядок
  новичка «Сначала добавьте услуги» → «Добавьте сотрудников» → «Настроить график работы» (последнее —
  только когда услуги и сотрудники уже есть, прежнее поведение).
- `src/areas/journal/components/DayGrid.tsx` — принимает и прокидывает `hasServices`/`hasStaff` в
  `EmptyDayState` при `columns.length === 0`.
- `src/areas/journal/JournalScreen.tsx` — считает `hasAnyServices`/`allStaff.length > 0`, передаёт в
  `DayGrid` и в резервный вызов `EmptyDayState` (вид «неделя» без выбранного сотрудника); новая
  переменная `canCreateBooking = staffWithSchedule.length > 0 && hasAnyServices` — обе десктопные
  кнопки «Новая запись» (обычная и `DropdownMenu` с пакетом при ≥2 услугах) при `!canCreateBooking`
  становятся `disabled` внутри `Tooltip` с текстом причины (`header.newBookingDisabledNoServices` /
  `header.newBookingDisabledNoStaff`). Fab на телефоне уже была скрыта в этом случае — трогать не
  пришлось.
- Ключи `messages/{ru,en}/journal.json`: `emptyDay.noServicesTitle/noServicesHint/addServices`,
  `emptyDay.noStaffTitle/noStaffHint/addStaff`, `header.newBookingDisabledNoServices/NoStaff`.
- Отмечено `✅ исправлено (journal g2-3-fix1)` в `qa/measure/journal/empty-d1.md`.

## §0.1 — просмотр открытых замечаний

Прочитаны все файлы `qa/measure/journal/`, разрешённые правилом (не `b*-m*`/`g*-m*`, не в списке
исключений `ux-*/speed-*/arch-*/core-rules*/state-*/decision-*/recheck-*/e2e-*/text-*/a11y-*/build-*/
onboarding-*/ux-best-*/core-*`): `demo-q1..4.md`, `empty-d1.md`. Все замечания в `demo-q1..4.md` уже
были отмечены `✅ исправлено`; в `empty-d1.md` пункт «Панель фильтров над пустотой» отмечен, пункт
«Первое действие не то» — не был отмечен, закрыт этой пачкой (выше). Учитывая объём задания при
экономном бюджете времени, дальше пяти дополнительных экранов сверх уже тронутых (`/biz/journal` day,
`/biz/journal` empty, шапка, Fab, EmptyDayState) целенаправленно не обходил — все найденные
незакрытые block/major из разрешённого списка файлов закрыты.

## Проверка перед сдачей

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/journal.tsbuildinfo` — 0 ошибок в
  путях раздела (`areas/journal`, `domain/journal.ts`, `mock/slices/journal.ts`, `api/journal.ts`).
- `npx eslint src/areas/journal src/domain/journal.ts src/mock/slices/journal.ts src/api/journal.ts`
  — 0 ошибок, 0 предупреждений.
- `scripts/ensure-dev.sh` — сервер уже работал на :3710, не трогал.
- `node scripts/measure.mjs --area journal --persona master,owner-empty --routes /biz/journal
  --device phone,desktop --full` — 20 страниц, 0 ошибок консоли, 0 4xx, 0 сырых ключей, 0 «нет
  ключа»/«нет en», 0 вылетов, 0 «висит загрузка». Единственное предупреждение на каждой странице —
  `[mock-db] не удалось сохранить в localStorage QuotaExceededError` — инфраструктурное (не мой
  путь, `src/mock/db.ts`), не связано с этой пачкой, не трогал.
- Снимки просмотрены глазами (`Read` png): `biz-journal__master-nails-ru-light-phone.png` — реальный
  график и записи, Fab на месте, EmptyDayState не показан; `biz-journal__owner-empty-nails-ru-light-
  phone.png` — новый онбординг-текст «Сначала добавьте услуги» с кнопкой «Добавить услуги».

## done

- F-01-018
- F-01-184

## partial

(нет — обе функции из задания починены полностью по своим пунктам «Готово, когда» применительно к
описанным дефектам; F-01-018/F-01-184 в остальной части уже были реализованы в предыдущих пачках)

## marked

164 (`node scripts/fids.mjs --area journal`, после этой пачки: 221 всего / 164 помечено / 74.2%)
