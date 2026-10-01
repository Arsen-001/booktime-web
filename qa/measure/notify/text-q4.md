# Тексты раздела notify — проход 4 (text-q4)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила — `docs/TEXT-STYLE.md`, редакция 4.
Прочитано: `messages/{ru,en}/notify.json`, 534 ключа. Целиком прочитаны группы, которых не было в q2 и q3:
`whatsapp`, `developer`, `loyalty`, `catalog`, `promotion`, `balance`. Видимый текст 5 экранов в ru и en.

Статус q3: у 11 замечаний нет отметок сборщика. По экрану:
- №1 исправлено частично: дата в истории теперь «21 сентября, 12:45», а номер в колонке «Контакт» по-прежнему
  «+37494271022» без `format.phone()`;
- №2 «Без этих четырёх шагов», хотя шагов три (`channelsTab.checklist.hint`);
- №4 «Push · наше приложение» прямо в коде (`MailingsListScreen.tsx:26–27`) — на en-экране истории рассылок по-русски.

Итого q4: **major 5 · minor 8**.

---

## major

### 1. «WhatsApp через Altegio» — чужой бренд на экране канала
- `whatsapp.title` «WhatsApp через Altegio»; `mode.notificationSender.title` «Altegio Notification Sender»,
  `.hint` «Общий официальный номер Altegio»; `mode.embeddedSignup.title` «Altegio WhatsApp Business»; `trialNote` «В
  пробный период Altegio ничего не отправляет»; `coexistenceReq1` «Платный аккаунт Altegio (любой тариф)»;
  `channelsTab.more.whatsapp` «WhatsApp через Altegio»; `developer.agentFlagsHint` «Что сам Altegio шлёт…».
- Наш продукт — Azat (TEXT-STYLE §1). Исправить:
  - «WhatsApp через Azat» / «WhatsApp via Azat»;
  - «Общий номер Azat» / «Azat shared number»;
  - «Свой WhatsApp Business» / «Your own WhatsApp Business»;
  - «Платная подписка Azat» / «A paid Azat subscription».
- Ещё одно для проверки наших решений, не для текста: платные напоминания через WhatsApp и SMS у нас сняты
  (`00-our-decisions.md`, «Снято», п. 11). Нужен ли экран с балансом для WhatsApp, пусть решит проверка решений.

### 2. Лояльность: «у нас лояльность ещё не построена» и «У Altegio…»
- `loyalty.subtitle` «…у нас лояльность ещё не построена, поэтому шаблоны настраиваются здесь». Раздел «Лояльность»
  уже построен, фраза неверна и рассказывает про наш план.
- `loyalty.whereNote` «У Altegio эти уведомления настраиваются в разделе „Лояльность“ сети; у нас — здесь…».
- `loyalty.syncWithType17` «…синхронизирован со значением в общем типе 17», кнопка «Открыть тип 17» — внутренний номер.
- `loyalty.groupAutoRenewal` «Автопродление (только Бразилия)».
- Исправить:
  - subtitle → «Сообщения клиентам о картах, акциях и абонементах» / «Messages to clients about cards, promotions and
    memberships»;
  - `whereNote` удалить;
  - тип 17 называть словами: «…совпадает со сроком в сообщении „Скидка скоро закончится“» и кнопка «Открыть это
    сообщение»;
  - группу автопродления спрятать: автосписание у нас отложено.
- Договоритесь с loyalty, где живут тексты этих сообщений. Сейчас их два набора: здесь и в
  `loyalty.cardTypeForm.notify.*`. Это «один факт — одна формулировка» (§3).

### 3. en: «subscriptions» вместо «memberships»
- `loyalty.title` en «Loyalty, subscriptions, letters», `subtitle`, `groupSubscriptions` «Subscriptions»,
  `altegioMeReminderPreview` «…left on the subscription».
- Абонемент = membership. Subscription — это тариф Azat (глоссарий §6). Исправить: «Memberships». Ключ
  `altegioMeReminderPreview` переименуйте: в имени ключа чужой бренд.

