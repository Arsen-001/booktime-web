# Тексты раздела client — проход 2 (text-q2)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила и глоссарий — `docs/TEXT-STYLE.md` (редакция 2).
Прочитано: `messages/{ru,en}/client.json` целиком (472 ключа), `messages/ru/ui.json` (`bookingStatusClient`);
экраны (десктоп, ru/en, persona client): `/`, `/search`, `/bookings`, `/favorites`, `/profile`, `/biz/apps` (owner).
hy не проверялся — выключен (CONVENTIONS §0.4); замечание q1 №4 про армянский снято.

**Статус q1 (`text-q1.md`, 22 замечания):** исправлено 0. Все, кроме №4 (hy), остаются в силе — ниже повторены
коротко только те, что стоит сделать первыми; полные формулировки — в `text-q1.md`.

Итого q2: **major 7 · minor 19** (новые + неисправленные из q1).

---

## major

### 1. Чужое имя продукта в уведомлениях — «LuckyBooking»
- Где: `notifications.senderFallback` (ru и en) — подпись отправителя в ленте уведомлений клиента.
- Исправить: ключ удалить, брать `useT('common')('app.name')` → «Azat». Других названий у продукта нет.

### 2. Заглушки для разработчиков на экранах клиента
- `/` — `home.adSpot` «Здесь будет реклама салонов» (q1 №3, не исправлено).
- `/profile` — «Здесь будет вклад раздела «Лояльность»» и «…«Финансы»» под заголовками «Карты, абонементы,
  сертификаты» и «Баланс» (это `common.ext.stub` из хоста `clientProfile`; хозяин хоста — client).
- Исправить: пустые вклады и рекламное место клиенту не показывать вовсе (рендерить слот, только если вклад что-то
  вернул; `ext.stub` — только на `/dev/ext/**`). Ключ `home.adSpot` удалить.

### 3. Один статус — два слова в одном списке «Мои записи»
- На `/bookings` рядом стоят «Вы подтвердили» и «Подтверждена» (en «You confirmed» / «Confirmed»); в `ui.bookingStatusClient`
  те же статусы названы третьими словами («Вы записаны», «Вы не пришли»), а `bookings.status.no_show` — «Неявка».
- Исправить `bookings.status.*` по глоссарию (TEXT-STYLE §6, «Клиенту»):

| код | ru | en |
|---|---|---|
| awaiting_confirmation | Ждёт подтверждения мастера | Waiting for the specialist |
| awaiting_prepayment | Нужна предоплата | Prepayment needed |
| scheduled | Вы записаны | You’re booked |
| client_confirmed | Вы подтвердили | You confirmed |
| arrived | Визит состоялся | Visit done |
| no_show | Вы не пришли | You didn’t come |
| cancelled_by_client | Вы отменили | You cancelled |
| cancelled_by_master | Мастер отменил | The specialist cancelled |

  («Мастер» — через `useTerms().master`: у стоматологии «Врач отменил».)

### 4. Галочка согласия при входе — с родом и канцеляритом
- `login.consentText` «Согласен с пользовательским соглашением и обработкой персональных данных» (q1 №6).
- Исправить: ru «Принимаю условия и разрешаю хранить мои имя и телефон» · en «I accept the terms and allow storing my
  name and phone». Ссылка «Условия» (`login.agreementLink` → «Условия» / «Terms») — отдельно рядом.

### 5. «Отзыв о месте» и «Оценить мастера» — спорят с нашим решением «только звёздочка»
- Ключи `place.reviewsTitle/Empty`, `bookingDetail.review*`, `bookingDetail.rateCta` «Оценить мастера».
  F-00-116: «клиент просто ставит звёздочку; пока только звёздочка»; текстовые отзывы — «Открыто» п. 26 (ждёт владельца).
- Исправить текст: `rateCta` → «Поставить звёздочку» / en «Give a star»; `master.starCount` «Понравилось #» →
  «{count, plural, one {# человек поставил звёздочку} few {# человека поставили звёздочку} many {# человек поставили
  звёздочку} other {# человека поставили звёздочку}}» / en «{count, plural, one {# person gave a star} other {# people
  gave a star}}». Отзывы о месте — вынести вопросом в `qa/questions/client.md`, пока владелец не ответил — спрятать.

### 6. en: «master» по всему приложению клиента (q1 №7)
- «My masters», «29 masters found», «Book a master», «Master and time», «The master cancelled», «At the master's home»…
- Исправить: везде «specialist» («My specialists», «{count, plural, one {# specialist found} other {# specialists
  found}}», «Specialist and time»); `master.individual` en «Solo master» → «Independent specialist».

### 7. Повторы в подписях карточек (q1 №2, не исправлено)
- `/`, `/search`: «Manana Beauty · Шенгавит · Шенгавит»; `/bookings`: «Лусине Погосян · массаж» под именем
  «Лусине Погосян».
- Исправить при сборке строки: район не добавлять, если он уже в названии филиала; у частного мастера вместо
  названия бизнеса показывать услугу или сферу один раз: «Manana Beauty · Шенгавит», «Лусине Погосян · Массаж».

---

## minor

