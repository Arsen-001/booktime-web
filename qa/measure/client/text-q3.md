# Тексты раздела client — проход 3 (text-q3)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила — `docs/TEXT-STYLE.md` (редакция 3).
Прочитано: `messages/{ru,en}/client.json` целиком (720 ключей, было 472 — добавились `apps.*`); видимый текст экранов
(десктоп 1440, persona client / owner, nails, ru и en): `/`, `/search`, `/bookings`, `/favorites`, `/profile`,
`/biz/apps`, `/biz/apps/stories`, `/news`, `/promotion`, `/reminders`, `/branded`, `/translations`.
Всплывающие окна и шаги записи не открывал — проверены по словарю.

**Статус q2 (`text-q2.md`, 26 замечаний): исправлено 2** — №2 (заглушки «Здесь будет вклад раздела…» в профиле
больше не видны) и №26 (заголовок `/biz/apps` теперь «Приложения»). Остальные 24 в силе, ключи не менялись:
№1 «LuckyBooking», №3 статусы, №4 галочка «Согласен…», №5 «Оценить мастера», №6 «master» в en, №7 повторы в
подписях карточек, №8–25. Полные формулировки — в `text-q2.md`; ниже только новое.

Итого q3 (новое): **major 5 · minor 14**.

---

## major

### 1. Внутренняя кухня и чужой бренд на экране «Своё приложение» (`/biz/apps/branded`)
- `apps.branded.decisionPending` «Решение, делаем ли своё приложение под бренд салона, ещё не принято — этот экран
  собран как демо-заявка по описанию Altegio…», `apps.branded.priceNotApproved` «Демо-цена по справке Altegio — не
  окончательное решение, курс демо…», `apps.branded.accessMethodTitle` «Как передать доступ Altegio».
- Исправить: `decisionPending` и `priceNotApproved` — удалить (если цена не утверждена — прятать сумму и писать
  «Цену назовёт менеджер» / «A manager will tell you the price»); `accessMethodTitle` → «Как дать нам доступ» /
  «How to give us access». Нерешённость — вопросом в `qa/questions/client.md`, а не текстом владельцу салона.

### 2. Номер функции ТЗ на экране — «(F-00-006)»
- `/biz/apps`: `apps.hub.positioningHint` «…По прямой ссылке салона (F-00-006) — только этот салон…».
- Исправить: «В каталоге Azat клиент видит всех мастеров и салоны. По вашей ссылке — только вас, без чужих карточек
  рядом» / «In the Azat catalog clients see every specialist and salon. From your own link — only you, with no one
  else next to you».

### 3. Английский экран `/biz/apps` показывает русские списки
- «Что умеет приложение для бизнеса», «Только в вебе», «Только в приложении» на `?lang=en` — по-русски («Записи дня
  по сотруднику…», «Покупка и продление подписки…»). В `messages/en/client.json` перевод есть, но это JSON-массивы
  (`apps.hub.capabilitiesList`, `webOnlyList`, `appOnlyList`), а слияние словарей берёт из en только строки —
  массив остаётся русским (`src/i18n/load.ts`, `mergeWithFallback`).
- Исправить в разделе: как в `BrandedAppScreen.tsx` — отдельные ключи `capabilities0…5`, `webOnly0…3`, `appOnly0…2`
  (или объект). Фундаменту — просьба Ф12 в сводке прохода text-q3.

