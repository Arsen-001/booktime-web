# Тексты раздела client — проход 1 (text-q1)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила и глоссарий — `docs/TEXT-STYLE.md`.
Прочитано: `messages/{ru,en,hy}/client.json`; экраны (телефон 390, ru/en/hy): `/`, `/search`, `/bookings`, `/login`,
`/masters/st_nuri_ani` (client и guest), `/places/biz_nuri`, `/places/biz_lusine`, `/book`.
Ждёт раздела (заглушки, не дефект): `/favorites`, `/profile`.

Итого: **major 4 · minor 18**.

---

## major

### 1. Карточка мастера — «В приложении с сентябрь 2025» (падеж)
- Где: `master.factsSince` + `MasterCardScreen` (дата через `date(d, 'monthYear')` → именительный падеж).
- Исправить: брать дату целиком `date(d, 'long')` или сменить фразу на срок.
  - ru: `"factsSince": "В Azat с {date}"` + `date(d,'long')` → «В Azat с 12 сентября 2025»
    (или `"С нами {months, plural, one {# месяц} few {# месяца} many {# месяцев} other {# месяца}}"`)
  - en: `"On Azat since {date}"`
  - hy: `"Azat-ում է {date}-ից"`

### 2. Повторы в подписях карточек
- «Manana Beauty · Шенгавит · Шенгавит», «Manana Beauty · Нор-Норк · Нор-Норк» (главная «Свободно рядом», поиск),
  «Давташен, 4-й квартал · Давташен» (карточка места), «Лусине Погосян · Лусине Погосян · массаж» (`/bookings`,
  «Мои записи здесь»).
- Исправить при сборке строки: район не добавлять, если он уже есть в названии филиала или адресе; у частного
  мастера вместо названия бизнеса (оно = имя мастера) показывать только имя. Должно быть: «Manana Beauty · Шенгавит»,
  «Давташен, 4-й квартал», «Лусине Погосян · Массаж спины и шеи».

### 3. Реклама-заглушка на главной видна людям
- `home.adSpot` «Здесь будет реклама салонов» — первый экран продукта с текстом-обещанием.
- Исправить: пока объявлений нет — блок не показывать вовсе (ждёт platform → реклама). Ключ удалить.

### 4. Армянского в client нет — армянский клиент видит смесь
- `messages/hy/client.json` пуст, на `/masters/…` в hy: «Работает в салоне», «16 постоянных клиента»,
  «В приложении с սեպտեմբերի 2025», «Где принимает», «Попросить перезвонить» — посреди армянского.
- По §8 hy можно позже, но приложение клиента — главный экран для Еревана (F-00-172). Залить хотя бы эти ключи первыми:

