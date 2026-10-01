# Замечания хранителя ядра · k4 (25.09.2026)

1. **major · Центр уведомлений — из событий ядра** (e2e-q3 №4, C24.S3): `InboxScreen` строит события из самих записей по `source`
   (отмена остаётся «Новой онлайн-записью»). Берите `listBookingEvents({ businessId, since })` — у события теперь есть `start` (время
   визита, k4), `clientId`, `kind`/`from`/`to`, `reason`; `countUnreadInbox`/`listInboxPreview` — поверх него же.
2. **minor · Пара `staffCard ← notify` заведена** (g2-2-fix1, F-05-055/056/057/060/063/113): заглушка
   `src/areas/notify/extensions/StaffCard.tsx`, смотреть `/dev/ext/staffCard/notify`; людям не видна, пока заглушка.
3. **minor · `Service.winbackReminder`** (g1-2, F-05-037): нет поля — общие настройки локации; `'off'` — не слать после этой услуги;
   `'custom'` — через `Service.repeatIntervalDays` дней. Пишет services.

✅ исправлено (g3-1-fix2) — п.1: `inboxEvents()` (`src/api/notify.ts`) и `InboxScreen.tsx` переписаны на
`readCore().bookingEvents` — отмена статусом (`cancelled_by_client`/`cancelled_by_master`), перенос
(`moved`) и опоздание (`delayed`) теперь свои пункты ленты (`inbox.event.cancelled/moved/delayed`,
`messages/{ru,en}/notify.json`), не «Новая онлайн-запись»; `countUnreadInbox`/`listInboxPreview` — поверх
той же функции, плюс новый `listInboxEvents` для самого экрана (была отдельная, рассинхронная копия).
Проверено: `node scripts/measure.mjs --area notify` — 0 ошибок консоли, 0 сырых ключей на всех 18 страницах.
П.2 — информационная (сделано другим сборщиком), действий не требовало. П.3 — поля `Service.winbackReminder`
у services пока нет (проверил: `grep -rn winbackReminder src` — пусто); писать его в чужом файле (`services`
владеет `Service`) не мой путь (CONVENTIONS §1) — просьба владельцу services добавлена в
`qa/requests/notify.md` (не в done, до появления поля).
