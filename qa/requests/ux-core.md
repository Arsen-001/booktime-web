# Переслано хранителю дизайна от хранителя ядра (k1, 25.09.2026)

Просьбы разделов, которые пришли в общие файлы, но касаются `src/ui/**`, `src/shell/**` или `scripts/**` —
не моих путей. Источник — в скобках; отметку «сделано» ставьте здесь.

## 1. `PublicShell`: подвал со ссылкой и i18n (online.md, F-03-027) — major

> ✅ сделано (r3): у `PublicShell` проп `footer?: ReactNode`; подвал один, прижат к низу (`mt-auto`, отступ под safe-area); по умолчанию — «Azat» ссылкой на `/` с подчёркиванием. online передаёт свой `PoweredByMark` через `footer` в `src/app/b/[slug]/layout.tsx`.
- Сейчас `<footer>Azat</footer>` — голый текст без ссылки и без перевода. ТЗ: слово — подчёркнутая ссылка на площадку.
- Как: принять `footer?: ReactNode` (online передаст готовый `src/areas/online/public/PoweredByMark.tsx`) или
  заменить на `<Link href="/">` с текстом из словаря.

## 2. `Calendar`: ячейка дня 38px при панели 288px (journal.md, F-01-003) — minor

> ✅ сделано (r3): ячейка дня — круг `aspect-square w-full max-w-11 min-w-10`: в панели 288 px — по ширине колонки (≥ 40 px), шире — 44 px.
- `grid-cols-7` + `size-10` в панели журнала рисует ~38px, замер ругается на «мелкую цель».
- Как: убрать `gap` между колонками или дать ячейке `min-w-10` с `w-full`, чтобы 7 колонок не резали 40px.

## 3. `Sheet side="bottom"` на телефоне пропадает со снимка (schedule.md) — проверить

> ✅ проверено (r3): сам `Sheet` на 390×844 снимается стабильно (сценарий `qa/scenarios/steward-r3-panels.json`, 4 шторки на телефоне). Причина у schedule — вылет страницы по ширине (sr-only в прокрутке, см. ux-schedule №2): шторка открывалась ниже экрана. `Table` и `SlotButton`/`Stepper`/`FilterBar` теперь сами дают `relative` контейнерам с sr-only.
- В сценариях на 390×844 после открытия шторки `expectVisible` проходит, но снимок — без шторки (и в schedule, и в
  journal «Новая запись»). На десктопе всё стабильно. Проверить `Sheet` и/или `scripts/measure.mjs` (fullPage/скролл).

## 4. `PhoneInput`: другой код страны (clients.md, F-04-047) — minor

> ❌ не делаю (r3): выбор кода страны меняет правило номера (`normalizePhone`, 8 цифр после +374 в `src/lib/phone.ts`) — это ядро и решение продукта (рынок — Армения). Взамен `onValueChange` отдаёт второй аргумент `{ localDigits }` для поиска. Решит ядро — добавлю выбор кода в поле.
- Нужен `countryCode?`/выбор кода перед маской; по умолчанию +374. Пока clients держит свой `CountryPhoneField`.
> **Ядро k2 (25.09):** ❌ решение по умолчанию: только +374 (рынок — Армения; номер — ключ клиента, F-00-128). Вопрос владельцу — `qa/questions/core.md`. Выбор кода в поле не нужен, пока нет ответа.

## 5. Режим «Журнал / Администрирование» (journal.md, F-01-001) — решение продукта

> ❌ не делаю (r3): решение продукта, единое меню — сознательное упрощение. Взамен — `useDenseScreen()` (`src/shell/workspace/useDenseScreen.ts`): экран просит свернуть меню до рейки 76 px, ручной выбор человека сильнее.
- Кнопка внизу левой панели кабинета, переключающая «рабочее место дня» и «управление». Это `src/shell/biz/**`.
  Хранитель ядра не строил: единое меню — сознательное упрощение; если делать — компактный режим «День» в BizShell.

## 6. Подпись статуса записи с учётом сферы (e2e-q1 №7) — minor · от хранителя ядра k2
- В стоматологии админ видит «Отменил мастер», по F-00-148 — «Отменил врач». Ключи готовы: `common.bookingStatusTerms.<набор>.*`
  и функция `bookingStatusLabelKey(status, sphereId)` из `@/i18n/useSphereTerms` (полный ключ — через `useTDynamic`).
- Что именно: в `useBookingStatusLabel('business')` / `BookingStatusBadge` брать подпись через `bookingStatusLabelKey(status, sphere)`
  (сфера — `useSphere().id` в кабинете). Голос клиента (`ui.bookingStatusClient.*`) не меняется.

## 7. Колокольчик кабинета (notify.md) — minor · от хранителя ядра k2
- `src/shell/workspace/NotificationsBell.tsx` — заглушка. Данные есть: журнал событий ядра `listBookingEvents` + новости notify.
  Когда notify даст `countUnread(businessId)` / `listInbox(...)` в `src/api/notify.ts`, каркас показывает счётчик и ведёт на
  `/biz/notifications/inbox`.

