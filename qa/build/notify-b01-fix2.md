# notify · b01-fix2 — починка дефектов измерителя

Пачка b01 «Каркас раздела и главные экраны». Чинил все дефекты из списка (block/major обязательные,
minor тоже), кроме двух, упирающихся в чужие/фундаментные файлы — они задокументированы как просьбы.

## Исправлено

- **F-05-002 (major)** — вкладка «Типы уведомлений»: названия типов, подписи каналов, фильтр-кнопки,
  заголовки групп и бейджи получателей больше не берут `.name.ru` / `*_LABEL_RU` напрямую. Добавил
  `channelLabel/recipientLabel/groupLabel(…, locale)` в `src/areas/notify/lib/registry.ts` (там же
  `RECIPIENT_LABEL_EN`, `GROUP_LABEL_EN` — `CHANNEL_LABEL_EN` уже был, просто не использовался) и
  завёл `useLocale()` в `TypesTab.tsx`. На `lang=en` весь список — по-английски (проверено снимком).
- **F-05-005 (major)** — страница типа: заголовок и описание берут `type.name[locale] ?? type.name.ru`
  / `type.description[…]`, метки каналов и получателя — через новые функции. Проверено на
  `/biz/notifications/types/8` и `/types/8/templates` (снимок en/phone приложен к отчёту измерителя).
- **F-05-107 (major)** — журнал отправок: `LogMessage.typeLabel` и `LogMessage.text` стали
  `LocalizedText` (домен `src/domain/notify.ts`), сид (`src/mock/slices/notify.ts`, version 2→3) и
  `createMailing` (`src/api/notify.ts`) заполняют `ru`+`en` для системных ярлыков и генерируемого текста
  уведомлений; текст, который реально вводит владелец при рассылке, кладу как `{ ru: input.text }` —
  не выдумываю перевод чужих слов, `en` честно покажет ru (это и есть контракт `LocalizedText`).
  Колонки «Тип» и «Канал» и «Текст» в `LogScreen.tsx` теперь читают через `locale`; фильтр по типу и
  список вариантов типа тоже переведены на локализованные значения. Снимок en/desktop — все шесть
  дефектных полей (тип/канал/текст) по-английски.
- **F-05-068 (minor)** — дефолт «Имя отправителя SMS» был `'Altegio'` — заменил список на свои
  нейтральные варианты `['Salon', 'Beauty', 'Studio']` (`SmsChannelScreen.tsx`). Больше нигде в
  разделе слово «Altegio» не встречается как видимый текст (только в комментарии к реестру — это код,
  не экран).
- **F-05-003 (minor)** — `aria-label` тумблера типа: было одно `toggleAria` со словом «Включить»
  всегда. Разбил на `typesTab.toggleAriaOn` / `typesTab.toggleAriaOff` (ru+en) и выбираю в
  `TypeRow` по `type.enabled`: включённый тип объявляет «Выключить «…»», выключенный — «Включить «…»».
- **F-05-013 (minor, наша часть)** — само наполнение вкладки «Шаблоны уведомлений» не трогал (уже
  работает); причина перекрытия — общий `src/ui/Tabs.tsx` (плавающая кнопка-шеврон при переполнении
  списка вкладок). Это фундамент, не наш путь — записал точную просьбу с номером строк и предлагаемым
  решением в `qa/requests/notify.md`.

## Заодно — просьба фундамента выполнена (не в списке дефектов, но открытый request)

Хранитель дизайна в `qa/requests/notify.md` просил у нас `countUnreadInbox(businessId)` и
`listInboxPreview(businessId, limit)` для настоящего колокольчика (F-05-061). Добавил обе функции в
`src/api/notify.ts` (источник — `readCore().bookings` + `inboxRead`, те же события, что в
`InboxScreen`) и отчитался об этом в `qa/requests/notify.md` — дальше подключает сам фундамент.

## Не сделано (не наши пути) — см. `qa/requests/notify.md`

- **F-05-061 (major)** — настоящий колокольчик (`src/shell/workspace/NotificationsBell.tsx`) —
  фундамент; наша сторона (`InboxScreen` + новые функции API) готова, ждёт подключения хранителем.
- **F-05-001 (major)** — третий вход из «Онлайн-запись → Основные настройки»: страница ещё не
  построена разделом `online` (чужой путь), открытая просьба уже стояла в `qa/requests/notify.md`, не
  дублировал.

## Проверка

- `tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/notify.tsbuildinfo` — 0 ошибок в путях notify
  (единственная ошибка в выводе — `src/areas/client/memberships/MembershipsScreen.tsx`, чужой раздел,
  не трогал).
- `eslint src/areas/notify src/api/notify.ts src/domain/notify.ts src/mock/slices/notify.ts` — чисто.
- `node scripts/measure.mjs --area notify --persona owner --lang ru,en --device phone,desktop` — 32
  страницы, 0 ошибок консоли, 0 `4xx`, 0 `i18n:missing`/`no-en`, 0 сырых ключей, 0 вылетов, 0 мелких
  целей (`qa/shots/notify-fix2/report.json`).
- Отдельно `/biz/notifications/types/8`, `/types/8/templates`, `/biz/notifications/channels/sms` на
  ru/en × phone/desktop — тоже чисто (`qa/shots/notify-fix2-detail/report.json`).
- Посмотрел глазами (Read png): `biz-notifications__owner-nails-en-light-phone.png` (список типов —
  весь en), `biz-notifications-types-8__owner-nails-en-light-phone.png` (заголовок/описание/статусы —
  en), `biz-notifications-log__owner-nails-en-light-desktop.png` (журнал — тип/канал/текст/статус — en).
- `node scripts/fids.mjs --area notify` — не ломал разметку `data-f`, число ниже.

## assumed

- Текст рассылки, который реально набрал владелец бизнеса (`createMailing`), не переводится
  автоматически на en в журнале — хранится как заведено только `ru`, контракт `LocalizedText` сам
  показывает ru как запасной вариант. Системные ярлыки типа и сгенерированный текст (напоминания,
  подтверждения) — с готовым `en`, это наши слова, не ввод пользователя.
- Служебные "устаревшие" (`typeCode`-less) записи журнала (смена пароля, приглашение сотрудника) тоже
  получили `en`-вариант — это тоже наш текст, не пользовательский ввод.
- `toggleAriaOn/Off` — новые ключи, `toggleAria` убран целиком (в коде больше не используется, проверил
  `grep`).

marked = 30
