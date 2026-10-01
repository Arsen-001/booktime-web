# Сборка online · g2-2-fix1 — починка дефектов измерителя (g2-2)

Измеритель проверил доделку g2-2 (F-03-103, F-03-106, F-00-067, F-00-068, F-00-077, F-03-068, F-03-128,
F-03-131) и прислал 2 дефекта (оба major). Починены оба.

## done

- **F-03-106** — промоблок в виджете: «на одном экране виден один блок».
  Было: `getPublicBusinessData` (`src/api/online.ts:394`) и `getPromoBlocksForScreen` (`:1504`) фильтровали
  `enabled && approved && screens.includes(screen)` без ограничения до одного — на `/b/nuri-nail-studio`
  показывались сразу оба одобренных блока (проверяющий подтвердил живым прогоном).
  Стало: новая `pickOnePromoBlockForScreen()` в `src/api/online.ts` — общий фильтр + сортировка по
  `createdAt` (самый старый подходящий побеждает) + `[0]`; обе точки (`getPublicBusinessData`,
  `getPromoBlocksForScreen`) теперь зовут её. `PublicBusinessPage.tsx` не трогал — он как был `.map()` по
  массиву, так и остался, просто массив теперь длины ≤ 1. Проверено снимком `/b/nuri-nail-studio` (телефон,
  ru) — виден один блок «−15% на первую запись онлайн», второй (нацеленный на тот же экран через прямую
  правку localStorage в прошлом прогоне) больше не рендерится. Снимок:
  `qa/shots/online-g2-2-fix1b/b-nuri-nail-studio__guest-nails-ru-light-phone.png`.

- **F-00-067** — «клиент получает пуш о решении» (подтвердил/отклонил заявку). Было: `respondToRequest`
  меняло статус и писало в свой лог, но никуда не уведомляло клиента — подтверждено чтением кода.
  Разобрался, что предыдущая запись в `qa/requests/online.md` про этот F-id была про ДРУГУЮ его половину
  (счётчик/колокольчик у МАСТЕРА о новой заявке, упирается в чужой `pushInboxEvent` из `notify`) — а дефект
  измерителя про КЛИЕНТА. Эту часть закрыл целиком в своих файлах, без правки `notify`:
  - `BookingConfirmedScreen.tsx` (`/b/[slug]/booking/[bookingId]`) — пока заявка `awaiting_confirmation`,
    опрашивает статус раз в 15 с; при переходе в `scheduled`/`cancelled_by_master` — тост + настоящий
    браузерный `Notification` (если разрешение дано; запрашивается при заходе на страницу с открытой
    заявкой).
  - `CabinetScreen.tsx` (`/b/[slug]/me`, «Мои записи») — то же самое для всех заявок клиента сразу (не
    только той, чья страница открыта); плюс статус-бейдж у каждой предстоящей записи в самом списке — этого
    не было вовсе (список показывал только услугу/время/мастера).
  - Новые ключи `confirmed.pushDecisionConfirmed` / `confirmed.pushDecisionDeclined` в
    `messages/{ru,en}/online.json`.
  Честная граница (записана в `qa/requests/online.md`): работает, только пока у клиента открыта вкладка —
  живой опрос своих же API раз в 15 с, а не пуш в закрытое приложение. Настоящей push-инфраструктуры
  (service worker/VAPID) в проекте нет ни у кого — это не блокер конкретно `online`.

## partial

Ничего не осталось partial по этим двум дефектам — оба закрыты целиком в своих файлах.

## Проверка

- `tsc --noEmit --incremental` по всему проекту, вывод отфильтрован по путям `online` — 0 ошибок (весь `tsc`
  тоже завершился без ошибок, exit 0).
- `eslint src/api/online.ts src/areas/online/public/CabinetScreen.tsx src/areas/online/booking/BookingConfirmedScreen.tsx`
  — чисто.
- `scripts/ensure-dev.sh` — сервер уже был поднят, не трогал.
- `scripts/measure.mjs` — `/biz/online/page`, `/biz/online/requests` (owner, ru/en, телефон/десктоп) и
  `/b/nuri-nail-studio`, `/b/hayk-barber`, `/b/hayk-barber/about` (guest, ru/en, телефон/десктоп): 20 страниц,
  0 ошибок консоли, 0 сырых ключей, 0 4xx. Отчёты: `qa/shots/online-g2-2-fix1/report.json`,
  `qa/shots/online-g2-2-fix1b/report.json`.
- Снимок промоблока просмотрен глазами (см. выше) — один блок вместо двух.

## marked

`node scripts/fids.mjs --area online` после работы: **136 / 160 (85.0%)**.
