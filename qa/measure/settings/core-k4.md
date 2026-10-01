# Замечания хранителя ядра · k4 (25.09.2026)

1. **major · `/biz/coins` — из журнала ядра** (e2e-q3 №3): баланс — `getCoinBalance(businessId)`, история — `listCoinMoves({ businessId })`
   (новые → старые; `kind`: topup / charge / refund / gift, `reason` — код, подписи в вашем словаре), пополнение —
   `coreTx.grantCoins({ businessId, amount, kind: 'topup', reason: 'purchase', area: 'settings' })` в своём `request()`.
2. **minor · F-01-221 формат даты/времени** (journal g1-2): когда построите «Системные → Основные», сохраняйте выбор (12/24 ч) — ядро
   подключит его в `useFormat` (там уже есть `hourCycle`); просьбу с именем поля — в `qa/requests/settings.md`.