## 8. Меню: `soon` и `useCount` (ux-clients №1, ux-online R2-2) — minor · от хранителя ядра k2
- Поля есть в `src/config/nav-types.ts`: `soon?: boolean` (Badge «скоро»), `NavChild.useCount?: () => number | undefined` — звать в
  маленьком компоненте на каждый пункт (правило хуков), Badge скрыт при 0/undefined, в свёрнутом меню — точка.


## 9. Кнопка и вкладка — 40 px, а не 44 px (a11y-q2 №1) — major · от хранителя ядра k3
- 40 px нашлись уже не на `Chip`, а на обычных кнопках/ссылках-кнопках и вкладках в 5 разделах: client `/` «Все», `/search`
  «Рядом со мной», schedule `/biz/schedule/slots` «К графику», clients «Новый собеседник в чате», notify вкладки
  «Записи»/«Новости сервиса» и «Прочитать все» (таблица — `qa/requests/a11y-q2.md`).
- Как: минимальная высота нажимаемого у `Button` (размер sm на телефоне) и `Tabs` — 44 px, лучше одним токеном `--tap-min`.

## 10. `Stepper`: подпись активного шага наезжает на соседа при 5 шагах (client b06-fix1, schedule F-02-045) — minor
- У активного шага `shrink-0 whitespace-nowrap` — не сжимается и залезает на кружок следующего (1440 px, русские подписи).
- Как: активной подписи тоже `min-w-0 truncate` (или перенос в 2 строки под кружками); `@max-[45rem]:sr-only` — для всех шагов.

## 11. `PageHeader.favorite` — звёздочка «в избранное» у заголовка (journal b04, F-01-005) — minor
- Нужен проп `favorite?: { active: boolean; onToggle: () => void }` — одна звезда у заголовка во всех разделах; список избранного
  журнал уже хранит и рисует (`toggleFavorite` в `src/api/journal.ts`).

## 12. `QrCode` и `ScrollRow autoplay` (client b05) — minor
- Настоящий QR (сканируемый) — компонент `src/ui/QrCode` (пакет — решение главного); автопрокрутка ряда сторис — вариант
  `autoplay` у `ScrollRow` вместо своего `setInterval` в `StoriesRow.tsx`.

## 13. `Tabs`: круглая стрелка перекрывает текст последней вкладки на телефоне (notify b01-fix2, F-05-013) — minor
- `/biz/notifications/types/[code]/templates`, variant="line": нужен отступ списка под ширину стрелки или градиентная подложка.

## 14. Колокольчик — данные готовы, подключить (notify, 4-я просьба; e2e-q2 №3а) — major · обновление к №7
- В `src/api/notify.ts` уже есть `countUnreadInbox(businessId)` и `listInboxPreview(businessId, limit = 5)` (поле `unread`),
  отметить прочитанными — `markInboxRead`. Пример вызова — `src/areas/notify/InboxScreen.tsx`. Персоне `master` — только свои.

## 15. «Голая» страница внутри кабинета: анкета клиента по ссылке (clients b05, F-04-154) — minor
- `/biz/clients/consent/[clientId]` открывает клиент без входа — меню и верхняя полоса кабинета там лишние. Layout не знает
  адреса, поэтому это решается в `BizShell` (`usePathname`: `/biz/clients/consent/` — без меню) или отдельным публичным путём
  (тогда — `docs/areas.json`, решает главный).

## 16. Всплывающее окно о новой записи в любом месте кабинета (notify b03, F-05-058) — minor
- Настройки есть у notify (`getWebPopupSettings`), события — `listBookingEvents({ businessId, since })` ядра. Нужен общий слот
  в каркасе кабинета: наблюдатель событий + Toast. Если удобнее вкладом раздела — скажите, заведу хост `workspace` в
  `src/extensions` (файл вклада создаст notify).

## 17. Стрелки прокрутки `Tabs` — «кнопка без подписи» у измерителя (a11y-q3 №3) — minor · от хранителя ядра k4
- a11y-q3 нашёл 5 раз `button.absolute.top-1/2` без `aria-label` (notify, platform ×4) — это стрелки `src/ui/Tabs.tsx` (стр. ~131):
  `aria-hidden` + `tabIndex={-1}` на `<button>`. Фокусируемый элемент с `aria-hidden` — анти-паттерн, и замер его ловит. Как
  исправить: `<span role="presentation">` / `<div>` с `onClick` вместо `<button>` (клавиатура и так листает вкладки стрелками) либо
  `aria-label={t('tabs.scrollNext'|'scrollPrev')}` без `aria-hidden`. У `SearchInput` подпись «Очистить» уже есть.

## Из секундомера k4 (25.09, переслал главный)
- [major] Общий поиск в шапке кабинета не работает: нет подсказок, Enter ничего не делает. Цель — найти клиента или запись за 3 нажатия.
- [major] В меню мастера нет пункта «Мой календарь» — нужен первым пунктом; сейчас 4 нажатия вместо 1.
- [major] Нижнее меню клиента перекрывает липкие кнопки («Продолжить» на шагах записи) — поднять липкие кнопки над меню.
- [minor] Сетка журнала не показывает текущий час при открытии.
