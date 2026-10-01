# Состояние и запросы — online (state-s1, 25.09.2026)

Архитектор состояния. Что поменялось — `docs/STATE.md`, правила — CONVENTIONS §18.

## Замечания

1. **major — вклад в окно записи падает: `/dev/ext/bookingWindow/online`** (обход всех 118 адресов `/dev/routes`, 25.09).
   `[ext] вклад bookingWindow:online упал TypeError: Cannot read properties of undefined (reading 'linkId')`.
   Причина — React Compiler (включён в `next.config.ts`): функция, переданная в хук, считается «может быть вызвана в рендере»,
   и `metaQ.data!.linkId` из неё уходит в рендер для сравнения кэша — при `metaQ.data === undefined` падает, `enabled: false`
   не спасает. `src/areas/online/extensions/BookingWindow.tsx:19`. Исправление:
   ```tsx
   const linkId = metaQ.data?.linkId;
   const linkQ = useApiQuery(['online', 'booking-link', linkId], () => getLink(linkId ?? ''), { enabled: Boolean(linkId) });
   ```
2. **major — то же в ещё двух экранах** (сейчас их компилятор пропускает, упадут, как только станут компилируемыми):
   `src/areas/online/booking/BookingConfirmedScreen.tsx:56–60` (`q.data!.staff!.id`, `q.data!.booking…`),
   `src/areas/online/links/LinkSettingsScreen.tsx:50` (`linkQ.data!.businessId`). Проверка: `node scripts/renders.mjs --check-compiler`.
   ✅ исправлено (online-b02-fix2) — п.1 и п.2, все три места, переведены на предвычисленную переменную перед
   хуком; перепроверено `node scripts/measure.mjs --routes /dev/ext/bookingWindow/online …` — 0 ошибок консоли
   на всех 4 комбинациях (было `TypeError: Cannot read properties of undefined (reading 'linkId')`), и
   `node scripts/renders.mjs --check-compiler` больше не находит `online`.
3. **minor — ключи не начинаются с id раздела** (`['online-booking-meta', …]`, `['online-link', …]`): правило
   `['online', '<ресурс>', …]` (CONVENTIONS §16 п.4, §18 п.1) — удобно перечитывать и оптимистично править всё «online».
4. **minor — async-функции `request(async () => { … await coreGet … })`** (`createOnlineBooking`, `getOnlineBooking`,
   `cancelOnlineBooking`, `rescheduleOnlineBooking` в `src/api/online.ts`): такой запрос нельзя откатить при ошибке
   посередине (синхронный — откатывается сам, docs/STATE.md §2). Синхронно — через `coreTx.*`.
