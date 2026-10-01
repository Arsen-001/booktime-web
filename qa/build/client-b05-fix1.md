# client · b05-fix1 — починка дефектов измерителя

Пачка b05 «Продвижение и «Приложения» в кабинете». Ниже — что сделано по каждому найденному дефекту.

## Исправлено

- **F-14-034 (major)** — на вкладке «Своя фотография» генератора сторис добавлено поле «Подпись
  миниатюры» (`FormField` + `Input`, `maxLength=70`, счётчик `{count}/70`, необязательное). Значение
  обрезается до 70 символов и на клиенте (`caption.slice(0, 70)`), и на сервере мока
  (`purchaseStory` → `caption: input.caption?.slice(0, 70)`). Новое поле `Story.caption` добавлено в
  `src/domain/client.ts` и `PurchaseStoryInput.caption` в `src/api/client.ts`.
  Файлы: `src/areas/client/apps/StoriesGeneratorScreen.tsx`, `src/domain/client.ts`, `src/api/client.ts`,
  `messages/{ru,en}/client.json` (ключи `apps.stories.captionLabel/captionPlaceholder/captionCount`).

- **F-14-172 (minor)** — под вкладками генератора сторис (виден на обеих: «Из шаблона» и «Своя
  фотография») добавлена строка `apps.stories.durationHint` — «Сторис показывается 24 часа, потом
  исчезает сама» — заявлено ДО покупки, не только после. `data-f="F-14-172"`.
  Файл: `src/areas/client/apps/StoriesGeneratorScreen.tsx`.

- **F-00-159 (minor)** — на экране просмотра сторис (`StoryViewScreen.tsx`) картинка теперь ограничена
  `max-h-[55vh]`, а кнопка «Записаться» вынесена в `sticky bottom-0` панель (тот же паттерн, что уже
  используется в `BookingWizard.tsx` раздела `online`) — на телефоне 390×844 кнопка видна в зоне
  большого пальца без прокрутки. Проверено скриншотом (клик по сторис на главной клиента) — кнопка
  «Записаться» полностью в кадре.
  Файл: `src/areas/client/stories/StoryViewScreen.tsx`.

- **F-00-114 (minor, сид)** — сгенерированная демо-новость больше не попадает пустым демо-бизнесам
  (`EMPTY_BIZ_IDS` = `BIZ.empty`, `BIZ.emptySolo`), даже когда индекс совпадает с условием `i % 4 === 1`.
  Проверено скриншотом: `owner-empty` → «На этой неделе отправлено 0 из 3 бесплатных», лента новостей
  пуста.
  Файл: `src/mock/slices/client.ts`.

- **F-00-114 (major, «новость нигде не показывается клиенту»)** — при чтении кода выяснилось, что путь
  показа УЖЕ существует и работает правильно: `createNewsPost` (`src/api/client.ts`) фан-аутит новость в
  `notifications` только подписчикам, не приглушившим новости (`recipients` строится из `favorites`,
  фильтр `!f.newsMuted`); `listNotifications` отдаёт запись клиенту, если бизнес не в `mutedBusinessIds`;
  `NotificationsScreen.tsx` рендерит `kind === 'broadcast'` иконкой `Megaphone`, текстом новости и ссылкой
  на `/places/{businessId}` (`data-f="F-14-070"`). Оба пункта «Готово, когда» F-00-114 (4-я новость за
  неделю не уходит бесплатно / видна только подписчикам) выполняются. Изменений в коде для этого пункта
  не потребовалось — отмечаю как уже сделано, чтобы измеритель не тратил время на повторную проверку той
  же находки.

## Замечание §0.1 (не из пачки b05, но block/major в `qa/measure/client/`)

- **decision-c2.md, major: комментарий администратора CRM виден клиенту** (F-00-130, F-00-010 — «клиенту
  из CRM мастера не показываем НИЧЕГО»). `Booking.comment` теперь снимается на выходе из ВСЕХ мест
  `src/api/client.ts`, которые отдают запись клиенту: `getBooking` (карточка записи), `enrichBooking`
  (списки «Мои записи» — предстоящие/прошедшие/отменённые), `listNotifications` (запись, прикреплённая к
  уведомлению). Поле убирается деструктуризацией перед возвратом — не долетает до payload вовсе, не
  только скрыто вёрсткой. Отметил `✅ исправлено (b05-fix1)` в `qa/measure/client/decision-c2.md`.
  Проверено: код (деструктуризация `comment` в трёх функциях) + `tsc`/`eslint` чисто; браузером не
  проверял (нет фиксированного id записи с комментарием в текущем сиде под рукой) — если у измерителя
  под рукой есть `bookingId` с `comment`, стоит перепроверить `/bookings/<id>` глазами.

## Не мои пути — оставлено в `qa/requests/client.md`

- **F-14-082 / F-14-139 / F-14-140 (major)** — реальный баг в `src/i18n/load.ts` (фундамент,
  `mergeWithFallback` не мёржит массивы, поэтому `apps.compare.*` списки на EN и любой не-ru локали всегда
  русские). Готовый патч записан в `qa/requests/client.md`, сам файл не трогал — «фундамент» не в путях
  `client`.
- **F-14-003 (minor)** — нужна ссылка «Онлайн-запись → Настройки» → `/biz/apps`; файл — в разделе
  `online` (`src/app/biz/online/settings` / `src/areas/online/settings/SettingsScreen.tsx`), не мой путь.
  Просьба с точным местом и текстом — в `qa/requests/client.md`.

## Проверка

- `tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/client.tsbuildinfo` — 0 ошибок (весь проект).
- `eslint` по изменённым файлам — 0 ошибок (только уже существовавшие warning `no-img-element`).
- `scripts/ensure-dev.sh` — сервер уже работал, не трогал.
- `scripts/measure.mjs --routes /biz/apps/stories,/biz/apps/news --persona owner --lang ru,en --device phone,desktop`
  и отдельно `--persona owner-empty` для `/biz/apps/news` — везде 0 ошибок консоли, 0 сырых ключей, 0 `i18n нет en`,
  0 вылетов, 0 «висит загрузка». Отчёты — `qa/shots/client-b05-fix1/report*.json`.
- Сценарии `measure.mjs --scenario` — переключение на вкладку «Своя фотография» (поле подписи видно) и
  клик по сторис на главной клиента (кнопка «Записаться» видна на телефоне без прокрутки) — скриншоты
  просмотрены (`Read png`).

## done

- F-14-034
- F-14-172
- F-00-159

## partial

- F-14-082 / F-14-139 / F-14-140 — патч готов в `qa/requests/client.md`, не применён (фундамент, не мой путь).
- F-14-003 — нужен один линк в разделе `online`, запрос с точным местом — в `qa/requests/client.md`.

## marked

`node scripts/fids.mjs --area client` после работы: **client 246 всего, 126 помечено (51.2%)**.
