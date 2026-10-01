# Тексты раздела clients — проход 2 (text-q2)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила и глоссарий — `docs/TEXT-STYLE.md` (редакция 2).
Прочитано: `messages/{ru,en}/clients.json` целиком (379 ключей); экраны (десктоп, owner, nails, ru/en): `/biz/clients`,
`/biz/clients/summary`, `/biz/clients/categories`, `/biz/clients/cl_001`. Ждёт раздела: `/biz/clients/import` (заглушка «Скоро»).

**Статус q1 (`text-q1.md`, 18 замечаний):** исправлено 1 — №1 «Altegio.me» в фильтре убран. Остальные 17 в силе
(№2 абонемент = subscription, №3 «пачка», №4 лиды/сегменты — повторены ниже как major).

Итого q2: **major 7 · minor 17**.

---

## major

### 1. Номер функции ТЗ на экране — «F-04-038»
- `/biz/clients/summary`, блок «Отправленные сообщения»: «Массовые SMS и PUSH за выбранный период — F-04-038»
  (`summary.messagesHint`).
- Исправить: ru «Сообщения, которые вы отправили клиентам за этот период» · en «Messages you sent to clients in this period».

### 2. «Следующей пачкой» — слово разработчика (q1 №3, расширилось)
- `panel.fullCardHint`, `card.comingSoon.historyTitle / statsTitle / filesTitle` «…появится в следующей пачке»,
  `card.comingSoon.text` «Раздел уже спроектирован — экран подключат в одной из ближайших пачек»,
  `chatLeads.toggleHint` «Пока в проекте нет живого чата…».
- Исправить: вкладки «История визитов», «Статистика», «Файлы» уже работают — ключи `card.comingSoon.*` и
  `panel.fullCardHint` удалить. `chatLeads.toggleHint` → «Когда кто-то впервые напишет вам в чат, он сам появится
  в базе. Кнопка ниже показывает, как это будет» / en «When someone messages you for the first time, they’ll be
  added to your clients. The button below shows how it works».
✅ исправлено (fix-clients): ключи `card.comingSoon.*`, `panel.fullCardHint`, `chatLeads.*` удалены

### 3. КАПС и английский в русском интерфейсе — «CHAT ON WHATSAPP», «PUSH»
- `card.chatOnWhatsapp` «CHAT ON WHATSAPP» (ru и en); `bulk.actions.push` «Отправить PUSH-уведомление»,
  `bulk.message.title.push` «PUSH-уведомление», `bulk.message.channel.push` «PUSH», `summary.messagesHint` «SMS и PUSH».
- Исправить: «Написать в WhatsApp» / «Message on WhatsApp»; «Отправить пуш» / «Send a push»; «Пуш» / «Push»
  (TEXT-STYLE §3 «Каналы сообщений»).
✅ исправлено (fix-clients): «Отправить пуш», «Пуш-уведомление», «Пуш»; «CHAT ON WHATSAPP» удалён

### 4. Переменная программиста в тексте рассылки — «%CLIENT_NAME%»
- `bulk.message.variableHint` «Доступна переменная %CLIENT_NAME% — подставит имя каждого клиента». В разделе
  «Уведомления» то же самое сказано по-другому («Обращение по имени добавится автоматически»).
- Исправить: чип-кнопка «+ Имя клиента» над полем, вставляет «{Имя}»; подсказка «Вместо {Имя} подставим имя
  каждого клиента» / en «We’ll replace {Name} with each client’s name». Договоритесь с notify об одном виде.
✅ исправлено (fix-clients): кнопка «Вставить имя клиента» вставляет «[Имя]», подсказка «Вместо [Имя] подставим имя каждого клиента»

### 5. Галочка ответственности — канцелярит и род
- `bulk.message.consent` «Я ознакомился и осознаю ответственность за нарушение действующего законодательства».
- Исправить: «Пишу только тем, кто согласен получать сообщения» / en «I only message clients who agreed to hear from
  me» (одинаково с notify).
✅ исправлено (fix-clients): «Пишу только тем, кто согласен получать сообщения» / «I only message clients who agreed to hear from me»

### 6. Абонемент по-английски — «subscription» (q1 №2, не исправлено)
- `filters.subscription` en «Subscriptions», `segments.subscriptionEnding` en «Subscription ending».
- Исправить: «Memberships», «Membership ending».
✅ исправлено (fix-clients): см. text-q1 №2

### 7. Жаргон CRM и ярлыки для людей — «Сегменты:», «Лиды из чата», «Неявщики», «Должник»
- Главный экран: «Сегменты: Новый · Повторные · Потерянные · Заканчивается абонемент · Неявщики · Лиды из чата
  (настройка)»; карточка клиента: красный ярлык «Должник».
- Исправить: «Сегменты:» → «Быстрые подборки» (без двоеточия); «Новый» → «Новые»; «Потерянные» → «Давно не были»;
  `noShowList` «Неявщики» → «Часто не приходят» / «Often no-show»; «Лиды из чата» → «Написали в чат» / «From chat»;
  `chatLeads.summary` → «Новые из чата: настройка»; `chatLeads.added` → «Добавили в базу: написал в чат»;
  `card.debtor`, `bookingWindow.debtor` «Должник» → «Есть долг» / «Has a balance due» (q1 №4).
✅ исправлено (fix-clients): «Быстрые подборки», «Новые», «Давно не были», «Часто не приходят», «Из чата», «Есть долг»

---

## minor

8. Даты в таблице цифрами «11.09.2026» (q1 №10) → `useFormat()`: «11 сент», «вчера». `DD.MM.YYYY` — только в выгрузке.
   ✅ исправлено (fix-clients): см. text-q1 №10
