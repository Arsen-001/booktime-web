Разобрал 64 просьбы: 13 сделал (из них 2 частично), 51 отклонил, у каждой отказа есть причина. Под каждой просьбой стоит строка «**Ядро k4 (25.09):** ✅ / ❌ …».

**Отчёт `qa/core/report-k4.md` не записан:** инструмент не даёт подагенту писать файлы отчётов, как и в k3. Главное из отчёта — ниже.

**Сделано** (новые поля необязательные, ничего не переименовано и не удалено):
- **Монеты — один журнал ядра** (e2e-q3 №3). Тип `CoinMove`, коллекция `core.coinLedger`, команды `coreTx.chargeCoins` (при нехватке — ошибка `not_enough_coins`) и `coreTx.grantCoins`, чтение `getCoinBalance` и `listCoinMoves`. Тексты ошибок — `common.coinErrors.*` на ru и en.
- **Хозяин мест сторис — platform** (e2e-q3 №2). Решение записано в CONVENTIONS §6 «Ядро k4».
- **У событий записи есть время визита** (e2e-q3 №4, частично): новое поле `BookingEvent.start`.
- **Права онлайн-записи** (просьба online): `online.manage` теперь есть и у администратора; новое право `online.own` («своя онлайн-запись») — у мастера и администратора.
- **Новые поля:** `Staff.email` (журнал, F-01-008) и `Service.winbackReminder` (уведомления, F-05-037; просьба сделана частично).
- **Две новые пары вкладов:** карточка клиента ← client и карточка сотрудника ← notify. Заглушки лежат в `src/areas/client/extensions/ClientCard.tsx` и `src/areas/notify/extensions/StaffCard.tsx`, подписи вкладок — в `common.ext` на ru и en. Людям заглушки не видны, пока разделы их не заменят.
- **Правило про армянский** в CONVENTIONS §0.4: пустой `messages/hy/<раздел>.json` — не дефект раздела.
- **Уже было в ядре:** примечание клиента журнал может писать сам, `coreTx.update('clients', …)` с проверкой права `clients.edit`. Просьбы journal F-01-036 и F-01-119 сняты — раздел закрыл их сам.

**Отклонено — основное:**
- **Раздача F-id по разделам** — 11 просьб, решает оркестратор.
- **Не мои файлы:**
  - `src/ui` и `src/shell`, у хранителя дизайна: колокольчик, `Stepper`, построчный класс в `Table`, стрелки `Tabs`. Стрелки переслал в `ux-core.md` №17: «кнопка без подписи» из a11y-q3 — это стрелка прокрутки `Tabs`, а не очистка поиска.
  - `src/app/layout.tsx` и `manifest.ts` — у помощника «приложение для телефона»; константа цветов `THEME_META` готова с k3.
  - `eslint.config.mjs` — нужна правка главного. Просьба приходит третий раз подряд: в правило `no-unused-vars` добавить `argsIgnorePattern`, `varsIgnorePattern` и `destructuredArrayIgnorePattern` со значением `'^_'`. Это уберёт 20 из 26 предупреждений.
- **Нужно решение главного или хранителя правил:** длительность услуги по мастеру (`Service.staffOverrides`, просьба schedule, повтор с k3). Поле без правки правил в `src/domain/rules` разведёт свободные окна и саму запись, а эта папка не в моих файлах.
- **Одно правило «просроченная предоплата»** (e2e-q3 №1): в ядре оно уже одно. Вторая копия — у раздела schedule (`prepaymentWaitMin`), ему записано замечание major.
- **Тонкие права раздела** (journal, clients) остаются в срезах разделов по правилу k3. Флаги сотрудника у client (`onlyOwnBookings`, `hideClientContacts`) — это права ядра `journal.others` и `clients.phones`; их надо хранить через `setStaffPermissions`.

**Правила и замечания:**
- В CONVENTIONS.md дописаны §0.4 (армянский), §6 «Ядро k4» и таблица хостов в §9.
- Замечания разделам — `qa/measure/<раздел>/core-k4.md` для online, client, platform, settings, notify, schedule, journal, services и staff. Уровень major — у online, client, platform, notify и schedule.
- Для демо-помощника — `qa/requests/seed-pending.md` §9: начальные балансы монет (без них после переезда разделов баланс у всех будет 0), примеры `Staff.email` и `winbackReminder`.

**Проверка:**
- `npx tsc --noEmit`: в моих файлах ошибок нет. Ошибки есть только в незаконченных правках разделов (`src/api/schedule.ts`, `src/areas/loyalty/extensions/ClientCard.tsx`, `src/areas/journal/JournalScreen.tsx`, `src/areas/journal/components/WaitlistPanel.tsx`); список менялся между прогонами.
- eslint по изменённым файлам ядра чистый, тесты правил прошли 72 из 72.
- Замер 54 страниц (`/`, `/bookings`, `/biz/journal`, `/biz/online`, `/biz/online/settings`, `/biz/clients`, `/platform` и две страницы новых вкладов; персоны owner, admin, master; ru и en; телефон): везде 0 ошибок консоли, 0 ответов 4xx/5xx, 0 сырых ключей. Снимки — `qa/shots/core-k4/`.
- В браузере не проверял функции монет — их пока никто не вызывает. Поле `start` на живом событии тоже не смотрел.

Изменённые файлы:
- /Users/arsen/WebstormProjects/booking-platform/src/domain/core.ts
- /Users/arsen/WebstormProjects/booking-platform/src/api/core.ts
- /Users/arsen/WebstormProjects/booking-platform/src/mock/db.ts
- /Users/arsen/WebstormProjects/booking-platform/src/config/permissions.ts
- /Users/arsen/WebstormProjects/booking-platform/src/extensions/pairs.ts
- /Users/arsen/WebstormProjects/booking-platform/src/extensions/registry.ts
- /Users/arsen/WebstormProjects/booking-platform/src/areas/client/extensions/ClientCard.tsx (новый)
- /Users/arsen/WebstormProjects/booking-platform/src/areas/notify/extensions/StaffCard.tsx (новый)
- /Users/arsen/WebstormProjects/booking-platform/messages/ru/common.json
- /Users/arsen/WebstormProjects/booking-platform/messages/en/common.json
- /Users/arsen/WebstormProjects/booking-platform/CONVENTIONS.md
- Отметки в /Users/arsen/WebstormProjects/booking-platform/qa/requests/: a11y-q3, build-q3, client, clients, e2e-q3, journal, notify, online, platform, schedule; дописаны ux-core.md №17 и seed-pending.md §9.