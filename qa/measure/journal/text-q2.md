# Тексты раздела journal — проход 2 (text-q2)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила и глоссарий — `docs/TEXT-STYLE.md` (редакция 2).
Прочитано: `messages/{ru,en}/journal.json` целиком (242 ключа); экраны (десктоп, owner, nails, ru/en): `/biz/journal`,
`/biz/records`. Ждёт раздела: оплата в окне записи (finance), товары и склад в окне записи (stock).

**Статус q1 (`text-q1.md`, 15 замечаний):** исправлено 0 — все в силе. Первые по важности: №1 свои названия
статусов, №2 «Разметка: Не выбрано», №3 en «Journal», №4 «new» в русском интерфейсе.

Итого q2: **major 4 · minor 15**.

---

## major

### 1. Свои названия статусов записи (q1 №1, не исправлено)
- `toolbar.statusOptions.*` «Ожидание клиента», «Клиент пришел», «Клиент не пришел»; в `/biz/records` в колонке
  статусов уже слова из `common` («Записан», «Клиент подтвердил») — на двух экранах раздела разные слова.
- Исправить: `toolbar.statusOptions` удалить, брать `common.bookingStatus.*`.
✅ исправлено (g2-2)

### 2. «Раздел «Склад» ещё не подключён, показан демо-каталог» — внутренняя кухня в окне записи
- `window.center.goodsEmpty`.
- Исправить: ru «Товаров пока нет — добавьте их в разделе «Склад»» · en «No products yet — add them in Inventory».
  Если товары есть только демо — не говорить об этом.
✅ исправлено (g2-2)

### 3. Абонемент по-английски «Subscription»
- `window.goodsLine.kindSubscription` en «Subscription», `window.goodsLine.codePlaceholder` en «Subscription /
  certificate code». Subscription у нас — тариф бизнеса.
- Исправить: «Membership», «Membership or gift card code»; ru `codePlaceholder` «Код абонемента / сертификата» →
  «Код абонемента или сертификата».
✅ исправлено (g2-2)

### 4. Удаление называется отменой
- Заголовок подтверждения `window.deleteConfirmTitle` «Удалить запись?», а тост после — `window.deleteToast`
  «Запись отменена» (en «Booking cancelled»). Удалить и отменить у нас — разные действия (отменённая остаётся в
  «Записях» со статусом, удалённая — с отметкой «Удалена»).
- Исправить: тост «Запись удалена» / «Booking deleted» + «Вернуть» (`window.deleteUndo` «Отменить» → «Вернуть» /
  «Undo» — слово «Отменить» рядом с «отменена» путает).
✅ исправлено (g2-2)

---

## minor

5. `/biz/records`: даты цифрами «24.10.2026, 19:00» → `useFormat()`: «сб, 24 окт, 19:00», «завтра, 11:00».
6. `records.title` en «Records» при пункте меню «Bookings» → «Bookings»; `records.subtitle` «Список визитов,
   включая отменённые — с автором и временем удаления» → «Все записи, и отменённые тоже: кто и когда удалил» /
   «All bookings, cancelled ones too: who deleted them and when»; `records.emptyText` «…все визиты бизнеса…» →
   «Здесь появятся все записи, и отменённые тоже».
7. «Специалист» в колонке `records.columns.staff` и `window.staff`, а рядом «мастер» (q1 №10) → `useTerms().master`.
8. `records.deletedBadge` «Удалена», `records.deletedByClient` «Удалено клиентом» — разный род у одной записи →
   «Удалена» / «Удалил клиент».
9. Оплата в правой колонке: `window.right.paymentStatus.*` «Посещение не оплачено / оплачено не полностью /
   оплачено полностью» → «Не оплачено» / «Оплачено частично» / «Оплачено» (en «Not paid» / «Partly paid» / «Paid»).
   `window.serviceLine.total` «Итог» при `hoverCard.total` «Итого» → «Итого» везде.
10. Клиент без привязки: `window.noClientConfirmText` «Визит будет сохранён без привязки к клиенту.» и
    `window.right.incompleteText` «Сохранить запись без привязки к клиенту?» → «Запись сохранится без клиента —
    добавить его можно позже»; `window.right.incompleteTitle` «Данные клиента введены не полностью» → «Не хватает
    имени или телефона»; `window.right.newClientNote` en «…added to the database…» → «…added to your clients…».
11. Ошибки полей: `window.phoneError` «Проверьте номер телефона» → «Введите 8 цифр после +374»; `window.durationError`
    «Длительность от 5 минут до 23 ч 55 мин» → «Длительность — от 5 мин до 23 ч 55 мин».
12. `window.staffPriceWarningText` (2 строки канцелярита) → «Цену мы не пересчитали — проверьте её в услугах
    записи» / «We didn’t recalculate the price — check it in the booking’s services».
13. Повторы записи: `window.repeat.createdToast` «…в фоновом режиме» → «{count, plural, one {Создана # запись} few
    {Созданы # записи} many {Создано # записей} other {Создано # записи}}» (en сейчас «will be created in the
    background» — смысл другой); `window.repeat.partOfSeries` «Часть серии из {count} записей» → plural;
    `window.repeat.endCount` «Макс. повторов» → «Сколько раз повторить»; `window.repeat.everyDays / everyWeeks`
    «Каждые N дней» → «Каждые … дней» (буква N на экране непонятна).
14. Выбор «Запись или занятие»: `mixedType.description` «В журнале включена смешанная запись — выберите тип.» →
    удалить (заголовок «Что создать?» уже говорит всё); `mixedType.event` «Событие» → «Групповое занятие» / «Group
    class»; `mixedType.eventHint` «Групповое занятие или сеанс» → «Несколько клиентов в одно время».
15. `bookingCategories.staffImportant / staffNotImportant` «Специалист важен / не важен» → «Клиент выбрал мастера» /
    «Любой мастер» (en «Client chose the specialist» / «Any specialist»).
16. Кнопки-действия — существительными: `sidebar.sellProduct` «Продажа товара» → «Продать товар»; `sidebar.newPayment`
    «Новый платёж» → «Принять оплату»; `window.left.expandedTile` «Расширенные поля» → «Ещё поля».
17. `window.goodsLine.codeGenerate` «Сгенерировать код» → «Придумать код» / «Generate code»; `window.serviceLine.qty`
    «Кол-во» → «Кол.» (только в заголовке колонки).
18. en «staff member» вместо specialist в окне записи: `window.overlapError`, `window.outsideHours*`,
    `window.center.frequentTitle` «Staff member's frequent services» → «Often booked with this specialist»;
    `window.center.allServicesEmpty` → «This specialist has no services yet».
19. `window.save.createEmpty` «Сохранить пустую запись» → «Записать без клиента» / «Book without a client».
✅ исправлено (g2-2)