9. `title`, `nav.base` «Клиентская база» → «Клиенты»; `excel.title` «Операции с Excel» → «Импорт и выгрузка»;
   `summary.title`, `nav.summary` «Сводка CRM» → «Сводка по клиентам» / «Client summary».
   ✅ исправлено (fix-clients): «Клиенты», «Импорт и выгрузка», «Сводка по клиентам»
10. Поиск и пусто (q1 №7, №11): `searchPlaceholder` → «Имя, телефон, email или номер карты»; `empty.searchTitle`
    → «Никого не нашли»; `empty.searchText` → «Проверьте написание или добавьте нового клиента».
   ✅ исправлено (fix-clients): см. text-q1 №7, №11
11. Свои названия статусов в фильтре (q1 №14): `filters.statusValues.*` «Ожидание клиента», «Клиент пришел» (без ё),
    en «No show», «Cancelled by staff» → брать `common.bookingStatus.*`.
   ✅ исправлено (fix-clients): см. text-q1 №14
12. «Баланс счета» (без ё) в таблице, фильтре и карточке → «Баланс»; «Продано» у клиента → «Сумма визитов» /
    «Total spent» (q1 №8–9).
   ✅ исправлено (fix-clients): «Баланс»; en «Total spent» для «Продано»
13. Карточка клиента: «Оплачено, ֏» + значение «0 ֏» — знак ֏ дважды → подпись «Оплачено»; «Написать:» с двоеточием
    и иконками без подписей → «Написать» + кнопки «WhatsApp», «Telegram», «SMS» с подписью; `card.waMessageFallback`
    en «your master» → «your specialist».
   ✅ исправлено (fix-clients): «Оплачено» без знака в подписи, связь — подписанные кнопки, en «your specialist»
14. `form.genderFemale / genderMale / genderUnset` «Женский / Мужской / Не выбран», а в `common.gender` — «Женщина /
    Мужчина / Не указан» → брать `common.gender.*`.
   ✅ исправлено (fix-clients): пол — `common.gender.*`, свои ключи удалены
15. `filters.mobileApp` «Установил наше приложение» (род, «наше» для салона — его собственное) → «Есть приложение Azat»
    / «Has the Azat app»; `filters.broadcast` «Получал рассылку» → «Рассылка уже была» / «Got a broadcast before».
   ✅ исправлено (fix-clients): «Есть приложение Azat», «Рассылка уже была»
16. `bulk.delete.warning` «Действие необратимо: клиенты пропадут из базы…» → «Вернуть их будет нельзя. Записи и
    платежи останутся»; `bulk.category.audience` «Будет добавлено {n} клиенту» → «Категория появится у {count, plural,
    one {# клиента} other {# клиентов}}».
   ✅ исправлено (fix-clients): «Вернуть их будет нельзя. Записи и платежи останутся.», «Категория появится у N клиентов»
17. `card.history.groupEvent` «Групповое событие» → «Групповое занятие» / «Group class» (глоссарий).
   ✅ исправлено (fix-clients): «Групповое занятие» / «Group class»
18. `card.calls.recording` «Запись» (слово занято: booking) → «Аудиозапись» / «Recording»; `card.calls.emptyText`
    «…после подключения облачной телефонии» → «Звонки появятся здесь, когда вы подключите телефонию в „Интеграциях“».
   ✅ исправлено (fix-clients): «Аудиозапись», пустое — про «Интеграции»
19. `card.files.badExt` «Недопустимый формат файла» → «Такой файл не подойдёт — нужен JPG, PNG, PDF, DOC, XLS или TXT»;
    `card.files.hint` — форматы заглавными: «JPG, PNG, GIF, DOC, PDF, XLS, TXT — до {mb} МБ».
   ✅ исправлено (fix-clients): оба текста заменены
20. `bookingWindow.more.hint` «Отмеченные звездой становятся плитками…» — «звезда» у нас = звёздочка клиента →
    «Закреплённые разделы видны сразу» (иконка — булавка); `bookingWindow.more.invoices` en «Client invoices» →
    «Client balance» (счёт клиента = баланс, глоссарий).
   ✅ исправлено (fix-clients): «Закреплённые разделы видны сразу», значок — булавка; en «Client balance»
21. `bookingWindow.noShows` «Не пришёл» как подпись счётчика → «Неявок».
   ✅ исправлено (fix-clients): «Неявок»; в окне записи — бейдж «Не пришёл N раз»
22. en: `card.stats.topServices / topStaff` «Favourite…» → «Favorite services» / «Favorite specialists» (американское
    написание); `history.addVisitSheet.staff` en «Staff» → «Specialist»; `card.confirmDelete.description` en
    «Journal bookings stay» → «Bookings in the calendar stay».
   ✅ исправлено (fix-clients): «Favorite services / specialists», «Specialist», «Bookings in the calendar stay»
23. `addClientForm.form.importance` «Класс важности» / `importance.none` «Без класса» → «Важность» / «Без уровня»;
    `addClientForm.form.customFields` «Дополнительные параметры» → «Свои поля»; `addClientForm.form.soldHint`
    «…из записей «Клиент пришёл»» → «…из визитов со статусом «Пришёл»».
   ✅ исправлено (fix-clients): «Уровень» / «Без уровня», «Свои поля», «по визитам «Пришёл»»
24. Демо-данные категорий (`/biz/clients/categories`): «постоянный» и «Постоянный» — дубль; названия со строчной
    («аллергия», «новый», «пенсионер») → в сиде одно написание, с заглавной.
   ⏳ позже — «постоянный»/«аллергия» со строчной приходят из сида ядра (src/mock/seed/clients.ts), не путь раздела
