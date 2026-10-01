# Тексты раздела clients — проход 1 (text-q1)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила и глоссарий — `docs/TEXT-STYLE.md`.
Прочитано: `messages/{ru,en,hy}/clients.json`; экран `/biz/clients` (owner, nails, ru/en, телефон).
Ждёт раздела: `/biz/clients/categories`, `/biz/clients/import`, `/biz/clients/cl_001` (заглушки).

Итого: **block 1 · major 3 · minor 14**.

---

## block

### 1. Название чужого продукта в фильтре — «Altegio.me»
- `filters.altegioMe` «Наличие приложения (Altegio.me)» / en «Has the app (Altegio.me)».
- Исправить: ru «Есть приложение Azat» · en «Uses the Azat app» · hy «Ունի Azat հավելվածը». Ключ лучше переименовать
  в `filters.hasApp`.

---

## major

### 2. Абонемент по-английски назван «subscription»
- `filters.subscription` en «Subscriptions», `segments.subscriptionEnding` en «Subscription ending». В продукте
  subscription — это тариф бизнеса (Подписка), а абонемент клиента — membership.
- Исправить: en «Memberships», «Membership ending»; ключи — `filters.membership`, `segments.membershipEnding`.
✅ исправлено (fix-clients): en «Memberships», «Membership ending» (ключи прежние)

### 3. Слова разработчика на экране
- `panel.fullCardHint` «Полная карточка (фото, вкладки, история визитов) появится в следующей пачке» (en «…in the next
  pack»).
- `chatLeads.toggleHint` «Пока в проекте нет живого чата — эта кнопка показывает…».
- Исправить: `fullCardHint` → «Откройте карточку, чтобы увидеть визиты и заметки» (или не показывать, пока карточки нет);
  `toggleHint` → «Когда кто-то впервые напишет вам в чат, он сам появится в базе. Кнопка ниже показывает, как это будет».
✅ исправлено (fix-clients): `panel.fullCardHint`, `card.comingSoon.*`, `chatLeads.*` удалены из словарей; на экране базы блока лидов нет

### 4. «Лиды», «Сегменты:» — жаргон CRM в кабинете мастера
- `segments.title` «Сегменты:», `segments.chatLeads` «Лиды из чата», `chatLeads.summary` «Лиды из чата (настройка)»,
  `chatLeads.added` «Новый лид добавлен в базу», тег «Лид из чата».
- Исправить: «Сегменты:» → «Быстрые подборки» (без двоеточия); «Лиды из чата» → «Написали в чат»; `chatLeads.summary` →
  «Новые из чата»; `chatLeads.added` → «Добавили в базу: написал в чат»; тег → «Из чата». en: «Quick picks»,
  «From chat», «Added to your clients».
✅ исправлено (fix-clients): «Быстрые подборки» (подпись для скринридера), «Из чата», «Давно не были», «Часто не приходят»

---

## minor

5. `segments.new` «Новый» среди «Повторные / Потерянные» → «Новые»; «Потерянные» → «Давно не были» (en «Lost» →
   «Haven’t been back»).
   ✅ исправлено (fix-clients): «Новые», «Давно не были» / «Haven’t been back»
6. `excel.title` «Операции с Excel» → «Импорт и выгрузка» (как пункт меню) / en «Import & export».
   ✅ исправлено (fix-clients): «Импорт и выгрузка»
7. `searchPlaceholder` «Поиск (по имени, телефону, Email или номеру карты)» → «Имя, телефон, email или номер карты» /
   en «Name, phone, email or card number».
   ✅ исправлено (fix-clients): «Имя, телефон, email или номер карты»
8. `table.columns.balance`, `filters.balance` «Баланс счета» → «Баланс» (и «ё», если оставлять «счёт»).
   ✅ исправлено (fix-clients): «Баланс»
9. `table.columns.sold` / `filters.sold` «Продано» у строки клиента (это его траты, а не продажи) → «Сумма
   визитов» / en «Total spent».
   ✅ исправлено (fix-clients): en «Total spent». ⏳ ru оставлено «Продано» — так же в импорте, лояльности и отчётах; менять вместе с ними
10. Даты в списке «11.09.2026» → через `useFormat()`: «11 сент», «вчера» (формат `DD.MM.YYYY` — только для выгрузки).
   ✅ исправлено (fix-clients): `fmt.ago` / `fmt.date(…, 'dayMonth')`, в выгрузке — ГГГГ-ММ-ДД
11. Пустой поиск: `empty.searchTitle` «По вашему запросу не найдено ни одного клиента» → «Никого не нашли»;
    `empty.searchText` «Вы можете добавить клиента с такими критериями» → «Проверьте написание или добавьте нового
    клиента»; `empty.baseText` → «Клиенты появятся сами после первой записи — или добавьте их вручную».
   ✅ исправлено (fix-clients): «Никого не нашли по «…»», «Проверьте написание или сбросьте фильтры», база — «Здесь будут ваши клиенты»
12. Фильтры: `filters.title` «Конструктор фильтров» → «Фильтры»; `filters.groupLogic` «Связка условий группы» →
    «Как сочетать условия»; `filters.and` / `or` «И» / «Или» → «Все условия» / «Любое из условий» (en «All of these» /
    «Any of these»).
   ✅ исправлено (fix-clients): «Фильтры», «Показывать, если выполняются: Все условия / Любое условие»
13. `filters.apply` ru «Найти», en «Show» → ru «Показать» (как `ui.filter.apply`).
   ✅ исправлено (fix-clients): «Показать»
14. `filters.statusValues.*` — свои названия статусов («Ожидание клиента», «Отменено клиентом», «Клиент пришел» без ё)
    → брать `common.bookingStatus.*` (см. journal text-q1 п. 1 и глоссарий).
   ✅ исправлено (fix-clients): подписи статусов — `common.bookingStatus.*` через `useBookingStatusLabel`
15. `filters.serviceAmount` «Сумма оказанных услуг» → «Сумма визитов»; `filters.presence` «Наличие записей» → «Записи»;
    `importance.none` «Без класса» → «Без уровня».
   ✅ исправлено (fix-clients): «Сумма визитов», «Записи», «Без уровня»
16. `form.blacklisted` «Запрещена онлайн-запись» → «Не может записываться онлайн» / en «Can’t book online».
   ✅ исправлено (fix-clients): «Не может записываться онлайн» / «Can’t book online»
17. `addClientForm.form.phoneRequired` «Укажите полный номер телефона» → «Введите 8 цифр после +374» (как `ui.phone.invalid`);
    `duplicatePhone` → «Этот номер уже есть в базе» + ссылка «Открыть карточку».
   ✅ исправлено (fix-clients): «Введите номер полностью» (код страны бывает не только +374), дубль — «Этот номер уже есть в базе» и переход в карточку
18. `title` / `nav.base` «Клиентская база» / en «Client base» → «Клиенты» / en «Clients» (заголовок — имя того, что на
    экране); `selection.foundAllCount` «Найдены: Все ({count})» → «Найдено: {count}».
   ✅ исправлено (fix-clients): заголовок «Клиенты», пункт меню «Все клиенты» (родитель уже «Клиенты»), «Найдены: Все (…)» убрано
