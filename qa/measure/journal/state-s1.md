# Состояние и запросы — journal (state-s1, 25.09.2026)

Архитектор состояния. Что поменялось под `useApiQuery`/`useApiMutation` — `docs/STATE.md`, правила — CONVENTIONS §18.
Замер: `node scripts/renders.mjs --only journal-status,journal-day` (отчёты `qa/speed/renders-{before,after}.json`).

## Числа

| Действие | Перерисовок | Перечитано запросов | До результата |
|---|---|---|---|
| Смена статуса во всплывающей карточке | 1468 → 116 | 10 → 3 | 548 → 432 мс |
| Другой день (мини-календарь) | 246 → 243, без скелетона | 3 → 2 | 582 → 278 мс |

## Замечания

1. **major — `x!.y` в функциях чтения (падение под React Compiler).** Компилятор выносит поля из функции, переданной в хук,
   в рендер для сравнения кэша; при `x === undefined` рендер падает (так упал вклад online в окно записи,
   `/dev/ext/bookingWindow/online`). Сейчас эти компоненты компилятор пропускает (поэтому не падают), но упадут, как только
   станут компилируемыми:
   - `src/areas/journal/components/BookingWindow.tsx:144` `booking!.clientId`, `:152` `matchedClient!.id`, `:155` `booking!.id`
     — окно новой записи (`booking === undefined`), клиент не выбран;
   - `src/areas/journal/components/BookingHoverCard.tsx:41` `client!.id` — запись без клиента.
   Исправление: значение в рендере через `?.`, в функции — оно: `const clientId = client?.id;` →
   `useApiQuery(['journal', 'client-history', clientId], () => listBookings({ clientId: clientId ?? '', … }), { enabled: Boolean(clientId) })`.
   Проверка: `node scripts/renders.mjs --check-compiler`.
   ✅ исправлено (g2-2) — x!.y заменены на `id ?? ""` + `enabled: Boolean(id)` в BookingWindow.tsx и BookingHoverCard.tsx.

2. **major — статус меняется только после ответа и перечитывания (~0,4–0,6 с).** Сделайте оптимистично —
   блок в сетке и карточка поменяются сразу, ошибка откатит сама:
   ```ts
   const setStatus = useApiMutation(
     ({ id, status }: { id: Id; status: BookingStatus }) => changeBookingStatus(id, status),
     { optimistic: patchInList(['journal', 'bookings'], ({ id, status }) => ({ id, patch: { status } })) },
   );
   ```
   (`BookingHoverCard.tsx:38` сейчас `setBookingStatus` без оптимизма; то же — кнопки статуса в окне записи.)
3. **minor — ручные `refetch()` после записи лишние:** `JournalScreen.tsx:307` (`onSaved={() => bookingsQuery.refetch()}`),
   `BookingWindow.tsx:302` (`categoriesQuery.refetch()` после записи), `onChanged` карточки. Нужные запросы перечитываются
   сами — точечно (CONVENTIONS §18 п.2). `refetch()` в `ErrorState onRetry` — правильно, оставить.
4. **minor — смена дня:** теперь прежний день остаётся на экране ~0,3 с, пока грузится новый (без скелетона). Приглушите сетку
   по `bookingsQuery.isPlaceholderData` и положите соседние дни заранее:
   `useEffect(() => { prefetchApiQuery(['journal','bookings',businessId,addDays(date,1)], () => listBookings({ … })); }, [date])` —
   листание станет мгновенным.
5. **minor — ключи ядра под своими именами:** услуги бизнеса читаются под `['journal','services',b]` и `['journal','all-services',b]`
   (одни данные — два запроса). Один ключ на одни данные.
