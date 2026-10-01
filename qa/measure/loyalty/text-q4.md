# Тексты раздела loyalty — проход 4 (text-q4)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила — `docs/TEXT-STYLE.md`, редакция 4. Для этого раздела
добавлен словарь «Лояльность и деньги» в §6: бонусы, счёт клиента, заморозка, «приведи друга».
Прочитано: `messages/{ru,en}/loyalty.json` целиком, 664 ключа. Видимый текст 14 экранов в ru и en (десктоп,
owner, nails, «Nuri Nail Studio» — салон с одним адресом). `/biz/loyalty/certificates/types` при снятии уходил на
другой адрес, его тексты проверены по словарю.

Статус q2: закрыты 3 из 3 (меню). Итого q4: **major 9 · minor 16**.

---

## major

### 1. «Локация» — в 30 ключах, а для салона с одним адресом ещё и «сеть»
- Ключи `cardTypeForm.sourceScope*`, `cardTypeForm.locations*`, `cardTypeForm.noLocations`, `autoIssueOptions.anyLocation`,
  `promotionWizard.locationsLabel`, `summaryAllLocations`, `summaryLocations`, `sourceScopeOptions.activeLocations`,
  `certificateTypeForm.editLocations*`, `certificateTypeForm.locations`, `membershipTypeForm.editLocations*`, `locations`,
  `addAllLocations`, `notify.expiryHint`, `notify.chargeHint`, `accountTypeForm.locations`, `onlineSale.hint`.
  В en то же самое словом «location».
- Исправить: «локация» → «филиал», en «location» → «branch». Примеры:
  - «Действует в локациях» → «В каких филиалах действует» / «Branches»;
  - «Активные локации» → «Только выбранные филиалы» / «Selected branches only»;
  - «Выдавать в любой локации» → «Выдавать в любом филиале» / «Issue at any branch».
- Салон с одним адресом не выбирает филиалы: блок «В каких филиалах» прячем, если филиал один.
- «В вашей сети пока нет типов карт / акций / типов абонементов / типов счетов», «Все выданные карты сети»,
  «Типы сертификатов сети» и `hub.singleScope` («У бизнеса с одним адресом лояльность настраивается без понятия
  „сеть“») видит и Nuri, у которого сети нет. Исправить: «Пока нет типов карт», «Все выданные карты». `hub.singleScope`
  удалить, `hub.networkScope` показывать только владельцу сети (TEXT-STYLE §3 «Сеть или один салон»).

⏳ позже (g1-2-fix1) — не успел в бюджет пачки (30% времени уже ушло на F-06-074/097/123/124/076 из починки g1-2);
затрагивает ~16 ключей и логику показа блока «филиалы» у одноадресных салонов, нужен отдельный заход.


### 2. Кухня разработки на экране
- `cardTypes.formSoon` «Форма появится в следующей сборке раздела» · en «…will ship in the next build».
- `promotions.form.detailSoon` «Страница акции появится в следующей сборке раздела».
- `membershipTypeForm.renewalKindHint`: «…у нас пока отложено (F-00-028); настройка сохраняется как классификация типа».
- `cardTypeForm.productLimitHint`, `certificateTypeForm.applyProductsHint`: «Каталог товаров ведёт раздел „Склад“ —
  здесь только режим ограничения / только разрешение».
- Исправить:
  - два первых ключа — удалить, если форма уже есть; если нет — спрятать кнопку;
  - вариант «С автопродлением (карта, только заявленные страны)» спрятать: автосписание с карты у нас отложено
    (CONVENTIONS §15), а человеку непонятно, почему его нельзя выбрать;
  - подсказка про товары → «Товары добавляются в меню Склад → Товары» / «Add products under Inventory → Products».

### 3. Готовые тексты для клиента — массивом и с `%CARD_TITLE%`
- 9 ключей `*Templates` (`cardTypeForm.notify.issueTemplates`, `accrualTemplates`, `chargeTemplates`,
  `promotionWizard.notify.*Templates`, `membershipTypeForm.notify.*Templates`) — это массивы. Массив читается через
  `t.raw`, без подстановок и plural (TEXT-STYLE §3 «Списки»).
