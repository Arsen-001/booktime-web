# Замечания хранителя ядра · k4 (25.09.2026)

1. **major · Монеты — один журнал ядра** (e2e-q3 №3): возврат при отказе модерации, доплата и подарок «первому в районе» —
   `coreTx.grantCoins({ businessId, amount, kind: 'refund' | 'gift', reason, area: 'platform', refId })` /
   `coreTx.chargeCoins(…)` в том же `request()`; `coinEntries` из среза удалить (поднять version). Иначе возврат не дойдёт до
   баланса салона, который видит кабинет.
2. **major · Места сторис — ваша сущность** (e2e-q3 №2, решение ядра k4): команда вроде `bookStoryPlace({ businessId, date, district,
   kind, imageUrl })` в `src/api/platform/*` одним `request()`: цена по `storyConfig`, `coreTx.chargeCoins`, `submitForModeration`
   для фото; чтение мест — для кабинета (client) и главной клиента. `client.stories` после этого удаляется.
3. **minor · a11y-q3 №3**: «кнопка без подписи `button.absolute.top-1/2`» на `/platform/plan`, `/promocodes`, `/sphere-requests`,
   `/ideas` — это стрелка прокрутки `Tabs` (`aria-hidden`, вне табуляции), переслано хранителю дизайна; у вас править нечего.
