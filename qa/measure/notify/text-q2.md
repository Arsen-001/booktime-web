# Тексты раздела notify — проход 2 (text-q2)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила и глоссарий — `docs/TEXT-STYLE.md` (редакция 2).
Прочитано: `messages/{ru,en}/notify.json` целиком (173 ключа), справочник типов `src/areas/notify/lib/registry.ts`,
демо-данные `src/mock/slices/notify.ts`; экраны (десктоп, owner, nails, ru/en): `/biz/notifications`,
`/biz/notifications/channels`, `/biz/notifications/mailings`, `/biz/notifications/log`, `/biz/notifications/inbox`.
Первый проход текстов для раздела (в q1 его ещё не было).

Итого: **major 6 · minor 16**.

---

## major

### 1. Весь справочник уведомлений — только по-русски, мимо словарей
- `registry.ts`: `nameRu`, `descriptionRu`, `templateRu`, названия групп (`client: 'Клиенту'`, `attendance:
  'Увеличение посещаемости'`…); `MailingsListScreen.tsx:26–27` «Push · брендированное приложение», «Push · наше
  приложение»; `slices/notify.ts` `audienceLabel: 'Все клиенты'`. На en-экране: заголовки «Клиенту», «Администратору»,
  все типы, каналы «Пуш в приложение», журнал отправок, история рассылок — по-русски.
- Исправить: названия и описания типов, групп, каналов, аудиторий — ключами в `messages/{ru,en}/notify.json`
  (`types.<id>.name`, `types.<id>.hint`, `groups.<id>`, `audience.<id>`), в данных хранить только id. Тексты шаблонов,
  которые правит салон, — `LocalizedText`.

### 2. Сообщения клиентам с датой «2026-09-26» и номером без пробелов
- Журнал отправок: «Напоминаем: завтра 2026-09-26 в 13:00 у вас визит.», «Вы записаны на 2026-09-29 в 13:00.»;
  контакт «+37400173675» рядом с «+374 55 000 000».
- Исправить: подставлять `{date}` через `useFormat().date` (для сообщения — «сб, 26 сент», «завтра»); «завтра {date}»
  не писать вместе — либо «завтра», либо дата: «Напоминаем: завтра в 13:00 у вас {service} у {staff}». Телефон —
  `phone()`.

### 3. Непонятная строка про лимит пушей
- `/mailings`: «Массово — только SMS или пуш; за неделю подписчикам своего приложения: 0 из 3 пушей на этой неделе»
  (`mailings.rulesText` + `mailings.pushLimit`, склейка). «Подписчики» у нас — те, кто подписался на мастера.
- Исправить одним ключом: «Рассылку можно отправить пушем или по SMS. Бесплатных пушей в неделю — {total}, осталось
  {left}» / en «Send a broadcast by push or SMS. Free pushes per week: {total}, {left} left».

### 4. Галочка ответственности — канцелярит и род
- `newMailing.legalLabel` «Я ознакомился и осознаю ответственность за нарушение действующего законодательства».
- Исправить: «Пишу только тем, кто согласен получать сообщения» / «I only message clients who agreed to hear from me»
  (одинаково с clients `bulk.message.consent`).

### 5. Жаргон в статусах доставки
- `log.status.rejectedByRateLimiter` «Отклонено ограничителем скорости», `log.status.insufficientFunds`
  «Недостаточно средств», `log.status.rejectedByOperator` «Отклонено оператором», `channelsTab.smsPrice` «по тарифу
  агрегатора».
- Исправить: «Не отправлено: слишком много сообщений подряд» / «Not sent: too many messages at once»; «Не отправлено:
  на SMS-балансе нет денег» / «Not sent: SMS balance is empty»; «Не пропустил оператор связи» / «Blocked by the
  carrier»; «по цене вашего SMS-провайдера» / «at your SMS provider’s rate».

### 6. «Запрос отзыва» — отзывов у нас нет, есть звёздочка; «недошедших»
- Типы «Запрос отзыва (запись через виджет / журнал)» с текстом «Понравилось? ★»; «Приглашение на визит недошедших
  клиентов»; группы «Контроль качества», «Работа с возвращаемостью».
- Исправить: «Просьба поставить звёздочку» / «Ask for a star»; «Позвать тех, кто не пришёл» / «Invite no-shows back»;
  группы «После визита» / «After the visit», «Вернуть клиентов» / «Bring clients back», «Увеличение посещаемости» →
  «Перед визитом» / «Before the visit». В описаниях двух типов оплаты — «(отправка — когда появится оплата,
  F-00-028)» → «Заработает, когда включим онлайн-оплату».

