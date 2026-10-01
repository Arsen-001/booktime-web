# Архитектура online · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил). Мерка — docs/ARCHITECTURE.md и CONVENTIONS.md §16.
Сторож: `node scripts/arch-check.mjs --area online` → 0 error, 36 warn (A12:18, A9:6, A11:6, A14:4, A13:2).
Номера строк — на момент ревью.

Хорошо: `createOnlineBooking` — самый полный набор проверок во всём проекте (повтор окна, пауза, отпуск, блокировка, выезд),
ошибки — `ApiError` с кодами, права — `PermissionGate` (18 мест), публичные данные — одной функцией.

## Major

1. **Три источника правды для «за сколько часов можно отменить/перенести»**: `StaffOnlineRules.cancelWindowHours` в своём срезе
   (`src/domain/online.ts:63`, по умолчанию 3 ч), `Business.bookingRules.cancelWindowMin` в ядре (k1 — «заполняет online»,
   но не читается нигде), `cancelWindowHours` в срезе client (24 ч). Как: хозяин правила — online, хранит в ядре
   (`Business.bookingRules`, при необходимости поле мастера — просьба в ядро), срез `staffRules.cancel/rescheduleWindowHours`
   перенести и удалить; правило исхода отмены — общее (`domain/rules/booking-policy.ts`, просьба `arch-a1` №3).

2. **«В отпуске» — два разных понятия** — `StaffOnlineRules.vacationUntil` (`src/domain/online.ts:74`, проверка в
   `createOnlineBooking:302`) и «Отпуск» в графике раздела schedule (`setVacationUntil` → тип дня `vacation`, закрывает окна).
   Мастер, поставивший отпуск в графике, в online «не в отпуске», и наоборот. Как: одно понятие — тип дня в графике
   (schedule), online читает его через `getFreeSlots` (окон нет) и отдельно сообщение «в отпуске до» — функцией api schedule.

3. **Вложенные сетевые вызовы внутри `request()`** — `src/api/online.ts:309–327`: `findClientByPhone`, `coreCreate`, `createBooking`
   (+ `mutateArea`) — 4 задержки на одну запись (~1 с, в `?api=slow` ~8 с), а между проверкой окна и созданием — `await`,
   окно успевают занять. То же `cancelOnlineBooking:598–601`, `getOnlineBooking:386`, `respondToRequest` (request в request).
   Как: внутри `request()` — только синхронные функции ядра (просьба `arch-a1` №1).

4. **Правило «кого видно клиентам» написано дважды в разделе и третий раз в client** — `isStaffOnlineVisible` (`:157`) и
   `isListable` (`:486`, требует фото) дают разный ответ для одного мастера; `Staff.onlineBookingEnabled` (ядро k1, ваша же
   просьба) не читается нигде. Как: одна функция в `domain/rules/visibility.ts` (просьба №5), учитывающая
   `onlineBookingEnabled`, `calendarVisibility`, услуги, график и модерацию; оба места — через неё.

5. **Публичной странице уходит `Staff` целиком** — `getPublicBusinessData` (`:175`): телефон мастера, `homeAddress`, `login`
   любого посетителя `/b/<slug>`. Как: DTO `PublicStaff` (имя, фото, должность, услуги, места работы без адреса дома).

6. **`BookingWizard.tsx` — 1003 строки, 7 компонентов в файле**, повторяет мастер записи клиента (`client/book/BookScreen.tsx`)
   и вход по коду (`client/login`). Как: шаги — по файлам (`ServicesStep`, `StaffStep`, `TimeStep`, `WorkplaceStep`,
   `DetailsStep`), состояние — `useBookingWizard` (useReducer); общий модуль шагов с client — просьба `arch-a1` №4.

## Minor

7. Ключи `['online-links', …]`, `['online-link', id]`, `['online-business-rules', …]` (18) — одна строка вместо
   `['online', 'links', businessId]`: префиксная инвалидация `['online']` их не заденет. Фабрика `onlineKeys`.
   `['online-business-rules', business.id]` и `['online-business-rules', businessId]` — один ключ из двух мест, хорошо; держать так же.
8. Сырые даты: `:216` `new Date(new Date(cursor).getTime() + 86400000)`, `:226–229`, `:288`, `:559` `hoursUntil` через
   `Date.now()`, `:619` — работает только при поясе браузера = Ереван; на сервере (UTC) срок отмены съедет на 4 ч.
   Как: `parse`, `toISODate`, `nowDateTime`, разница — `parse(start).diff(parse(nowDateTime()), 'minute')`.
9. `getMonthAvailability` / `getNearestAvailableDate` — до 42/60 полных расчётов окон на запрос; на сервере — кэш доступности.
   Не звать их чаще смены месяца (ключ по `monthStart` — уже так).
10. `links/copyText.ts` — хорошая функция, нужна ещё 3 разделам → перенести в `@/lib/clipboard` (просьба №7), свою удалить после.
11. `booking/BookingConfirmedScreen.tsx:26` — свой `STATUS_TONE` и `:80` своё «отменена» → `BookingStatusBadge`/`isCancelled` (№6, №2).
12. `createOnlineBooking` берёт `priceMin`/`durationMin` у услуги «от–до» — бронирует нижнюю границу
    (docs/backend/07-mock-only.md §2); правило длительности записи — туда же, в `booking-policy`.
