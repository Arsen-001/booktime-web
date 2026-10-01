# client · b04-fix2 — починка дефектов пачки b04 (2026-09-25)

Измеритель проверил пачку b04 (абонементы, сертификаты, карты лояльности, кэшбэк) и нашёл 5
дефектов (2 block, 2 major, 1 minor). Все пять починены на моковых данных.

## F-14-042 · Логотип сети на картах лояльности — было BLOCK, теперь done

Раньше в клиентском разделе не было понятия «сеть» вообще (grep по коду ничего не находил) — карточки
абонемента/сертификата всегда показывали лого своего бизнеса. У ядра нужные данные уже были
(`Business.networkId`, `Network.businessIds[0]` — основная локация, `Business.logoUrl`), просто
клиентский API их не читал.

- `src/api/client.ts`: `attachBusiness()` (общий помощник для абонементов, сертификатов и карт
  лояльности) теперь берёт `businessLogoUrl` с основной локации сети, если бизнес состоит в сети из
  ≥ 2 филиалов; иначе — лого самого бизнеса, как раньше. Действует сразу на `getMembership`,
  `listMemberships`, `getCertificate`, `listCertificates`, `listLoyaltyCards`.
- Заодно в `attachBusiness()` появилось поле `network?: NetworkLocationsInfo` (сеть + список филиалов) —
  на нём строятся и остальные два фикса ниже.
- Демо: чтобы сценарий сети был виден независимо от истории посещений конкретной демо-персоны, в
  `src/mock/slices/client.ts` (версия среза 9→10) добавлен ещё один действующий абонемент — в сети
  Manana Beauty (`biz_manana_nn`).
- Проверено на снимке `qa/shots/client-b04-fix2/…membership-network-detail.png` и на
  `/places/biz_manana_nn`, `/places/biz_manana_sh` — лого берётся с основной локации сети во всех
  случаях (в демо-данных лого совпадают визуально — оба сгенерированы с одинаковыми параметрами в
  `src/mock/seed/businesses.ts`, это фундамент, не мой путь; сама логика проверена по коду и по значению
  `businessLogoUrl` в ответе API).

## F-14-163 · Филиал сети по умолчанию — было BLOCK, теперь done

Функции не было вовсе — ни экрана, ни логики. Добавил:

- `src/domain/client.ts`: тип `NetworkLocationsInfo` (сеть + список филиалов).
- `src/mock/slices/client.ts`: `ClientState.defaultNetworkLocation: Record<string, Id>`
  (ключ `${appUserId}:${networkId}`) — переживает перезагрузку (часть среза `mock/db.ts`, как и всё
  остальное в приложении).
- `src/api/client.ts`: `getDefaultNetworkLocation`, `setDefaultNetworkLocation`; `getPlaceCard` теперь
  возвращает `network` для карточки места.
- `src/areas/client/places/PlaceCardScreen.tsx`: новая секция «Филиалы сети» (`data-f="F-14-163"`,
  ключ `place.branchesTitle` уже был заготовлен в словарях, но не использовался нигде) — список всех
  локаций сети, у текущей — бейдж «Вы здесь», у остальных — кнопка «Открыть» (переход) и кнопка/бейдж
  выбора «по умолчанию». Работает и для клиента без входа (сам список виден), выбор доступен только
  вошедшим (иначе некуда сохранять).
- Проверено сценарием: `qa/shots/client-b04-fix2d/report.json` — клик «Сделать основным» → тост
  «Филиал сохранён по умолчанию» → переход на другую страницу и обратно → отметка «По умолчанию»
  осталась на новом филиале (`…after-reload.png`).

## F-14-039 · «Записаться» из абонемента при нескольких локациях сети — было MAJOR, теперь done

- `src/areas/client/network/NetworkLocationModal.tsx` (новый) — модалка выбора филиала на базе
  `Modal`/`ChoiceCard`, предвыбор — сохранённый филиал по умолчанию (F-14-163) или свой бизнес
  абонемента.
- `src/areas/client/memberships/MembershipDetailScreen.tsx`: кнопка «Записаться» теперь `Button`, а
  не прямая ссылка — если у абонемента `network` (сеть из ≥ 2 локаций), сначала открывает модалку
  выбора, иначе сразу ведёт в `/book?business=…`, как раньше.
- Проверено сценарием: `qa/shots/client-b04-fix2/…membership-network-book-modal.png` — на абонементе
  сети Manana Beauty кнопка «Записаться» открывает «В каком филиале записаться?» с двумя филиалами,
  выбор подтверждается кнопкой «Выбрать» и ведёт на `/book?business=<id>` нужного филиала.