- В текстах метки `%CARD_TITLE%`, `%GROUP_TITLE%`, `%BONUS%` — мастер не пишет переменные (TEXT-STYLE §3 «Подстановки»).
- Тон мимо голоса Azat: «Вам назначена скидка», «Поздравляем!», «Списание %BONUS% ֏».
- Исправить: варианты — отдельными ключами (`issueText0…2`), метки — чипами «{Название карты}», «{Бонусы}»,
  «{Осталось визитов}», «{Действует до}». Примеры:
  - «Ваша карта {Название карты} готова — скидка работает с этого визита» / «Your {Card name} card is ready — the
    discount works from this visit»;
  - «+{Бонусы} за визит. На карте {Баланс}» / «+{Points} for your visit. Card balance: {Balance}»;
  - «Бонусы {Бонусы} сгорят {Дата} — приходите, чтобы потратить» / «{Points} points expire on {Date} — come in and
    use them».
  `notify.customPlaceholder` «До 255 символов» → «Например: Спасибо, что пришли! На карте {Бонусы}».

### 4. «Баллы», «бонусы» и «кэшбэк» — одно и то же тремя словами
- ru: «Сгорание неиспользованных баллов», «Ограничение оплаты баллами», «Списание просроченных баллов», «баллы и
  кэшбэк» (хаб), «Бонусов за визит», «Сжигать неиспользованные бонусы», «Фиксированные бонусы» / en «Fixed cashback».
- Исправить по глоссарию (§6 «Лояльность и деньги»): везде «бонусы» / «points». «Кэшбэк» оставить только в названии
  вида акции: «Кэшбэк — % от оплаты бонусами». `promotions.kinds.cashbackFixed` «Фиксированные бонусы» → «Кэшбэк: один
  процент» / «Cashback: flat rate».

- ✅ исправлено (g1-2-fix1, частично): `promotions.kinds.cashbackFixed` ru/en приведён к примеру из этого пункта
  («Кэшбэк: один процент» / «Cashback: flat rate»). Остальные ключи семьи (`cashbackAccumVisits/Sum`, `valueBonus`,
  `burnEnabled` и т.п.) уже используют «бонусы»/«points» — не трогал, чтобы не разойтись с полной терминологической
  сверкой глоссария §6, которая требует прохода по ВСЕМ 664 ключам сразу, а не выборочно. ⏳ позже — полная сверка.


### 5. «Депозит» вместо «счёт клиента», и меню не совпадает с en
- `hub.subtitle` «…абонементами и депозитами», `hub.tiles.deposits.title` «Депозиты на счетах клиентов», `.text`
  «Депозит — особые отношения с самыми лояльными клиентами…»; меню ru «Типы счетов / Список счетов / Операции со
  счетами» при en «Account types / Client balances / Account operations»; `transactions.types.accountCharge` «Списание
  с личного счёта».
- Исправить: плитка — «Счета клиентов» / «Client balances», текст — «Клиент вносит деньги заранее и платит с них за
  визиты» / «Clients pay in advance and spend it on visits»; меню — «Типы счетов» / «Balance types», «Счета клиентов» /
  «Client balances», «Движение по счетам» / «Balance history»; `accountCharge` → «Оплата со счёта клиента» / «Paid from
  client balance». Заголовок экрана `accounts.title` «Список счетов» → «Счета клиентов» (как пункт меню).

### 6. Две вещи названы «Программа лояльности» — здесь и в «Клиентах»
- Раздел clients держит `/biz/clients/loyalty` с заголовком «Программа лояльности» (автоскидки и категории), а здесь
  хаб «Лояльность» с кнопкой «Помогите мне настроить программу лояльности». Мастер не поймёт, где что.
- Исправить здесь: `hub.helpText` → «Оставьте заявку — поможем выбрать карты, акции и сертификаты под ваш салон» /
  «Leave a request — we’ll help you pick cards, promotions and gift cards for your salon». Название у clients меняется
  отдельно (см. `qa/measure/clients/text-q4.md` №1).

### 7. Смысл перевёрнут: «клиент может изменить баланс»
- `membershipTypeForm.editLocationsLabel` «В каких локациях клиент может изменить баланс и срок действия абонемента»
  (en «Where clients can change…») — менять остаток может сотрудник филиала, не клиент.
  `certificateTypeForm.editLocationsLabel` en «Where locations can change the balance and expiry» — непонятно.
- Исправить: «В каких филиалах можно менять остаток и срок» / «Branches where staff can change the balance and expiry».

