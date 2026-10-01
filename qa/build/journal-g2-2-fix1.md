# journal · доделка g2-2 · fix1 (25.09.2026)

Чинил дефекты измерителя g2-2 (список в задании — 11 находок F-01-073/210/116/124/144/146/213/212,
arch-a1-1, core-rules-4, decision-c3-3, core-k4-4). Из них семь (F-01-073, F-01-210, F-01-116, F-01-124,
F-01-144, F-01-146, F-01-213, F-01-212 — восемь, включая F-01-212) указывают на файлы вкладов
`src/areas/finance/extensions/BookingWindow.tsx` и `src/areas/loyalty/extensions/BookingWindow.tsx` /
`src/areas/loyalty/**`. По CONVENTIONS §1 и `src/extensions/types.ts` («Раздел-вкладчик пишет ТОЛЬКО свой
файл `src/areas/<area>/extensions/<Host>.tsx`») эти файлы принадлежат разделам finance/loyalty, не journal
— правило «чужие пути не трогай» не позволило их починить напрямую. Записал их в
`qa/requests/journal.md` с разбором, что уже готово со стороны journal (see below) и что нужно
владельцам finance/loyalty.

## Готово (мои пути)

- **core-k4-4** — `JournalSidebar.tsx`: «Продать» проверял `stock.edit`, теперь `finance.edit` (это
  финансовая операция — продажа товара клиенту). `JournalScreen.tsx`: «Добавить сотрудника» (обе кнопки,
  десктоп-шапка и мобильное меню «⋯») проверяли `journal.edit` (`canEditSchedule`, тот же флаг, что и
  правка расписания), теперь отдельный `canAddStaff = useCan('staff.manage')`.
- **core-rules-4** — `BookingWindow.tsx` (журнал) раньше не передавал `onDraftChange`,
  `registerBeforeSave`, `registerAfterSave` в `<ExtensionSlot>` вовсе (были в контракте
  `BookingWindowExtProps`, но хозяин их не подключал — `useAfterSaveStep` во вкладах не срабатывал).
  Теперь: подключил `useSaveSteps()` из `@/extensions/saveHooks`; `handleSave` вызывает
  `saveSteps.runBefore(draft)` до записи (ошибка вклада — тост «не получилось», сохранение отменяется) и
  `saveSteps.runAfter(bookingId, draft)` после (ошибка вклада не откатывает уже сохранённую запись, как и
  задумано в контракте); `onDraftChange` принимает патчи `workplace/resourceIds/comment/status/start` —
  есть свой `setState` под каждое; `clientId`/`services` вклад патчить не может (сложная форма ввода
  хозяина) — эти патчи молча игнорируются, вклад пишет своё через `registerAfterSave` по `bookingId`.
- **decision-c3-3** — «Отмена мастером» (`cancelled_by_master`) теперь считает
  `masterCancelRefund(booking)` (домен `booking-policy.ts`, F-00-100: оплаченная предоплата возвращается
  полностью) и показывает `ConfirmDialog` с суммой возврата до того, как статус реально сменится
  (`BookingWindow.tsx handleStatusChange`, подключён вместо прямого `withTouch(setStatus)` в
  `onStatusChange` у `CenterZone`). Без предоплаты — статус меняется без диалога, как раньше. Реального
  движения денег в finance это не делает (демо: тост-подтверждение + запись в историю через обычный save)
  — если владелец finance хочет провести настоящий возврат, теперь есть на чём: `registerBeforeSave`.
- **demo-q2/q3/q4 (обязательный проход по `qa/measure/journal/`, п. 0.1)** — «Телефон: до сетки 7 рядов
  кнопок / сетка начинается только на втором экране» (major, повтор в трёх замерах): `JournalToolbar.tsx`
  на телефоне (`useIsMobile`) теперь показывает только «Сегодня ‹ ›» + дату и кнопку «Фильтры» (со
  счётчиком активных фильтров); вид/должности/ресурсы/статусы/шаг сетки/перерыв/«делить по ресурсам» ушли
  в `Sheet`. Десктоп не тронут — та же построчная лента. Заодно закрыл `empty-d1.md` находку №2 (панель
  фильтров над пустым состоянием) тем же изменением, и подтвердил, что находка про
  `breakMode.longest/sum` без переводов уже неактуальна (ключи на месте в обоих `messages/{en,ru}`).
  «Разметка: Не выбрано» и «короткие записи нечитаемы» из demo-q2/q3 перепроверил по коду — уже
  исправлены раньше, отметил ✅ повторно в самих файлах вместо новой правки.

