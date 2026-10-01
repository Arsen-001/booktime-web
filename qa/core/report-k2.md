# Хранитель общего ядра — заход k2 (25.09.2026)

**Итог: сделано 28 просьб (6 из них частично), отклонено 19; всего 47.** Разобраны все ещё не отмеченные просьбы в
`qa/requests/{client,clients,journal,notify,online,platform,schedule,core-empty-demo,e2e-q1,arch-a1}.md`, а также пункты
`ux-*.md`, которые хранитель дизайна переслал ядру (`useFormat`, `src/config/nav*`, `src/extensions`, `request.ts`, сид).
`build-*.md` в `qa/requests` нет (`qa/build-health/q1.md`: «Фундамент: замечаний нет»). Под каждой просьбой в её файле —
строка «**Ядро k2 (25.09):** ✅ / ❌ …».

## Сделано

Всё обратно совместимо: новые поля и параметры необязательные, ничего не переименовано и не удалено.

| # | Откуда | Что | Файл |
|---|---|---|---|
| 1 | e2e-q1 №3, clients F-04-156, notify | **Журнал событий записей.** `listBookingEvents({ businessId, kinds, since, freedOnly, … })`. Ядро пишет события при ЛЮБОЙ записи в bookings: создание, смена статуса (from → to), перенос, удаление, снятие неоплаченной. У каждого события — кто (`by`), когда и освободившееся время (`freed`). Хранится до 1000 последних. Подписчиков нет: читатель берёт события сам и ничего не пропустит, даже если модуль раздела не загружен. Проверено прогоном: запись клиента дала `created`, отмена админом — `status` с `freed` | `src/domain/core.ts` (`BookingEvent`, `CoreData.bookingEvents?`), `src/api/core.ts` |
| 2 | e2e-q1 №9 | `slugify()` переводит ru и hy в латиницу. `uniqueBusinessSlug(name)` / `coreTx.uniqueBusinessSlug` дописывают `-2`, `-3`, если адрес занят. `getBusinessBySlug` делает `decodeURIComponent` и находит старые кириллические адреса | `src/lib/text.ts`, `src/api/core.ts` |
| 3 | client b03 | `AppUser.photoUrl?` | `src/domain/core.ts` |
| 4 | online b03 F-03-017 | `Staff.specialty?: LocalizedText` | `src/domain/core.ts` |
| 5 | client b03 F-14-061 | `useFormat({ hourCycle: '12' })`: `time()` и `dateTime()` показывают «2:30 PM». Заодно «сегодня/завтра/вчера» в `relativeDay` теперь считаются по Еревану | `src/i18n/useFormat.ts` |
| 6 | ux-clients №4 | `fmt.ago(d)`: «3 дня назад», «2 недели назад», «Больше года назад» (ICU, ru/en/hy) | `useFormat.ts`, `messages/*/common.json` |
| 7 | ux-client №5 | Стиль даты `monthYearGenitive`: «сентября 2025» | `useFormat.ts` |
| 8 | online b03 F-03-021 | `useSphereTerms(sphereId)` — слова сферы конкретного бизнеса с падежами (`masterLower/Gen/Dat`, ru/en/hy) | `src/i18n/useSphereTerms.ts`, `common.terms.*` |
| 9 | e2e-q1 №7 | `common.bookingStatusTerms.<набор>` («Отменил врач», «Пациент подтвердил»…) и `bookingStatusLabelKey(status, sphereId)`. Подключить в бейдже — у хранителя дизайна (`ux-core.md` №6) | `useSphereTerms.ts`, `common.json` |
| 10 | notify b01 | Права `notify.mailings`, `notify.log` | `src/config/permissions.ts` |
| 11 | ux-clients №9, ux-journal №6, ux-online №5б | **Вклады-заглушки больше не видны людям.** Сервер в layout кабинета и приложения клиента находит файлы вкладов с `<ExtensionStub>` и передаёт их список в `ExtensionStubsProvider`, а `useExtensions` такие вклады не возвращает. На `/dev/ext/*` заглушки видны, как раньше. Проверено снимком карточки клиента | `src/extensions/{stubs.server.ts,ExtensionStubsProvider.tsx,useExtensions.ts}`, `src/app/biz/layout.tsx`, `src/app/(client)/layout.tsx` |
| 12 | ux-clients №9 | Вкладка журнала в карточке клиента переименована в «Записи», чтобы не повторять «Историю визитов» | `common.ext.clientCard.journal` |
| 13 | ux-platform U-6 | В меню платформы «Бизнесы» и «План запуска» стали пунктами верхнего уровня. Подпункты-дубли пунктов верхнего уровня скрываются; «Обзор → Обзор» исчез (проверено снимком) | `src/config/nav.ts`, `common.nav.*` |
| 14 | ux-clients №1, ux-online R2-2 | `soon?` (Badge «скоро») и `NavChild.useCount?` (хук-счётчик у пункта меню) | `src/config/nav-types.ts` |
| 15 | ux-platform U-8 | Пока база не поднята, `useApiQuery` отвечает `isLoading: true` и при `enabled: false`. Кадра «пусто / 0» больше нет, в серверном HTML — скелетон | `src/api/request.ts` |
| 16 | online (срез schedule без поднятой version) | `bootDb` досыпает в сохранённые данные недостающие коллекции ядра (сразу) и поля срезов из свежего `seed()` (в простое, так как пересев стоит ~70 мс). Проверено: удалил `schedule.prepaymentWaitMin` из localStorage — после перезагрузки поле вернулось | `src/mock/db.ts` |
| 17 | arch-a1 S1 | `coreKeys` и хуки `useCoreList` / `useCoreGet` — один ключ кэша для сущностей ядра | `src/api/core.ts` |
| 18–22 | передано в сид (`seed-pending.md` §3–§7) | Пустые бизнесы, сотрудники для schedule (уволенный, на двух филиалах, скрытый), живые даты и номера, фото, по примеру новых полей k2, домашний бизнес Ани | `qa/requests/seed-pending.md` |
| 23–28 | отметки о сделанном ядром раньше и частичные | e2e-q1 №2 и №4 (core-rules). Частично: e2e №5 (правило есть, нужен сид), e2e №6 (правило есть, связь `refId` — у разделов), notify (права и события есть, колокольчик — у дизайна), ux-online №5 (заглушки скрыты, «вклад вернул null» ядро заранее не знает) | — |

