# Сквозная проверка (cross) — 30.09/01.10.2026

## Итог
- Статические проверки (arch-check, check-tokens, tone-check, facade-audit, fids --unknown): **выполнены полностью**.
- Браузерная часть (crash-sweep, measure hy/dark, old-db): **НЕ выполнена**. Причина — окружение, а не код:
  1. Все 4 слота pw-slots были заняты другими проверяющими около 1 ч; первый запуск crash-sweep упал с «не дождался слота» (таймаут 30 мин).
  2. Когда слот освободился, crash-sweep (networkidle, 308 страниц) проработал больше 50 мин без результата; его остановили (координатор перезапустил сервер, 12 ГБ).
  3. Облегчённый обход (scratchpad/sweep.mjs, построчная запись) за 1 ч успел пройти 1 страницу (/biz/apps — ок).
  4. Около 00:40 curl: `/`, `/biz`, `/search`, `/bookings`, `/b/nuri-nail-studio` отвечали 307 → не отдавали ответ за 40–284 с,
     а `/biz/journal`, `/biz/apps`, `/dev/routes` отвечали за 0,2–0,4 с. Потом сервер на :3710 перестал отвечать совсем (код 000).
     Похоже на перегрузку или перезапуск сервера: при нагрузке 15 это НЕ подтверждено как баг. Но стоит перепроверить, что `/`, `/biz`
     и `/search` при здоровом сервере отдаются быстро (подозрение на цикл редиректа 307 `/?demo=client` → `/`).
- Готовые к запуску скрипты: scratchpad `run2.sh` (обход + old-db + measure hy/dark) — можно повторить на свободной машине.

## arch-check — 42 error (выход 1)
- A1 (импорт чужого раздела):
  - src/app/biz/payroll/settlements/page.tsx:1 → @/areas/finance/SettlementsScreen
  - src/areas/reports/StockBalanceScreen.tsx:15 → @/areas/stock/useStockPermissions
  - src/areas/settings/MobileAppsScreen.tsx:17 → @/areas/online/links/copyText
  - src/app/s/[code]/open/page.tsx:1 → @/areas/notify/short/ShortLinkRedirect (фундамент → раздел)
  - src/api/journal-offers.ts:29-30 импортирует journal и notify
- A4 (запись в чужой срез): src/api/client.ts:1386 (online); src/api/journal-offers.ts:254/260/266/287/316 (notify, online, client, journal);
  src/api/online.ts:2818 (client.telegramLinked); src/api/reports.ts:2444/2459/2471 (client); src/api/services.ts:1169 (schedule.serviceSlotWindows).
- A2 (прямой доступ к моковой базе): src/api/client.ts:52, src/api/reports.ts:112, src/api/mirror.ts:27 и все *.server.ts
  (journal, live, notify, payroll, resources, schedule, services, settings, staff, platform/*) — для .server.ts, вероятно, нужен allowlist в сторожe.
- A6 src/areas/online/settings/StaffChoiceCard.tsx:38 — **ложное срабатывание**: переменная называется `any` (`allowAnyStaffForAllLinks: any`). Правка: переименовать или поправить регэксп A6.
- Предупреждений ~950 (больше всего A12/A14 в client и online, A10 в journal и loyalty, A11 в network) — подробности в cross/arch-all.log.

## check-tokens — 35 находок (выход 1)
- Настоящие нарушения в UI: src/areas/reports/ReviewsScreen.tsx:72,76,151,162 и components/ReportHeader.tsx:88 — `fill-amber-400/text-amber-500`
  (палитры Tailwind в проекте нет, так что звёзды не окрашены) → нужен токен (например, warning/star).
  src/areas/stock/CameraScanner.tsx:101,103 — `bg-black`, `text-white/80`.
  src/areas/client/apps/ServicesAppScreen.tsx:499,511 — `accent-[color:var(--color-primary)]` (цвет через токен, но произвольный класс; вероятно, достаточно пометить `tokens-ok`).
- Цвета из данных или системные (нужна пометка `tokens-ok`, а не правка): src/areas/client/bookings/bookingTone.ts:14-25, src/app/layout.tsx:56-57,
  src/app/manifest.ts:21-22, src/api/online.ts:173, src/domain/online.ts:231, src/domain/finance.ts:1152-1153, src/mock/slices/{client,online}.ts,
  src/areas/finance/ReceiptScreen.tsx:47 (печать чека).

## tone-check — все проверки прошли.
## facade-audit — 45 функций без ветки isApiMode, из них 11 используются: journal-offers.ts (previewSlotOffer, listSlotOffers, offerSlots, listRequestReminders),
   journal.ts (listStaffSets, saveStaffSet, deleteStaffSet, getDayLayout, setDayLayout, recordPrepaymentLineSync), online.ts (connectBookingTelegramDemo).
## fids --unknown — 0 опечаток. Не помечены: F-06-182 (loyalty, фискальный документ, Бразилия), F-00-028/029/030 (settings, «не решено/отложено» — ок).
## tsc --noEmit — без ошибок.

## Не проверено (нужно повторить)
crash-sweep всех страниц; measure hy (шрифт, сырые ключи, вылет, мелкие цели) и dark для owner/admin/master/client/individual; old-db (qa/old-db/localStorage.json).