8. **«Окна» у клиента** (q1 №5): `master.nearestSlotsTitle` → «Ближайшее свободное время» / «Nearest free time»;
   `master.noSlots`, `book.noSlots` → «Свободного времени пока нет»; `book.missingSlot` → «Время не выбрано»;
   `book.slotTaken` → «Это время уже заняли — выберите другое»; `bookings.waitlistNotified` «Окно освободилось!» →
   «Время освободилось — можно записаться»; `book.shadeOnOrderHint` «окна показаны…» → «свободное время — не раньше
   чем через…».
9. **Род** (q1 №6): `book.shadeMaster` «Не уверен(а) — мастер подберёт» → «Не знаю — пусть мастер подберёт»;
   `bookingDetail.prepaymentPaid` «Я оплатил» → «Оплата отправлена».
10. `master.individual` «Мастер-индивидуал» (видно на `/` и `/search`: «Мастер-индивидуал · Давташен») → «Частный мастер».
11. Кавычки в кавычках на главной: ««Абонемент «5 массажей спины»» — осталось визитов: 1». `home.reminderText` →
    «{title}: {left, plural, one {остался # визит} few {осталось # визита} many {осталось # визитов} other {осталось
    # визита}}» без своих «ёлочек» (название уже в кавычках) · en «{title}: {left, plural, one {# visit} other {# visits}} left».
12. `place.purchaseSuccess` en «pay the master's requisites at your visit» — сломанный английский → ru «Куплено —
    оплатите мастеру при визите» · en «Done — pay the specialist at your visit». `bookingDetail.prepaymentRequisites`
    «Реквизиты: {phone}» → «Куда перевести: {phone}» / «Pay to: {phone}» (q1 №15).
13. `bookings.source.*` — обрывки строчными (q1 №14): «Записал мастер», «Через приложение», «По ссылке мастера»,
    «Через сайт», «По телефону», «Из другой программы».
14. Подписки: en `favorites.tabSubscriptions` «Subscriptions» → «Following» (subscription = тариф бизнеса);
    `favorites.resubscribed` en → «Following again»; `favorites.subscribed` «Готово — вы подписаны, будут приходить
    новости» → «Вы подписались — новости придут в уведомления» / «You’re following — updates will come to your
    notifications»; `favorites.subscriptionsEmptyHint` «Нажмите ❤…» — сердечко = избранное, а тут подписка, и эмодзи
    в тексте → «Нажмите „Подписаться“ на странице мастера или салона»; `favorites.kindPlace` «Место» → «Салон» / «Salon».
15. «Компании» в профиле: `profile.notifSubtitle` → «Новости каждого мастера и салона включаются отдельно»;
    `profile.notifCompaniesTitle` → «Новости мастеров и салонов»; `profile.notifRemindersNote` «…новости компании
    выключены» → «…новости мастера выключены» (en «company» → «specialist or salon»).
16. `profile.largeFontHint` «Увеличивает текст на всех экранах — удобно пожилым» → «Текст крупнее на всех экранах» /
    «Larger text on every screen».
17. Список языков в профиле — свой (`ProfileScreen.tsx:34` `LANG_LABEL`, с армянским, хотя hy выключен) → брать
    `LOCALES` и названия из `@/i18n/config` (CONVENTIONS §0.4).
18. Нет plural / сокращения: `memberships.freezeDays` «до {days} дн.» → «до {days, plural, one {# дня} other {# дней}}»;
    `cashback.earnPerVisit` «{count} визит(а)» / en «visit(s)» → ICU plural.
19. `notifications.kind.online_payment_success` «Оплата прошла успешно — {amount}» → «Оплата прошла — {amount}» /
    en «Payment received — {amount}».
20. «Израсходован»: `memberships.usedUp` → «Все визиты использованы»; `certificates.usedUp` → «Потрачен полностью».
21. `loyalty.discountsTitle` ru «Скидки и бонусы», en «Discounts» — разный смысл → en «Discounts & bonuses».
22. Дневник: `diary.remove` «Убрать запись» (слово «запись» у нас = booking) → «Удалить расход»; `diary.subtitle` →
    «Визиты через Azat появляются сами, остальные траты впишите вручную».
23. Поиск: en `search.filters.sphere` «Field» → «Specialty» (q1 №11); сфера «Общий» в фильтре клиента непонятна —
    не показывать её в фильтре (или «Другое» / «Other»).
24. Вход: `login.codeWrong` «Неверный код — проверьте и попробуйте снова» → «Код не подошёл — проверьте цифры или
    попросите новый»; en `login.namePlaceholder` «How should we call you» → «What should we call you» (q1 №17).
25. Лист ожидания — два слова для одной кнопки: `master.waitlistCta` «Сообщить, если освободится», `waitlistSubmit`
    «Встать в очередь» → обе по глоссарию: «Сообщить, когда освободится» / «Notify me when free».
    `master.callbackSubmit` «Отправить просьбу» → «Попросить перезвонить».
26. `/biz/apps`: пункт меню «Приложения», а заголовок экрана «Переводы текстов» — человек не понимает, туда ли попал.
    Либо заголовок «Приложения» и секция «Переводы текстов», либо подпункт меню «Переводы».