### 4. Русские подписи прямо в коде (`BrandedAppScreen.tsx:260–262`)
- На en-экране: «1 локация / год», «Apple Developer / год», «3 лок.»; на ru — «локация» и сокращение «лок.».
- Исправить: ключи `apps.branded.priceBaseHint` «За один филиал в год» / «Per branch, per year»;
  `apps.branded.priceAppleHint` «Apple Developer, в год» / «Apple Developer, per year»;
  `apps.branded.priceTotalHint` «{count, plural, one {# филиал} few {# филиала} many {# филиалов} other {# филиала}}» /
  «{count, plural, one {# branch} other {# branches}}».

### 5. Приложение для бизнеса: «скоро в сторах» против «у нас нет»
- `/biz/apps`: «Приложение для бизнеса скоро появится в сторах» + список его возможностей. В разделе online
  (`hub.mobileNote`) — «отдельного мобильного приложения для бизнеса у нас нет». По нашим решениям (00, строки 20–21)
  кабинет бизнеса — «приложение и веб».
- Исправить здесь: `apps.hub.downloadSoon` → «Скоро в App Store и Google Play» / «Coming soon to the App Store and
  Google Play». Договоритесь с online об одном ключе в `common` (TEXT-STYLE §3 «Один факт — одна формулировка»).

---

## minor

6. «Продвигается» у клиента (`search.boostedBadge`, видно на `/` и `/search`) → «Реклама» / «Ad» (TEXT-STYLE §3,
   «Реклама и продвижение»). Купленное место честнее подписать рекламой.
7. `apps.hub.threeApps.business.text` en «The cabinet: journal, clients, analytics…» и `apps.hub.downloadHint`
   «Bookings, journal and analytics…», `apps.hub.capabilitiesList.3` «Journal in Day, List, Week views» → «calendar»
   (глоссарий: журнал = calendar); `apps.branded.contactFallbackName` en «Request from the cabinet» → «Request from
   the business workspace».
8. «Окна» и «slots» в `/biz/apps` en: `tileStoriesHint` «A ready image with open slots» — в кабинете «open slots»
   допустимо, но `apps.stories.slotsInfo` «Slots taken: {used} of {max}» и `slotsFull` «No slots left» говорят о
   местах для сторис, а не об окнах → «Spots taken: {used} of {max}», «No spots left — the next one costs more and
   waits in line» (ru `slotsFull` «Мест нет — дороже, в очередь» → «Мест нет — следующее дороже и встанет в очередь»).
9. Монеты без plural и без разделителя: `apps.stories.balance` «{amount} монет» (на экране «8000 монет»),
   `apps.stories.publishFor`, `sendForReviewFor`, `apps.promotion.buy`, `apps.news.overFreeHint` «…{price} монет» →
   «{amount, plural, one {# монета} few {# монеты} many {# монет} other {# монеты}}» / «{amount, plural, one {# coin}
   other {# coins}}»; число — через `format.number`, чтобы было «8 000».
10. `apps.promotion.boostHint` «На {days} дней за {price} монет» → plural у обоих чисел: «{days, plural, one {На #
    день} few {На # дня} many {На # дней} other {На # дня}} — {price, plural, one {# монета} few {# монеты} many
    {# монет} other {# монеты}}».
11. `apps.reminders.subtitle` «Завтра {count} клиентов без приложения» → «{count, plural, one {Завтра # клиент без
    приложения} few {Завтра # клиента без приложения} many {Завтра # клиентов без приложения} other {Завтра # клиента
    без приложения}}» / «{count, plural, one {# client} other {# clients}} without the app tomorrow».
12. `apps.branded.blockersHint` «Не хватает {count} пункта…» / en «{count} item(s)…» → «{count, plural, one {Не
    хватает # пункта} other {Не хватает # пунктов}} из списка выше — заявка уйдёт, когда всё будет готово» /
    «{count, plural, one {# item is} other {# items are}} still missing from the list above».
13. `apps.promotion.subtitle` «…— черновик, цифры могут измениться» — заметка о нашем плане (TEXT-STYLE §1) →
    «Скидка на горящее окно и платное место выше в поиске» / «A discount on a last-minute slot and a paid spot higher
    in search». `apps.hub.tilePromotionHint` en «Discount on a hot slot» → «last-minute slot» (глоссарий).
14. `apps.stories.showStaffNamesHint` «У индивидуала по умолчанию выключено» → «У частного мастера по умолчанию
    выключено» / «Off by default for an independent specialist»; `apps.branded.owner.individual.title`
    «Индивидуальный предприниматель» — здесь это юридический статус, оставить.
15. «Шаблон» в сторис: `apps.stories.tabGenerated` «Из шаблона» → «Готовая картинка» / «Ready-made»;
    `generatorHint` «Шаблон — сразу без проверки; своя фотография — после проверки» → «Готовая картинка выходит
    сразу, своё фото — после проверки» / «A ready-made image goes live at once; your own photo after a review».
16. Язык картинки сторис — коды «RU / HY / EN» → названия языков «Русский», «Հայերեն», «English» (их видит владелец,
    не все знают коды).
17. `/biz/apps/reminders` на en: названия услуг по-русски («Маникюр аппаратный · 10:00»), хотя в журнале они уже
    переводятся («Classic manicure»). Брать локализованное название услуги так же, как `journal`.
18. `/bookings`: подзаголовок «Предстоящие, прошедшие и отменённые» повторяет вкладки под ним → «Куда и когда вы
    записаны» / «Where and when you’re booked»; пустой лист ожидания «Вы не в листе ожидания» → заголовок «Здесь
    пусто» + «Нет нужного времени — нажмите «Сообщить, когда освободится» на странице мастера» / «No time that
    suits you? Tap “Notify me when free” on the specialist’s page».
19. `/favorites`, вкладка «Подписки»: под «Мастер маникюра» стоит ещё ярлык «Мастер», под салоном — «Место»
    (`favorites.kindMaster`, `favorites.kindPlace`; ключ пустого листа ожидания — `bookings.waitlistEmpty`). Ярлык «Мастер» убрать (должность уже есть), «Место» → «Салон» /
    «Salon».

---

Проверено, в порядке: `apps.news.*`, `apps.translations` (пустое состояние хорошее), тосты `apps.*` в прошедшем
времени без «успешно».