Для разделов дописано в `CONVENTIONS.md`: §6 «Ядро k2», §8 (форматы), §9 (заглушки, меню), §18 п.11 (`useCoreList`).

## Отклонено — почему

- **Не мои файлы.**
  - `src/demo/**`:
    - e2e-q1 №1 — кто вошёл в приложение;
    - пустые демо-персоны.
    - Готовые правки записаны в новый файл `qa/requests/demo-pending.md`.
  - `src/ui` и `src/shell` (хранитель дизайна), в `ux-core.md` добавлены №6–8:
    - Tabs;
    - тост поверх Sheet;
    - `ImageUpload` — уже сделано дизайном.
  - `scripts/measure.mjs` — шаг copyText.
- **Работа разделов, а не ядра:**
  - loyalty — каталог абонементов;
  - finance — разноска оплат;
  - reports — сообщения, отмены;
  - телефония;
  - settings — калькулятор подписки;
  - client — F-00-161;
  - online — «Любой специалист» (просьба schedule).
  - Ещё два пункта — просто пометки раздела без просьбы: reuse у platform, обход в Tabs у clients.
- **Решение по умолчанию, вопрос владельцу** (`qa/questions/core.md`): номера только +374. Выбор кода страны в `PhoneInput` (ux-core №4) не делаю.
- **journal b03, цена по мастеру (F-01-112):** поле в `Service` без правила в `rules/pricing` стало бы вторым источником цены. Просьбы от services нет.
- **journal «hy проваливается в ru»:** это не баг, hy выключен.

## Проверка

- `npx tsc --noEmit` — 0 ошибок во всём проекте.
- `npx eslint` по всем изменённым файлам ядра — чисто.
- `node src/domain/rules/tests/run.mjs` — 0 падений.
- `arch-check` — новых замечаний по моим файлам нет.
- `measure.mjs` — 62 страницы, везде 0 ошибок консоли, 0 ответов 4xx/5xx, 0 сырых ключей, 0 «висящих» загрузок:
  - экраны `/`, `/search`, `/bookings`, `/profile`, `/b/nuri-nail-studio`, `/biz/journal`, `/biz/clients`, `/biz/clients/cl_001`, `/biz/settings`, `/biz/online`, `/biz/staff`, `/biz/services`, `/platform`, `/platform/businesses`, `/platform/moderation`;
  - персоны client, owner, admin, network, platform;
  - языки ru и en, телефон и десктоп.
  - Снимки лежат в `qa/shots/core-k2/`.
- e2e `--only C01,C02,C05` (результат — в scratch, `qa/e2e/results-q1.json` не тронут): ✅ 18 · ❌ 6 · ⏳ 4 · ⛔ 4. Все ❌ — у разделов или в демо-контексте:
  - C01.S6 — client не перешёл на `placeBooking`;
  - C02.S4 — `src/demo`;
  - C05.S0 — online пишет срок отмены в свой срез;
  - C01.S10 — окно записи не показывает источник;
  - C01.S14 — вкладки «Оплата» нет: вклад finance — заглушка, раньше вместо неё была пустая рамка «Здесь будет вклад».

## Замечания разделам

В файлах `qa/measure/<id>/core-k2.md`:

- **platform:**
  - адрес салона через `coreTx.uniqueBusinessSlug` (major);
  - убрать дубли из своего `nav.ts`.
- **client:**
  - `useFormat({ hourCycle })`;
  - `AppUser.photoUrl`;
  - `placeBooking`.
- **online:**
  - `Staff.specialty`;
  - `useSphereTerms`;
  - срок отмены — в ядро.
- **notify:**
  - события записей;
  - новые права;
  - `countUnread` для колокольчика.
- **resources:** лист ожидания читает `freed` (major).
- **journal, clients, schedule, staff:** мелкие переходы на новые возможности ядра.

## Что нарушил

Один раз по ошибке вызвал `git status` (в одной строке с `npx tsc`). Он ничего не вывел, файлы не менялись.
