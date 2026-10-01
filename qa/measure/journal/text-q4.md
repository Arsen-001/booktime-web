# Тексты раздела journal — проход 4 (text-q4)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила — `docs/TEXT-STYLE.md`, редакция 4.
Прочитано: `messages/{ru,en}/journal.json`, 687 ключей. Целиком прочитаны группы, которых не было в q1–q3:
`window.medical`, `window.package`, `window.history`, `header.daySummary`, `header.addStaff`,
`records.externalDemo`, `settings.chat`. Видимый текст `/biz/journal`, `/biz/journal/settings`, `/biz/records` в ru
и en.

**Статус q2 и q3: не исправлено ни одно из 31 замечания (19 в q2, 12 в q3).** Проверил ключи из q3 — все на месте без изменений:
- метка «new» в ru;
- «Разметка: Не выбрано»;
- «Цифровой журнал», «Настройки из справки»;
- «звёздочка» вместо булавки;
- «Технический перерыв»;
- «Удалено {count} записей» без plural;
- en «Journal».

По правилу §0.1 CONVENTIONS сборщик читает `text-*` в начале каждой пачки. Начните с трёх major из q3: они на
главном экране раздела.

Итого q4 (новое): **major 3 · minor 7**.

---

## major

### 1. Номер функции и «Симулировать» на экране «Все записи»
- `records.externalDemo.hint` «Так интеграции создают записи через наш API (F-01-036) — минимум полей…»;
  `externalDemo.title` «Симулировать запись от бота или CRM»; кнопка `button` «Запись от бота (демо)».
- Исправить: кнопка «Демо: запись от бота» / «Demo: booking from a bot»; заголовок «Запись от бота» / «Booking from
  a bot»; подсказка «Так бот или сайт создаёт запись: нужны имя, телефон, услуга и время» / «This is how a bot or
  website creates a booking: name, phone, service and time». Метка «Демо» — в начале (§3).
✅ исправлено (g2-2)

### 2. Категория «Chat lead» — английский жаргон и «лид»
- `settings.chat.autoSaveLeads.title` «Сохранять новых клиентов из чата в базу с категорией Chat lead».
- Исправить: «Сохранять тех, кто написал в чат, в базу клиентов — с категорией „Написали в чат“» / «Save people who
  message you in chat as clients, with the “From chat” category» (глоссарий: не «лиды»). То же название категории —
  в сиде clients.
- `settings.chat.connectedTitle`, `connectDemo`, `disconnectDemo` «…интеграцию (демо)» → «Демо: подключить чат» /
  «Demo: connect chat»; `disabledHint` «…после подключения интеграции чата» → «…когда подключите чат».
✅ исправлено (g2-2)

### 3. Медкарта — поля российской поликлиники
- Стоматология, `window.medical.cardFields`: «Социальный номер», «Полис медицинского страхования», «Код льготы»,
  «Документ (серия и номер)», «Адрес регистрации», «Местность (город / село)». В Армении нет «кода льготы», а номер
  называется ՀԾՀ.
- Исправить: «Номер соцкарты (ՀԾՀ)» / «Social card number»; «Код льготы» убрать; «Документ (серия и номер)» → «Паспорт
  или ID-карта» / «Passport or ID card»; «Адрес регистрации» → «Адрес» / «Address»; «Местность (город / село)» →
  «Город или село» / «City or village».
- `saveCard` «Сохранить данные» → «Сохранить медкарту» / «Save medical card».
✅ исправлено (g2-2)

---

## minor

4. **Сводка дня: склейка и непонятные строки.**
   - `header.daySummary.clientsSuffix` «клиентов» — обрывок для склейки (§3) → один ключ с plural: «{n, plural, one {#
     клиент} few {# клиента} many {# клиентов} other {# клиента}}»;
   - `rows.cashIn` «Поступлений в кассы» → «Пришло в кассы» / «Received»;
   - `rows.cashless` «Оплата безналом» → «Картой и переводом» / «Card & transfer»;
   - `rows.loyaltyTotal` «Лояльность на сумму» → «Оплачено бонусами, сертификатами, абонементами» / «Paid with points,
     gift cards, memberships»;
   - `rows.doneTotal` «Выполнено на сумму» → «Оказано услуг на» / «Services done».
5. **Статус своими словами.** `header.daySummary.hints.doneTotalHint`, `records.bulkDeleteConfirmText`,
   `bulkDeleteSkipped` пишут «Клиент пришёл». В `common.bookingStatus` статус называется «Пришёл» — берите его
   (CONVENTIONS §8).
6. **Пакет: длинно и через «требует».** `window.package.transferText` «…Перенос одной записи требует перенести и
   связанные с ней» → «Остальные услуги пакета перенесутся вместе с ней» / «The other services in the package move
   with it». `deleteTitle` «Удалить пакет или только эту услугу?» — хорошо.
7. **История записи: «Посетитель» и «Место оказания».** `window.history.fields.visitor` «Посетитель» → «Клиент» (как в
   соседней строке `client`); `workplace` «Место оказания изменено» → «Место визита изменено» / «Visit location
   changed»; en `fields.staff` «Staff» → «Specialist».
8. **«Добавить сотрудника» в журнале.** `header.addStaff.button` читается как «нанять». Окно ставит рабочее время на
   день → «Добавить рабочий день» / «Add a working day»; `title` «Добавить сотрудника в расписание» → «Рабочий день
   сотрудника» / «Staff working day».
9. **Удаление плана лечения.** `window.medical.planDeleteText` en «This cannot be undone once deleted.» → «This can’t
   be undone.»; `printHint` «Чтобы распечатать — Ctrl+P…» → «Нажмите Ctrl+P (на Mac — Cmd+P), чтобы распечатать» /
   «Press Ctrl+P (Cmd+P on Mac) to print».
10. **«Ваши выгрузки».** `records.exportModal.logTitle` → «Выгрузки» / «Exports»: список видят все, у кого есть право
    выгрузки, не только автор.
