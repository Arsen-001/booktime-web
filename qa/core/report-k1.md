Сделано 13, отклонено 23 (всего 36). Файл `qa/core/report-k1.md` не создан: система запретила субагенту писать файлы-отчёты. Его текст — ниже.

# Хранитель общего ядра — заход k1 (25.09.2026)

Разобраны все просьбы к общим файлам в `qa/requests/{client,journal,online,platform,schedule,clients}.md`. Файлы ux-*.md оставлены хранителю дизайна. Файлов `qa/requests/build-*.md` и `e2e-*.md` нет, а в `qa/build-health/q1.md` написано: «Фундамент: замечаний нет». Одну общую ошибку я нашёл в прогоне e2e (`qa/e2e/_dev-results.json`) и исправил. Под каждой просьбой в её файле стоит пометка «**Ядро k1 (25.09):** ✅ / ❌ …».

## Сделано

Все изменения обратно совместимы: новые поля необязательные, ничего не переименовано и не удалено.

| # | Откуда | Что | Файл |
|---|---|---|---|
| 1 | e2e C01.S8/S9, C02.S5/S7 | Запись из приложения не попадала в CRM. Теперь `createBooking` с `appUserId` без `clientId` сам находит карточку клиента бизнеса (сначала по `appUserId`, потом по номеру) или заводит новую. Добавлена функция `ensureClientForAppUser`. Эти 4 шага e2e раньше падали, теперь проходят | `src/api/core.ts` |
| 2 | client F-14-028 | `Business.socials?: SocialLinks` | `src/domain/core.ts` |
| 3 | client b02 | `Staff.prepayment?`, `Business.bookingRules?`, `Service.shadeChoice?` | `src/domain/core.ts` |
| 4 | journal F-01-028 | `Booking.staffAssignment?: 'specific' \| 'any'` | `src/domain/core.ts` |
| 5 | journal F-01-035 | `listGroupEvents` / `createGroupEvent` / `updateGroupEvent`, `listBookings({ groupEventId })`, `Location.journalKind?` | `src/api/core.ts`, `src/domain/core.ts` |
| 6 | journal F-01-019 | `Staff.hiddenInJournal?` | `src/domain/core.ts` |
| 7 | journal F-01-021 | `Staff.journalMarkupMin?` | `src/domain/core.ts` |
| 8 | journal F-01-024/031 | Права `journal.create` и `journal.reschedule` | `src/config/permissions.ts` |
| 9 | journal F-01-014 и text-q1 | `common.bookingStatus` приведён к глоссарию TEXT-STYLE §6: ru «Записан», «Отменил клиент», «Отменил мастер»; en «Booked», «Cancelled by specialist»; hy «Գրանցված է» | `messages/{ru,en,hy}/common.json` |
| 10 | text-q1 п.3 | en/hy «Journal / Մատյան» заменено на «Calendar / Օրացույց» по глоссарию | `messages/{en,hy}/common.json` |
| 11 | online F-03-134 | `Staff.onlineBookingEnabled?`: если поля нет, записаться онлайн можно | `src/domain/core.ts` |
| 12 | platform F-00-168 и др. | Правило модерации для разделов записано | `CONVENTIONS.md` §6 |
| 13 | clients F-04-074 | Право `clients.delete` (у owner, individual, network) | `src/config/permissions.ts` |

В `CONVENTIONS.md` дописаны правила для разделов:
- §6 — новые поля и функции ядра, автопривязка клиента к записи, модерация;
- §8 — статусы записи брать только из `common.bookingStatus.*`.

## Отклонено — почему

- **Не мои файлы, переслано хранителю дизайна** в `qa/requests/ux-core.md`:
  - подвал `PublicShell` со ссылкой на площадку (две просьбы online);
  - ширина ячейки `Calendar` (journal);
  - `Sheet` на телефоне пропадает со снимков (schedule);
  - выбор кода страны в `PhoneInput` (clients);
  - режим «Журнал / Администрирование» F-01-001 (journal) — это `src/shell/biz` и решение продукта.
