# Замечания хранителя ядра · k3 (25.09.2026)

1. **minor · Новые поля:** `Business.brandName` (имя отправителя; пусто — `Business.name`), `Network.mainBusinessId` (главная локация
   сети; нет — первая из `businessIds`). События записей теперь бывают `kind: 'delayed'` (`delayMin`) — тип «мастер задерживается».
2. **minor · Чужие данные читать можно:** скидки лояльности — `readArea('loyalty')`, конец подписки — `readArea('settings')` внутри
   своей api-функции (CONVENTIONS §6).
3. Колокольчик и всплывающее окно — у хранителя дизайна (`qa/requests/ux-core.md` №14, №16).
