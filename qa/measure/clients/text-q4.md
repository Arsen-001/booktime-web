# Тексты раздела clients — проход 4 (text-q4)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила — `docs/TEXT-STYLE.md`, редакция 4.
Прочитано: `messages/{ru,en}/clients.json`, 662 ключа. Целиком прочитаны группы `card.merge`, `loyaltyPage.*`,
`categoriesPage.form`, `rights.groups`, `bookingWindow.loyalty`. Видимый текст 7 экранов в ru и en.

Статус q3: исправлено 12 из 14. Раздел берёт замечания в работу, спасибо. Итого q4: **major 2 · minor 6**.

---

## major

### 1. «Программа лояльности» — так называются две разные вещи
- `/biz/clients/loyalty` (`loyaltyPage.title` «Программа лояльности») меняет скидку, класс и категорию по тратам. В
  меню кабинета есть отдельный раздел «Лояльность» с картами и акциями, его хаб тоже предлагает «настроить программу
  лояльности». Мастер не поймёт, куда идти.
- Исправить: здесь → «Скидка и категория по тратам» / «Spend-based discount & category». Подпункт меню — так же.
  Подзаголовок оставить: «Скидка, уровень и категория меняются сами — по тратам и визитам».
  ✅ исправлено (g3-1-fix1): `loyaltyPage.title` = «Скидка и категория по тратам» / «Spend-based discount & category» в `messages/{ru,en}/clients.json`.

### 2. КАПС и «subscription» при объединении дублей
- `card.merge.notTransferredWarning` «…с объединяемой карточки НЕ переносятся…» / en «The loyalty card, subscription
  and account balance… are NOT…».
- Исправить: «Карта лояльности, абонемент и счёт второй карточки не перейдут — перейдут только визиты и суммы» / «The
  second card’s loyalty card, membership and client balance won’t move over — only visits and totals will».
  ✅ исправлено (g3-1-fix1): `card.merge.notTransferredWarning` без КАПС, en использует «membership pass» вместо «subscription» (`messages/{ru,en}/clients.json`).

---

## minor

3. **«Не посещал» — с родом.** `loyaltyPage.trigger.inactiveDays`, `settings.cancelDiscountAfterDays`,
   `cancelClassAfterDays`, пример `categories.removeEmptyText` «Не посещал более 90 дней…» → «Нет визитов больше (дней)»
   / «No visits for (days)».
   ✅ исправлено (g2-2)
4. **Статус своими словами.** `loyaltyPage.trigger.statusArrived` «Статус визита „Клиент пришёл“», `statusNoShow`
   «„Клиент не пришёл“» → слова из `common.bookingStatus`: «Пришёл», «Не пришёл».
   ✅ исправлено (g2-2)
5. **«Выгрузил(а)».** `importPage.export.logLineByAuthor` «{at} — {author} выгрузил(а) {count}» → «{at} · {author}:
   выгружено {count, plural, one {# клиент} few {# клиента} many {# клиентов} other {# клиента}}» (без рода, §1).
   ✅ исправлено (g2-2), ru и en
6. **«Нет данных за период».** `card.stats.noData` → «За этот период визитов не было» / «No visits in this period».
   ✅ исправлено (g2-2)
7. **Пуш и числа в примерах.**
   - `loyaltyPage.settings.pushHint` «У нас — пуш нашего приложения, не SMS» → «Придёт пушем в приложении Azat» /
     «Sent as a push in the Azat app»;
   - `discounts.emptyText` ru «5 %» → «5%», en «100,000 ֏» → «100 000 ֏»;
   - `card.merge.open` «Объединить с...» → «Объединить с…» (один знак многоточия).
   ✅ исправлено (g2-2): все три
8. **Плейсхолдер повторяет подпись.** `categoriesPage.form.namePlaceholder` «Название категории» → «Например, VIP» /
   «E.g. VIP». Демо-категории на en-экране — «постоянный», «пенсионер», «аллергия», со строчной и по-русски
   (TEXT-STYLE §6: «Категория — с заглавной»; перевод демо-данных — Ф16).
   ✅ исправлено (g2-2): плейсхолдер. ⏳ позже — перевод демо-категорий на en-экран (Ф16, чужая зона — сид)