---

## minor

7. `channelsTab.disconnectConfirmText` «Тип 7 (код входа) и рассылки перестанут отправляться по SMS» — номер типа
   → «Код входа и рассылки больше не будут уходить по SMS».
8. «Брендированное приложение» (`channels.brandedApp`, `newMailing.channel.pushOwnApp`, `brandedLocked`,
   `channelsTab.brandedRequested`) → «Своё приложение салона» / en «Your own app».
9. «Push» латиницей и «наше приложение» (для салона «наше» — его собственное): `newMailing.channel.pushClientApp`
   «Push в наше приложение», `channelsTab.hint.push` «…в наше приложение» → «Пуш в приложении Azat» / «Push in the
   Azat app».
10. `typesTab.emptyText` «Список появится вместе с новым бизнесом.» — непонятно → «Здесь будут сообщения, которые
    Azat отправляет сам: подтверждения, напоминания, поздравления».
11. Род и «дн.» в получателях: `newMailing.audience.receivedYes / receivedNo` «Получал(и) / Не получал(и)» →
    «Получали» / «Не получали»; `receivedTitle` «Получал рассылку» → «Уже получали рассылку»; `receivedYesLabel`,
    `receivedNoLabel` «…за {days} дн.», `periodDays` «{days} дней» → ICU plural.
12. `newMailing.sent` «Отправлено {count} получателям» → «{count, plural, one {Отправили # клиенту} other {Отправили
    # клиентам}}» / «Sent to {count, plural, one {# client} other {# clients}}»; `mailings.columns.count` «Кол-во» →
    «Получателей».
13. `log.emptyFiltered` «С такими параметрами нет сообщений — попробуйте изменить критерии поиска.» → заголовок
    «Ничего не нашли» + «Измените фильтры или сбросьте их» (+ кнопка «Сбросить фильтры»).
14. Три одинаковых «Не удалось сохранить» (`typesTab.saveFailed`, `channelsTab.saveFailed`, `typeDetail.saveFailed`)
    → общий `common.states.actionFailed` или «Не получилось сохранить. Попробуйте ещё раз».
15. Каналы: `typeDetail.scenario.fallback` «Если предыдущий канал не доставлен» → «Если не дошло по предыдущему
    каналу»; `typeDetail.previewHint` «Предпросмотр по текущим сценариям каналов.» → «Так сообщение увидит клиент —
    с приложением Azat и без него»; `typeDetail.tabs.templates` «Шаблоны уведомлений» → «Тексты сообщений».
16. `channelsTab.hint.email` «Письма клиенту прямо из системы, без интеграций.» → «Письма клиентам — бесплатно,
    ничего настраивать не нужно»; `channelsTab.hint.sms` «Через подключённого партнёра — только запасной канал кода
    входа.» → «Запасной способ прислать код входа, если пуш не дошёл. Нужен свой SMS-провайдер».
17. SMS-настройка: `channelsTab.apiKeyLabel` «Ключ авторизации» → «Ключ доступа от провайдера (API-ключ)»;
    `channelsTab.emailInvalid` «Введите корректный email» → «Проверьте адрес: в нём должна быть @».
18. `channelsTab.active` «Активен» → «Работает»; `channelsTab.notConnectedTitle` «Не подключённые» → «Можно подключить».
19. `inbox.markAllRead` «Прочитать все» → «Отметить всё прочитанным» / «Mark all as read».
20. en: «Mailings» (`nav.mailings`, `mailings.title`, `create`, `historyTitle`) — калька → «Broadcasts»; `nav.channels`
    «Sending channels» → «Channels»; `newMailing.audience.all` «Вся база» / «Whole base» → «Все клиенты» / «All
    clients»; «cabinet» в `channelsTab.hint.adminApp`, `inbox.subtitle` → «business workspace».
21. Тип для сотрудника «Скорое завершение расписания работы сотрудников» и текст «…расписание открыто ещё на {days}
    дн.» → «График сотрудника скоро закончится» / «У {staff} график открыт ещё на {days, plural, one {# день} few
    {# дня} many {# дней} other {# дня}}» (у нас «график», не «расписание»).
22. «Типы уведомлений» (`nav.types`, `tabs.types`) — слово «тип» внутреннее → «Автосообщения» / «Automatic
    messages»; `settingsHub.hint` соответственно.