| Ключ | hy |
|---|---|
| `home.upcoming.title` | Մոտակա գրանցումները |
| `home.myMasters.title` | Իմ վարպետները |
| `home.nearby.title` | Մոտակայքում ազատ |
| `home.nearby.empty` | Հիմա ազատ վարպետ չկա — նայեք մի փոքր ուշ |
| `home.searchPlaceholder`, `search.placeholder` | Ի՞նչ եք փնտրում |
| `home.loginBanner` | Մուտք գործեք՝ ձեր գրանցումներն ու վարպետներին տեսնելու համար |
| `search.nearMe` | Իմ մոտակայքում |
| `search.freeToday` | Այսօր ազատ |
| `search.resultsCount` | {count, plural, other {Գտնվեց # վարպետ}} |
| `search.empty.title` | Ոչ ոք չգտնվեց |
| `master.individual` | Անհատ վարպետ |
| `master.inSalon` | {name} սրահի վարպետ |
| `master.factsRegulars` | {count} մշտական հաճախորդ |
| `master.addressTitle` | Որտեղ է ընդունում |
| `master.materialsTitle` | Աշխատում է այս նյութերով |
| `master.nearestSlotsTitle` | Մոտակա ազատ ժամերը |
| `master.noSlots` | Ազատ ժամեր դեռ չկան |
| `master.bookCta`, `place.bookCta` | Գրանցվել |
| `master.contactTitle` | Կապ |
| `master.askCallback` | Խնդրել հետ զանգել |
| `master.callbackSent` | Խնդրանքն ուղարկված է — վարպետը հետ կզանգի |
| `master.waitlistCta` | Տեղեկացնել, երբ ազատվի |
| `bookings.tabUpcoming` / `tabPast` / `tabCancelled` | Սպասվող / Անցած / Չեղարկված |
| `bookings.emptyUpcomingTitle` | Սպասվող գրանցումներ դեռ չկան |
| `bookingDetail.confirmComing` | Հաստատել, որ կգամ |
| `bookingDetail.reschedule` | Փոխել ժամը |
| `bookingDetail.cancel` | Չեղարկել գրանցումը |
| `bookingDetail.cancelConfirmLate` | Անվճար չեղարկման ժամկետն անցել է․ հիմա չեղարկելը կհամարվի, որ չեք եկել |
| `login.title` / `login.continue` / `login.codeTitle` | Մուտք / Ստանալ կոդը / Գրեք կոդը |
| `login.channelLabel` | Ուր ուղարկենք կոդը |

---

## minor

5. **«Окна» у клиента → «свободное время»** (глоссарий: «окно» — только в кабинете и «горящее окно»):
   - `master.nearestSlotsTitle` «Ближайшие свободные окна» → «Ближайшее свободное время» · en «Nearest free time»
   - `master.noSlots`, `book.noSlots` «Свободных окон (пока) нет» → «Свободного времени пока нет»
   - `book.missingSlot` «Окно не выбрано» → «Время не выбрано» · en «No time selected»
   - `book.slotTaken` «Это окно уже заняли…» → «Это время уже заняли — выберите другое»
   - `bookings.waitlistNotified` «Окно освободилось!» → «Время освободилось — можно записаться»
   - `bookingDetail.prepaymentDeadline` «Окно держится до {time} — потом освободится само» → «Держим время за вами
     до {time}. Не будет предоплаты — оно освободится»
6. **Род в тексте:** `book.shadeMaster` «Не уверен(а) — мастер подберёт» → «Не знаю — пусть мастер подберёт»;
   `login.consentText` «Согласен с пользовательским соглашением…» → «Принимаю пользовательское соглашение и даю
   согласие на обработку данных»; `bookingDetail.prepaymentPaid` «Я оплатил» → «Оплата отправлена» (en «I’ve paid» ок).
7. **en: «master» → «specialist»** (калька): `home.myMasters.title` → «My specialists», `home.myMasters.empty` →
   «Book a specialist — they’ll show up here», `home.loginBanner` → «…and your favorite specialists»,
   `search.resultsCount` → «# specialist(s) found» через plural, `search.empty.*`, `master.*`, `book.*`, `reschedule.subtitle`
   — везде «specialist». `master.individual` «Solo master» → «Independent specialist».
8. **Частный мастер:** `master.individual` ru «Мастер-индивидуал» → «Частный мастер» (слово «индивидуал» —
   внутреннее).
9. **Название салона на метке:** `master.inSalon` «Работает в салоне» → «Мастер в салоне {name}» / en «Specialist at
   {name}» (решение F-00-048: метка «в салоне <название>»). Сейчас в `MasterCardScreen.tsx:102` имени нет.
10. **Отдельный чип «Только женщин»** без подписи читается обрывком → «Принимает только женщин» (или показать
    `master.acceptsLabel` перед значением).
11. `search.filters.sphere` en «Field» / `anySphere` «Any field» → «Specialty» / «Any specialty».
12. `book.success` «Запись создана — ждём подтверждения мастера» показывается и при мгновенной записи → два текста:
    мгновенно — «Вы записаны на {when}»; с подтверждением — «Запись отправлена — мастер подтвердит».
13. `bookings.status.no_show` «Неявка» → «Вы не пришли» (у клиента статусы от его лица, см. глоссарий «Статусы»);
    `bookings.status.scheduled` «Подтверждена» → «Вы записаны».
14. `bookings.source.*` — обрывки строчными («внесена мастером», «веб по ссылке», «внешняя») → «Записал мастер»,
    «Через приложение», «По ссылке мастера», «Через сайт», «По телефону», «Перенесена из другой программы»,
    «Из другой программы».
15. `bookingDetail.prepaymentRequisites` «Реквизиты: {phone}» → «Куда перевести: {phone}» / en «Pay to: {phone}»;
    `requisitesCopied` «Реквизиты скопированы» → «Номер скопирован».
16. `login.guestNotice` (длинно, 110 знаков) → «Смотреть мастеров можно без входа. Войти нужно, только чтобы записаться».
17. `login.namePlaceholder` en «How should we call you» → «What should we call you»; `login.codeSentTo`
    «Код отправлен на {phone} в {channel}» → «Отправили код в {channel} на номер {phone}».
18. `place.aboutTitle` «О месте» у частного мастера → «О мастере» (en «About»); для салона оставить «О салоне».
19. Часы работы — 7 одинаковых строк «Пн 10:00–21:00 … Вс 10:00–21:00» → сворачивать: «Каждый день 10:00–21:00»,
    «Пн–Пт 11:00–19:00 · Сб 11:00–16:00 · Вс выходной».
20. `master.callClosedHours` «Сейчас не время для звонков — можно написать» → «Сейчас мастер не принимает звонки —
    напишите ему»; `callClosedBusy` → «Мастер сейчас с клиентом — напишите ему».
21. `book.forWhomSelf` «Я» → «Для себя» (как `common.forWhom.self`); `reschedule.currentTitle` «Сейчас записаны на» →
    «Вы записаны на».
22. Материалы мастера («гель-лак», «каучуковая база») на en/hy показываются по-русски — это данные, ждёт раздела
    services (материалы как `LocalizedText`).