### 8. КАПС и «рефералка»
- `promotionWizard.referralCardWarning`: «…бонусы за КАЖДЫЙ визит клиента, а не только по рефералке».
- Исправить: «Эта акция — бонус за приглашённого друга. Если привязать её к типу карты, бонусы будут начисляться за
  каждый визит» / «This promotion rewards inviting a friend. Attached to a card type, it will add points on every visit».

### 9. «Реферальная программа» при пункте меню «Приведи друга»
- Заголовок `referral.title` «Реферальная программа», `activeTitle` «Реферальная программа активна» и рядом
  `activeLabel` «Программа активна» (два одинаковых). Ещё `transactions.types.referralAccrual`, `hub.tiles.cards.text`,
  `promotionWizard.referralFriendly`.
- Исправить: «Приведи друга» / «Refer a friend». Строку `activeTitle` удалить, переключатель — «Программа работает» /
  «Program is on». `referralFriendly` → «Подходит для „Приведи друга“». `referralAccrual` → «Бонус за приглашённого
  друга» / «Referral bonus».

---

## minor

10. **Транзакции и «Операции с Excel».** `nav.transactions`, `transactions.title` «Транзакции» → «Операции» /
    «Transactions». `transactions.export`, `memberships.export` «Операции с Excel» → «Выгрузить в Excel», как уже
    сделано в `certificates.export`.
11. **en: gift certificates → gift cards** (глоссарий; меню уже «Gift cards»): `hub.tiles.cards.text`,
    `hub.tiles.certificates.title`, `certificates.title`, `certificateTypes.subtitle`, `hub.subtitle`,
    `nav.certificateTypes` / `certificateTypes.title` «Certificate types» → «Gift card types».
    `certificateTypeForm.namePlaceholder` «1000 gift certificate» → «E.g. “Gift card 10 000 ֏”», ru → «Например,
    „Сертификат на 10 000 ֏“» (1000 драм — не подарок).
12. **Знак драма в en.** `promotions.form.valueBonus`, `promotionWizard.valueTypeOptions.fixed`, `thresholdUnit.*`,
    `thresholds.valueFixed`, `kindExamples.*`, `cardTypeForm.limitFixed` пишут «AMD», соседние поля — «֏». Везде «֏»
    (§4). `certificateTypeForm.chargePreviewText` en «check 3,000 ֏» → «a 3 000 ֏ bill». Сумму подставлять через
    `money()`, а не писать цифрами в словаре.
13. **Нет plural.**
    - `membershipDetail.frozenAt` «Заморожен на {days} дней»;
    - `cardTypeForm.burnDays` «{days} дней» / en «{days} days»;
    - `membershipTypeForm.recalcPreviewText` «{visits} визитов»;
    - `certificateTypeForm.expiryPeriodUnit.*` «дней / недель / месяцев / лет» — обрывки для склейки.
    Исправить: ICU plural. Единицы срока — «Дни / Недели / Месяцы / Годы», как уже в `membershipTypeForm.durationUnit`
    (§3 «Выбор единиц срока»).
14. **«0 = бессрочно», «0 — без лимита».** `membershipTypeForm.durationHint`, `promotionWizard.applyLimitHint` →
    переключатель «Без срока» / «No expiry», «Без ограничения» / «No limit».
15. **«Действие необратимо.»** `cardTypeForm.deleteConfirmText`, `deleteConfirmTextCount`,
    `certificateTypeForm.deleteConfirmText*`, `membershipTypeForm.deleteConfirmText` → «Вернуть будет нельзя» / «This
    can’t be undone». У абонемента одного этого мало → «Тип пропадёт из списка. Проданные абонементы останутся у
    клиентов. Вернуть будет нельзя».
16. **Цифры без источника на хабе.** `hub.tiles.certificates.text` «В среднем используют 60% проданных сертификатов,
    каждый четвёртый приводит нового клиента» → «Подарок, который приводит к вам новых клиентов» / «A gift that brings
    you new clients». `hub.tiles.deposits.text` «…они обязательно придут его потратить» → см. №5.
    `hub.subtitle` «…увеличивайте их возвращаемость…» → «Привлекайте новых клиентов и возвращайте постоянных» /
    «Win new clients and bring regulars back».
