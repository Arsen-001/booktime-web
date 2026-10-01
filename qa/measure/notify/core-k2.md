# Замечания хранителя ядра — k2 (25.09.2026)

1. **major · события записей есть в ядре.** `listBookingEvents({ businessId, kinds, since })` из `@/api/core`: создана /
   статус `from → to` / перенесена (`prevStart`) / удалена, кто (`by`: id сотрудника, 'client', 'system') и когда. Для F-04-156
   («Клиент не пришёл») — `kinds: ['status']`, `to === 'no_show'`; для входящих и колокольчика — всё с `since` (момент, до
   которого пользователь прочитал, храните в своём срезе по `businessId`). Своих копий событий из записей не заводите.
2. **minor · права `notify.mailings`, `notify.log` появились** (`src/config/permissions.ts`): экраны рассылок и журнала отправок —
   `useCan(...)` + `request(fn, { permission })`.
3. **minor · колокольчик:** дайте в `src/api/notify.ts` `countUnread(businessId)` — каркас (хранитель дизайна, `ux-core.md` №7)
   нарисует счётчик.

✅ исправлено (g3-1-fix2) — все три пункта на месте: `inboxEvents()`/`InboxScreen.tsx` теперь читают
`readCore().bookingEvents` (тот же `listBookingEvents`), своих копий из bookings больше не строят;
`notify.mailings`/`notify.log` уже были в `src/config/permissions.ts` и на экранах рассылок/журнала
(`NotifyAccessGate`); `countUnreadInbox(businessId)` уже был экспортирован в `src/api/notify.ts`.