- **Нужна правка сида**, записано в `qa/requests/seed-pending.md`: контрпример CRM-записи для F-14-009 и демо-значения всех новых полей.
- **Ядру не нужно, данные уже есть у разделов:**
  - заявки «перезвонить» — journal и clients читают их из среза client через `readArea`;
  - «звёздочка» — оценки 1–5 сняты, число звёздочек хранит client;
  - категории клиента — это каталог раздела clients, он ещё не построен;
  - кошелёк монет — принадлежит settings.
- **Работа разделов, а не ядра** (9 просьб platform, 2 — clients, 1 — client):
  - вызовы `reportSearchDemand`, `getFirstBadge`, `createSupportTicket`, `exportBusinessData`, `listBizMeta`, `setAdsOptIn`;
  - сторис и баннеры;
  - настройка «ФИО» (строит journal);
  - журнал изменений (строит staff);
  - F-00-107 — решения в ТЗ нет.
- **Реклама поставщика в кабинете:** новой точке расширения нужен экран-хозяин, а у кабинета нет главной страницы. Класть рекламу в общий каркас плохо для удобства — нужно решение продукта.

## Проверка

- **`npx tsc --noEmit`:** из ядра ошибок нет. Остались 66 ошибок в путях разделов (окно записи в journal, экраны online places и requests). Все они — «нет ключа в своём словаре»: разделы сейчас эти словари дописывают.
- **`npx eslint`** по изменённым файлам ядра — чисто.
- **`measure.mjs`**, 44 страницы, 0 ошибок консоли, 0 ответов 4xx/5xx, 0 сырых ключей:
  - экраны `/`, `/search`, `/bookings`, `/biz/journal`, `/biz/clients`, `/biz/online`, `/b/nuri-nail-studio`, `/platform`;
  - персоны client, owner, admin, platform;
  - языки ru и en, телефон и десктоп.
- **e2e `--only C01,C02`** после правки: ✅ 13 · ❌ 5 · ⏳ 6 · ⛔ 1.

## Что сломалось и что дальше

- **e2e (сломано моей правкой):** шаг C01.S11 раньше проходил, а теперь падает. Он ищет в окне записи статус «Подтверждена», а по глоссарию статус `scheduled` в кабинете теперь «Записан». Нужно заменить строку в `qa/e2e/chains/c01-free-today-to-star.mjs:172` на «Записан». В шаге S12 у клиента остаётся «Подтверждена»: словарь client я не менял.
- **clients**, замечание в `qa/measure/clients/core-k1.md` (major): новый клиент из приложения теперь заводится в CRM, но в списке его нет на первой странице из 25 строк (шаг C02.S6). Нужна сортировка «новые сверху».
- **client, online, staff, services:** перенести свои черновики из срезов на новые поля ядра (список — CONVENTIONS §6).
- **journal:**
  - фильтр статусов перевести на `common.bookingStatus.*`;
  - клик по ячейке проверять через `useCan('journal.create')`;
  - перенос записи — через `useCan('journal.reschedule')`.

Файлы, которые я изменил или создал:
- `/Users/arsen/WebstormProjects/booking-platform/src/domain/core.ts`
- `/Users/arsen/WebstormProjects/booking-platform/src/api/core.ts`
- `/Users/arsen/WebstormProjects/booking-platform/src/config/permissions.ts`
- `/Users/arsen/WebstormProjects/booking-platform/messages/{ru,en,hy}/common.json`
- `/Users/arsen/WebstormProjects/booking-platform/CONVENTIONS.md`
- `/Users/arsen/WebstormProjects/booking-platform/qa/requests/{client,journal,online,platform,schedule,clients}.md` — пометки
- `/Users/arsen/WebstormProjects/booking-platform/qa/requests/seed-pending.md` — новый
- `/Users/arsen/WebstormProjects/booking-platform/qa/requests/ux-core.md` — новый
- `/Users/arsen/WebstormProjects/booking-platform/qa/measure/clients/core-k1.md` — новый