# Раздел «Клиенты и CRM» — b02, правка пачки дефектов fix1

Сборщик чинит дефекты, найденные измерителем в пачке b02 «Клиент по номеру телефона: форма
добавления, поля, карточка-панель и её главная вкладка».

## Дефекты и правки

### F-04-067 (major) · Третья иконка в блоке «Написать:» была звонком, а не Viber

- Было: `src/areas/clients/ClientCardScreen.tsx` рисовал WhatsApp, Telegram и звонок
  (`Smartphone` + `telLink`) — Viber нигде в разделе не был реализован. ТЗ (F-04-067) требует
  ровно три мессенджера: WhatsApp, Viber, Telegram (Viber доступен в Армении).
- Правка:
  - `src/areas/clients/lib/messengers.ts` — добавлена `viberLink(phone)` (`viber://chat?number=…`),
    рядом с уже существующей `tgLink`.
  - `src/areas/clients/ClientCardScreen.tsx` — третья иконка в блоке «Написать:» теперь Viber
    (`MessageSquare` + `viberLink`, подпись «Viber»), а не звонок. `IconLinkButton` научился не
    открывать `viber://` в новой пустой вкладке (та же логика, что уже была для `tel:`).
  - Ссылка кликабельна только когда у клиента есть телефон (как и раньше — блок целиком строится
    из `row.phone`); у клиента без номера блок не показывает мессенджеров.
- «Готово, когда» (F-04-067): ✅ у клиента с номером видны иконки WhatsApp, Viber, Telegram — у
  клиента без номера их нет (общий `row.phone`-гейт блока не менялся); ✅ клик открывает чат с этим
  номером (`wa.me`, `viber://chat?number=`, `t.me/+`).
- Замер: `qa/shots/clients/biz-clients-cl-001__owner-nails-ru-light-desktop.png` — три разные иконки
  видны в блоке «Написать:».

### F-04-047 / F-04-048 (minor) · Код страны «+374» дублировался в поле телефона

- Было: при коде +374 `CountryPhoneField` рисовал `Select` с кодом слева **и** передавал значение в
  `PhoneInput` фундамента, у которого свой несъёмный префикс «+374» — код страны был виден дважды в
  одном поле.
- Правка (только в своих путях, без ядра): `src/areas/clients/components/CountryPhoneField.tsx` при
  коде +374 больше не использует `PhoneInput` — вместо этого рисует маску сам, обычным `Input` +
  `formatLocalDigits`/`PHONE_DIGITS` из `@/lib/phone` (тот же формат вывода, то же ограничение в 8
  цифр, то же хранимое значение `+374XXXXXXXX`). Код страны теперь виден один раз — в `Select`.
- Просьба в `qa/requests/clients.md` (о том, что `src/ui/PhoneInput` не принимает код страны)
  оставлена открытой на будущее — если ядро добавит параметр кода страны, можно будет вернуться на
  общий `PhoneInput` — но сам дубль в интерфейсе устранён уже сейчас, ядро для этого не потребовалось.
- Замер: `qa/shots/clients/b02-fix1-check/biz-clients__owner-nails-ru-light-desktop__add-form-phone.png`
  — код страны один раз (в `Select`), поле номера — плейсхолдер «Номер 1» без второго «+374».

### F-04-069 (minor) · Подсказка загрузки фото врёт про лимит МБ — не в путях раздела

- Дефект живёт целиком в общем `src/ui/ImageUpload.tsx` (жёсткий текст `upload.hint` в
  `messages/*/ui.json` без интерполяции `{maxSizeMb}`) — не в путях раздела `clients`. Валидация в
  разделе верна: `ClientCardScreen.tsx` передаёт `maxSizeMb={12}`, компонент реально проверяет по 12
  МБ — страдает только текст подсказки общего компонента.
- Уже записано в `qa/requests/clients.md` (запись «`ImageUpload` hint врёт про лимит МБ», измеритель,
  25.09) с точной правкой для хранителя `src/ui`. Сам не правил чужой файл — только зафиксировал.

## Проверки

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/clients.tsbuildinfo` — 0 ошибок в путях
  раздела (`grep` по `areas/clients|domain/clients|mock/slices/clients|api/clients` пуст).
- `npx eslint src/areas/clients src/app/biz/clients src/domain/clients.ts src/mock/slices/clients.ts
  src/api/clients.ts` — чисто.
- `node scripts/check-tokens.mjs --area clients` — «✓ сырых цветов нет».
- `bash scripts/ensure-dev.sh` — сервер уже работал, не трогал.
- `node scripts/measure.mjs --area clients --persona owner --lang ru --device phone,desktop` — 12
  страниц, 0 ошибок консоли, 0 4xx, 0 сырых ключей, 0 вылетов, 0 мелких целей, 0 «висит загрузка».
- Точечный сценарий на форму добавления клиента (`add-form-phone`) — 0 ошибок, 3/3 шага прошли.
- Снимки посмотрены глазами (Read png): карточка клиента (иконки мессенджеров) и форма добавления
  (поле телефона) — оба соответствуют ожидаемому виду.

## done

- F-04-067
- F-04-047
- F-04-048

## partial

- F-04-069 — «Готово, когда» по существу выполнено кодом раздела (лимит 12 МБ реально работает),
  но сам найденный дефект (текст подсказки «до 10 МБ») лежит в общем `src/ui/ImageUpload.tsx` и не
  в путях раздела `clients` — правка не сделана напрямую, зафиксирована как просьба в
  `qa/requests/clients.md` для хранителя общего кода.

## marked

66 (`node scripts/fids.mjs --area clients`, после этой правки)