### 4. Отзывы в каталоге каналов — сняты нашими решениями
- `catalog.capability.reviewsOnMaps` «Отзывы на картах», `negativeIntercept` «Перехват негативных отзывов».
- У нас нет отзывов, только звёздочка («Снято», п. 9–10). Исправить: убрать оба фильтра и эти возможности у
  партнёров в демо-каталоге.

### 5. Экран для разработчиков: «сущности», «локация», английские заголовки
- `developer.webhooksTitle` «WebHook — уведомления внешним системам»; `webhooksEmptyText` «…о каких сущностях
  присылать события»; `webhookEntitiesRequired` «Выберите хотя бы одну сущность»; `entity.location` «Локация»;
  `webhooksHint` «При изменениях в локации отправляется POST-запрос на указанный адрес».
- Исправить:
  - заголовок → «Вебхуки: сообщать вашей программе об изменениях» / «Webhooks: tell your system about changes»;
  - «сущности» → «что именно» («Выберите, о чём сообщать» / «Choose what to report»);
  - «Локация» → «Филиал»;
  - подсказка → «Когда в филиале что-то меняется, отправим запрос на этот адрес» / «When something changes at the
    branch, we’ll send a request to this address».

---

## minor

6. **Промо: английское название и эмодзи.** `promotion.openSlotsTitle` «Open Slots — картинка свободных окон» →
   «Картинка свободных окон» / «Free slots picture». `giftShowcasePreview` «🎁 Подарок от {partner}…» — эмодзи в
   интерфейсе (§1), убрать. `whoToInviteTitle` в кавычках «„Кого позвать“» → без кавычек. `promotion.demoOnly` «демо» →
   метка «Демо» с заглавной, в начале.
7. **Нет plural и сокращение.** `catalog.installs` «{n} установок», `catalog.trialDays` «{n} дней бесплатно»,
   `loyalty.daysBeforeOption` «за {n} дн.» / en «{n} days before» → ICU plural: «{n, plural, one {за # день} few {за #
   дня} many {за # дней} other {за # дня}}».
8. **Точка в тостах.** `whatsapp.saved` «Сохранено.», `testSent`, `templatesApprovedToast`, `developer.webhookAdded`,
   `promotion.imageDownloaded`, `inviteSent`, `balance.topUpSuccess` — тост без точки (§3).
9. **«Агрегатор», «лицензия», «служебный пользователь».**
   - `catalog.subtitle` «SMS-агрегаторы и боты-партнёры» → «SMS-провайдеры и чат-боты» (глоссарий);
   - `catalog.typeSmsAggregator` → «SMS-провайдер» / «SMS provider»;
   - `catalog.licenseNote`, `catalog.systemUser` «…не занимает платное место в лицензии» → «Подключённое приложение
     не считается сотрудником — за него не платите» / «A connected app doesn’t count as a staff seat»;
   - «Каскадная отправка», «RFM-анализ», «Кампании возврата» → «Если не дошло — отправить другим каналом», «Кто
     сколько тратит и как часто ходит», «Вернуть давних клиентов».
10. **«Пуш», а не «Push».** `catalog.channelKind.push` ru «Push» → «Пуш» (§3 «Каналы сообщений»).
11. **Правило пропуска.** `typesTab.skipRules.rule13`: КАПС «у ВСЕХ сотрудников локации» → «…только если график
    заканчивается у всех сотрудников филиала».
12. **Баланс.** `balance.subtitle` «(WhatsApp Notification Sender)» → «(общий номер WhatsApp)»;
    `balance.insufficientStatus` «Недостаточно средств» → «Не хватает денег на балансе» / «Not enough balance».
    `newMailing.audience.networkSmsBalance` / `Insufficient`: «главной локации» → «главного филиала», «средств» →
    «денег».
13. **Сообщение клиенту на en с русской услугой.** `/biz/notifications/log?lang=en`: «It has been a while since your
    "Укрепление ногтей гелем"…» — название услуги из данных не переведено (Ф16 у фундамента). Кавычки в en-тексте —
    “ ”, не прямые.