## Не сделано (мои пути, честно)

- **arch-a1-1** — `handleSave` в journal всё ещё собирает создание записи из отдельных вызовов
  (`hasOverlap` → `isWithinWorkingHours` с ручным `confirm()` → `coreCreate clients` → `createBooking`), а
  не через `placeBooking()`. Смотрел `txPlaceBooking`/`planBooking` (`src/api/core.ts:268-289`): при
  выходе за часы работы `planBooking` жёстко бросает `ApiError('outside_hours')` — варианта «подтвердить и
  создать всё равно» нет, а именно это сейчас держит нынешний UX (пользователь подтверждает — запись всё
  равно создаётся). Переписать создание на `placeBooking` без этого флага значит либо сломать
  подтверждение «вне часов работы» (рабочий поток, ломать нельзя), либо чинить `planBooking`
  (`src/domain/rules`, общий файл — влияет на онлайн-запись и другие разделы, не мой). Разбор и просьба —
  в `qa/requests/journal.md`. Оставляю в partial.
- **F-01-212** (частичный/полный возврат) — измеритель попросил живую проверку в браузере; файл не мой
  (`finance/extensions/BookingWindow.tsx`), не проверял.

## Проверки

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/journal.tsbuildinfo` — 0 ошибок в путях journal.
- `npx eslint` по всем тронутым файлам (`BookingWindow.tsx`, `StatusButtons.tsx`, `JournalSidebar.tsx`,
  `JournalScreen.tsx`, `JournalToolbar.tsx`) — чисто.
- `node scripts/measure.mjs --area journal --device phone,desktop --persona owner,individual` — 20
  страниц, 0 ошибок консоли, 0 4xx/5xx, 0 сырых i18n-ключей, 0 «нет ключа»/«нет en». Снимки —
  `qa/shots/journal-g2-2-fix1-final/`.
- Точечный замер `/biz/journal` телефон/десктоп до и после (`qa/shots/journal-g2-2-fix1{,b,c}/`) — глазами
  сверил: фильтры ушли в Sheet, дата не обрезается, пустой бизнес не тонет под фильтрами.
- Сценарий-пробник открытия окна записи (`qa/shots/journal-cancel-master-probe/`) подтвердил, что окно
  открывается без ошибок с новым `onStatusChange`; специально попал на пустой слот (создание), не на
  существующую запись с оплаченной предоплатой — живой клик по «Отменил мастер» с реальным возвратом не
  снят в эту пачку (нет готового снимка с такой записью под рукой). Логика типобезопасна и использует ту
  же `masterCancelRefund`, что покрыта юнит-тестом `src/domain/rules/tests/status-policy.test.ts`.

## assumed

- Возврат по «Отмена мастером» в этой пачке — только подтверждение суммой и тост (демо, без реального
  списания в finance); посчитал это достаточным для decision-c3-3 («…не вызывает masterCancelRefund и не
  показывает ConfirmDialog» — оба теперь есть), настоящее движение денег — задел на finance через
  `registerBeforeSave`, не факт.
- `onDraftChange` в journal принимает только поля с готовым `setState` (workplace/resourceIds/comment/
  status/start); `clientId`/`services`/`total` — не патчатся оттуда (сложная форма клиента/услуг хозяина,
  риск рассинхронизации с `matchedClient`/`phone`). Вклады получают путь через `registerAfterSave`.

## marked

qa/build/journal-g2-2-fix1: `node scripts/fids.mjs --area journal` после работы → **164 / 221 (74.2%)**.
