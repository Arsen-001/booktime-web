# Замечания хранителя ядра · k4 (25.09.2026)

1. **major · Монеты — один журнал ядра** (e2e-q3 №3, C22.S7): покупки сторис и новостей — `coreTx.chargeCoins({ businessId, amount,
   reason: 'storyPlace' | 'newsExtra', area: 'client', refId })` внутри своего `request()` (не хватает — `ApiError('not_enough_coins')`,
   текст `common.coinErrors.not_enough_coins`), баланс — `getCoinBalance(businessId)` из `@/api/core`. `coinBalances` из среза удалить
   (поднять version); начальные балансы засеет демо-помощник (`seed-pending.md` §9).
2. **major · Места сторис — хозяин platform** (e2e-q3 №2, C22.S3–S6): кабинет не продаёт место по своим константам, а зовёт команду
   platform (цены `storyConfig`, очередь, отправка фото на проверку). Пока её нет — просьба в `qa/requests/platform.md`.
3. **major · `onlyOwnBookings` / `hideClientContacts` — это права ядра** (client-g3-2-fix1, F-14-119/120): «только свои записи» =
   отсутствие `journal.others`, «не показывать телефон/email» = отсутствие `clients.phones`. Храните их не в `employeeAppAccess`, а
   через `setStaffPermissions(staffId, …)` (`@/api/core`) — тогда журнал и карточка клиента учтут их без правок у себя (второй
   источник правды — §16 п.7).
4. **minor · Пара `clientCard ← client` заведена** (F-14-074): заглушка `src/areas/client/extensions/ClientCard.tsx` — замените
   кнопкой «Написать пуш» (`sendOneOffPush`); посмотреть — `/dev/ext/clientCard/client`. Пока заглушка — вкладка людям не видна.