## F-14-044 · Когда продажи появляются в приложении — было MAJOR, теперь частично done

Пункт 2 («если продавать нечего — блока нет») и пункт 3 («выбор действует и в приложении») — done.
Пункт 1 (настоящая настройка владельца «Онлайн-запись → Ссылки → Настроить → Продажа абонементов и
сертификатов: Нет продажи / Сеть …») — не мой путь (хозяин — online/network), не строил его UI;
задокументировал в `qa/requests/client.md`.

- `src/api/client.ts`: `resolveSalesSourceBusinessId()` — для бизнеса в сети автоматически находит
  первый филиал сети (по `Network.businessIds`), у которого включена хоть одна продажа
  (`onSale: true` в `membershipTemplates`/`certificateTemplates`); если ни у кого нет — берёт основную
  локацию. `listPurchasableMemberships`/`listPurchasableCertificates` резолвят через эту функцию перед
  фильтром.
- Эффект виден на демо: `mananaNN` (основная локация сети, своих продаж не настроено) теперь
  показывает блок «Покупки» с каталогом `mananaSH` (у него настроены продажи) — единый каталог продаж
  на уровне сети, а не «ничего нет», как было до фикса. Пустое состояние («если продавать нечего»)
  по-прежнему работает: блок скрывается, если ни у одного филиала сети нет `onSale`-типов.
  Скриншот: `qa/shots/client-b04-fix2e/places-biz-manana-nn__client-nails-ru-light-desktop__full.png`
  (секция «Покупки» внизу — оба типа с `mananaSH`).

## F-14-046 · Напоминание об окончании абонемента — было MINOR, теперь done

Кнопка «Продлить» в баннере на главной вела на карточку абонемента (`/memberships/[id]`), откуда
нужен был ещё один тап («Renew») — F-06-159/F-14-045 требуют прямого потока покупки.

- `src/areas/client/home/HomeScreen.tsx`: `MembershipReminderBanner` — «Продлить» теперь сразу
  выполняет ту же покупку, что и «Renew» на карточке (`findRenewTemplate` → `purchaseMembership`),
  показывает тост и ведёт на купленный абонемент (или на карточку места, если тип снят с продажи) — без
  промежуточного тапа.

## Проверки перед сдачей

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/client.tsbuildinfo` — 0 ошибок в путях
  раздела (`src/app/(client)`, `src/app/biz/apps`, `src/areas/client`, `src/domain/client.ts`,
  `src/mock/slices/client.ts`, `src/api/client.ts`); ошибки есть только в чужих разделах (journal,
  online) — не трогал.
- `npx eslint` по всем изменённым файлам — 0 ошибок.
- `scripts/ensure-dev.sh` — сервер был поднят другим агентом, не трогал.
- `scripts/measure.mjs` по затронутым маршрутам (`/memberships`, `/places/biz_manana_nn`,
  `/places/biz_manana_sh`) и по сценариям клика — 0 ошибок консоли (одна флейковая ошибка Next.js
  «Router action dispatched before initialization» не повторилась при повторном прогоне той же
  страницы — не связана с правкой), 0 сырых ключей, 0 недостающих переводов, 0 мелких зон нажатия,
  все шаги сценариев (клики, тосты, переходы) прошли. Снимки — `qa/shots/client-b04-fix2*/`.
- Снимки посмотрены глазами (Read png): карточка абонемента сети, модалка выбора филиала, секция
  «Филиалы сети» на телефоне и десктопе (после правки вёрстки — до неё узкие карточки на телефоне
  обрезали название филиала, теперь имя не сжимается кнопкой).

## Словари

`messages/ru/client.json`, `messages/en/client.json` — новые ключи: `place.branchHere`,
`place.branchDefault`, `place.branchSetDefault`, `place.branchDefaultSet`, `place.branchDefaultFailed`,
`place.openBranch`, `memberships.pickLocationTitle`, `memberships.pickLocationHint`,
`memberships.pickLocationConfirm`. `hy` не трогал (сейчас пишем только ru/en, §0.4 CONVENTIONS.md).

## done

- F-14-042
- F-14-163
- F-14-039
- F-14-046

## partial

- F-14-044 — п. 2 и п. 3 «Готово, когда» выполнены (пустой блок скрывается, единый каталог продаж
  сети виден и действует в приложении); п. 1 (настоящая настройка «Нет продажи / Сеть …» в кабинете
  сети) не мой путь — хозяин online/network, запрос записан в `qa/requests/client.md`
  (`## 2026-09-25 · b04-fix2: «чьи онлайн-продажи показывать»…`).

## marked

103 (`node scripts/fids.mjs --area client`, после этой пачки)