17. **Пустые экраны без второй фразы и кнопки.**
    - `certificates.emptyTitle` «Нет сертификатов для отображения» → «Пока не продано ни одного сертификата» + «Продать
      сертификат можно в окне записи или на кассе» / «No gift cards sold yet» + «Sell one from the booking window or
      at checkout»;
    - у `memberships.emptyTitle`, `accounts.emptyTitle`, `accountOperations.emptyTitle` нет второй фразы — дописать,
      откуда они появятся;
    - `cardTypes.emptyText` хорош, по нему и равняться.
18. **Плейсхолдер повторяет подпись.** `promotionWizard.namePlaceholder` «Введите название акции» → «Например,
    „−10% на второй визит“» / «E.g. “10% off your second visit”». `membershipTypeForm.namePlaceholder` «Назовите ваш
    абонемент» → «Например, „5 маникюров“» / «E.g. “5 manicures”».
19. **Автоприменение.**
    - `autoApply.masterSwitchLabel` «Использовать автоматическое применение программ» → «Применять скидки сами, без
      карты» / «Apply discounts automatically, no card needed»;
    - `nav.autoApply` / `title` «Автоприменение акций» → «Скидки без карты» / «Automatic discounts»;
    - `autoApply.journal.title` en «Booking via the journal» → «Booking from the calendar»;
    - `autoApply.scopeAppOnly` «Только из мобильного приложения» → «Только из приложения Azat» / «Only from the Azat app».
20. **Абонемент: канцелярит в настройках.**
    - `activation` «Активировать абонемент» → «Когда начинается срок» / «Validity starts»; варианты — «С первого визита»
      / «Со дня продажи»;
    - `autoActivate` «Активировать автоматически при длительном отсутствии» → «Если клиент не пришёл — начать срок
      сам» / «Start the period anyway if the client doesn’t come»;
    - `autoActivateDays` «Активировать с момента продажи через, дней» → «Через сколько дней после продажи»;
    - `memberships.status.deactivated` «Деактивирован» → «Отключён» / «Turned off»;
    - en «Freeze / Unfreeze» → «Pause / Resume».
21. **Сертификат: «экземпляр» и длинные варианты.** `certificateTypeForm.expiryOptions.fixedDate` «Фиксированная дата для
    всех экземпляров» → «Одна дата для всех проданных» / «One end date for all sold»; `fixedPeriod` «Фиксированный
    срок действия с момента продажи» → «Срок от дня продажи» / «Period from the sale date»; `none` → «Без срока».
22. **Счёт клиента: «оплата в минус».** `accountTypeForm.allowNegative` → «Можно уйти в минус» / «Can go negative»;
    `accountTypes.allowsNegative / noNegative` → «Можно в минус» / «Без минуса»; `negativeLimitRequired` «Укажите
    лимит — без него галочку не сохранить» → «Укажите, на сколько можно уйти в минус» / «Set how far below zero it can
    go». `accountTypes.add` «Добавить тип счета» — без «ё» → «счёта».
23. **Мастер акции: одно поле — два слова.** Первый шаг — «Тип акции» (скидки / бонусы), второй — «Вид», а в форме
    `promotions.form.kind` — «Вид акции». `conditionDiscount` «Тип бонуса» стоит у скидки «на n-ю услугу». Исправить:
    шаг 1 — «Скидка или бонусы», шаг 2 — «Как считать»; `conditionDiscount` → «Размер скидки». en kinds «Accrued
    discount by visits» → «Discount that grows with visits», «…by amount» → «…with spend».
24. **Онлайн-продажа: «виджет».** `onlineSale.hint` «Появится в виджете онлайн-продаж локации…» → «Появится на
    странице записи салона — клиент купит сам» / «Shows on your booking page so clients can buy it themselves»;
    `titlePlaceholder` «Как покажем клиенту в виджете» → «Например, „5 маникюров со скидкой“»; `price` «Цена в
    виджете, ֏» → «Цена онлайн, ֏» / «Online price, ֏».
25. **Демо-данные не переводятся** (§3). На en-экране по-русски:
    - «Постоянный гость», «Скидка постоянному гостю», «Маникюр × 5», «Стрижка × 8», «Безлимит на месяц»;
    - «Подарочный сертификат 15 000 ֏», «Депозит».
    Хранить `LocalizedText` в сиде. Даты в таблицах «07.09.2026» — это Ф13 у фундамента, раздел ничего не меняет.
