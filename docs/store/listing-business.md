# «BookTime Business» (салоны и мастера) — тексты для App Store и Google Play

Bundle ID / applicationId: `am.booktime.business`. Открывает https://booktime.am/biz.
Языки и правила — как в [listing-client.md](listing-client.md). В App Store армянского нет: основной язык
English (U.S.) и Russian. В Google Play — hy-AM, ru-RU, en-US.

> 🔴 **До отправки на проверку в App Store.** В кабинете есть оплата подписки и покупка монет («карта / Idram /
> Telcell» и счёт), а в iOS-приложении цифровую подписку нельзя продавать мимо In-App Purchase (правило 3.1.1).
> Внутри iOS-приложения нужно спрятать кнопки оплаты и ссылки на неё: «Подписка», «Монеты», «Оплатить»
> (`isNativeApp() && platform === 'ios'`, мост — `src/lib/native/bridge.ts`). Просмотр статуса подписки
> оставить можно. Это экраны settings/billing — правка не для этой задачи, см. README «Блокеры».
> В Google Play для B2B-сервиса оплата по счёту вне Play допустима, но покупка монет картой тоже подпадает
> под Play Billing. Проще спрятать оплату в обоих приложениях.

---

## Общие поля

| Поле | Значение |
|---|---|
| Категория App Store | Основная **Business**, дополнительная **Productivity** |
| Категория Google Play | **Business** (Бизнес) |
| Marketing URL | https://booktime.am/business (hy: https://booktime.am/hy/business, en: https://booktime.am/en/business) |
| Support URL | https://booktime.am/terms#contacts (до отдельной страницы помощи) |
| Privacy Policy URL | https://booktime.am/privacy |
| Удаление аккаунта (Google Play) | https://booktime.am/account-deletion |
| Copyright | © 2026 [Юридическое лицо] |
| Цена | Бесплатно. В приложении ничего не продаётся: In-App Purchases — нет. |
| Версия / сборка | 1.0.0 (1) |

### Возрастной рейтинг

**App Store:**
- Все пункты о насилии, сексе, лексике, веществах, азартных играх и ужасах — нет.
- Медицинская информация — нет. Клиники ведут свои карты пациентов, но приложение не даёт медицинских советов.
- Unrestricted Web Access — нет.
- User-Generated Content — **Yes**: фото работ, описания салона. Всё проверяется до показа в каталоге.
- Messaging and Chat — **Yes**: салон пишет своим клиентам о записях.
- Advertising — нет.

Ожидаемый результат — **4+** (возможно 9+ или 13+ из-за переписки). Это рабочий инструмент для взрослых.

**Google Play IARC:**
- Категория — «Все остальные типы приложений».
- Насилие, секс, лексика, наркотики, азартные игры — нет.
- Пользователи общаются — **да**.
- Передача личных данных — **да**: салон хранит данные своих клиентов.
- Местоположение другим пользователям — **нет**.
- Цифровые покупки — **нет** (если оплата спрятана, см. выше).

Целевая аудитория — **18+**.

---

## Русский (ru)

**Название** (≤ 30)
```text
BookTime Business
```

**Подзаголовок iOS** (≤ 30)
```text
Журнал, клиенты, онлайн-запись
```

**Краткое описание Google Play** (≤ 80)
```text
Журнал записей, клиентская база и онлайн-запись для салонов и мастеров
```

**Ключевые слова iOS** (≤ 100)
```text
салон,мастер,CRM,расписание,маникюр,барбершоп,клиника,напоминания,касса,склад,заказы,ремонт,Ереван
```

**Promotional text iOS** (≤ 170)
```text
Журнал записей у вас в кармане: заявки с подтверждением одной кнопкой, бесплатные напоминания клиентам в Telegram и «Найти окно» под любую услугу за секунды.
```

**Описание** (≤ 4000)
```text
BookTime Business — журнал записей, клиентская база и онлайн-запись для салонов красоты, барбершопов, клиник, мастеров-одиночек и мастерских Армении. Всё работает на телефоне так же, как на компьютере.

ЖУРНАЛ
• Колонки по мастерам, «Обзор» дня, «Лента» для большого салона и «Список» дня.
• «+ Запись» под большим пальцем. Постоянного клиента можно записать за 3 нажатия.
• «Найти окно»: выбрали услугу — журнал подсветил все подходящие свободные окна у всех мастеров.
• Заявки клиентов можно принимать сразу или с подтверждением мастера одной кнопкой.
• Удобно переносить записи, отменять с возвратом за 5 секунд и восстанавливать удалённое.
• Лист ожидания: освободилось время — система сама предложит его ждущим.
• Итоги дня, «Закрыть день», незакрытые визиты в одно нажатие.

ОНЛАЙН-ЗАПИСЬ И КАТАЛОГ
• Ссылка на запись для Instagram, WhatsApp и сайта, кнопка-виджет для вашего сайта.
• Ваш салон в каталоге BookTime: клиенты рядом видят ваши свободные окна и записываются сами.
• Страница салона на армянском, русском и английском, её находят в поисковиках.
• Предоплата на ваши реквизиты: клиент переводит, вы отмечаете «деньги пришли».
• Свои правила у каждого мастера: подтверждение, срок отмены, предоплата.

КЛИЕНТЫ
• Карточка клиента: история визитов, заметки, документы и фото, неявки.
• «Пора записать»: кому пора снова, по ритму визитов клиента.
• Бесплатные напоминания клиентам в Telegram и пушем, клиент подтверждает визит одной кнопкой.
• Перенос базы из Excel и других систем без дублей.
• В клиниках — медицинская карта и план лечения.

ЗАКАЗЫ ДЛЯ МАСТЕРСКИХ
• Ателье, ремонт техники, химчистка, детейлинг.
• Статусы «принят → в работе → готов → выдан».
• Нажали «Готово» — клиенту само ушло сообщение и ссылка «где мой заказ».
• Квитанция с QR-кодом, напоминание забрать заказ через 3 и 7 дней.

ДЕНЬГИ И КОМАНДА
• Касса и оплаты визитов, зарплата мастеров, склад со сроками годности и сканером штрихкодов камерой.
• Отчёты по выручке, мастерам и услугам.
• Роли и права сотрудников, журнал действий, несколько филиалов в одном аккаунте.

УДОБНО КАЖДЫЙ ДЕНЬ
• Пуш о новой записи, переносе и отмене.
• Ссылки из уведомлений открываются прямо в приложении.
• Весь кабинет на армянском, русском и английском.
• Цены в драмах, телефоны +374.

Регистрация бизнеса — на booktime.am/business. Если вы клиент, вам нужно приложение BookTime.
```

**Что нового в 1.0.0**
```text
Первый выпуск BookTime Business: журнал записей, клиенты, онлайн-запись, заказы мастерских и уведомления о новых записях.
```

---

## English (en)

**Name**
```text
BookTime Business
```

**Subtitle iOS** (≤ 30)
```text
Calendar, clients, bookings
```

**Short description Google Play** (≤ 80)
```text
Booking calendar, client base and online booking for salons and professionals
```

**Keywords iOS** (≤ 100)
```text
salon,scheduling,CRM,appointments,barbershop,beauty,clinic,reminders,staff,inventory,orders,Armenia
```

**Promotional text iOS** (≤ 170)
```text
Your booking calendar in your pocket: confirm requests with one tap, send free Telegram reminders and find a slot for any service in seconds.
```

**Description** (≤ 4000)
```text
BookTime Business is a booking calendar, client base and online booking tool for beauty salons, barbershops, clinics, independent professionals and workshops in Armenia. Everything works on your phone just like on a computer.

CALENDAR
• Columns per staff member, a day “Overview”, a “Timeline” for large salons and a day “List”.
• “+ Booking” right under your thumb. Book a regular client in 3 taps.
• “Find a slot”: pick a service and the calendar highlights every matching free slot across all staff.
• Accept client requests instantly or after the professional confirms them with one tap.
• Move bookings easily, undo a cancellation within 5 seconds and restore deleted bookings.
• Waitlist: when time frees up, the system offers it to people waiting.
• Day totals, “Close the day” and unclosed visits in one tap.

ONLINE BOOKING AND CATALOG
• A booking link for Instagram, WhatsApp and your website, plus a booking widget.
• Your salon in the BookTime catalog: nearby clients see your free slots and book themselves.
• A salon page in Armenian, Russian and English that search engines can find.
• Prepayment to your own bank details: the client transfers, you mark “money received”.
• Each professional has their own rules: confirmation, cancellation window, prepayment.

CLIENTS
• Client card: visit history, notes, documents and photos, no-shows.
• “Time to book”: who is due for a visit, based on each client’s rhythm.
• Free reminders via Telegram and push. Clients confirm visits with one tap.
• Move your client base from Excel and other systems without duplicates.
• For clinics: medical card and treatment plan.

ORDERS FOR WORKSHOPS
• Tailors, electronics repair, dry cleaning, detailing.
• Statuses “received → in progress → ready → handed over”.
• Tap “Ready” and the client automatically gets a message with a “where is my order” link.
• A receipt with a QR code and pick-up reminders after 3 and 7 days.

MONEY AND TEAM
• Cash desk and visit payments, staff payroll, inventory with expiry dates and a camera barcode scanner.
• Reports on revenue, staff and services.
• Staff roles and permissions, an action log, several locations in one account.

EVERY DAY
• Push notifications about new, moved and cancelled bookings.
• Links from notifications open right in the app.
• The whole business account in Armenian, Russian and English.
• Prices in drams, phone numbers +374.

Register your business at booktime.am/business. If you are a client, you need the BookTime app.
```

**What’s new in 1.0.0**
```text
The first release of BookTime Business: booking calendar, clients, online booking, workshop orders and new booking notifications.
```

---

## Հայերեն (hy) — только Google Play

**Անվանում**
```text
BookTime Business
```

**Կարճ նկարագրություն** (≤ 80)
```text
Գրանցումների մատյան, հաճախորդների բազա և առցանց գրանցում սրահների համար
```

**Նկարագրություն** (≤ 4000)
```text
BookTime Business-ը գրանցումների մատյան է, հաճախորդների բազա և առցանց գրանցում Հայաստանի գեղեցկության սրահների, բարբերշոփերի, կլինիկաների, անհատ վարպետների և արհեստանոցների համար։ Ամեն ինչ հեռախոսում աշխատում է այնպես, ինչպես համակարգչում։

ՄԱՏՅԱՆ
• Սյունակներ ըստ վարպետների, օրվա «Ակնարկ», «Ժապավեն» մեծ սրահի համար և օրվա «Ցուցակ»։
• «+ Գրանցում» կոճակը բութ մատի տակ։ Մշտական հաճախորդին կարող եք գրանցել 3 սեղմումով։
• «Գտնել ազատ ժամ». ընտրեցիք ծառայությունը, և մատյանը ցույց է տալիս բոլոր վարպետների համապատասխան ազատ ժամերը։
• Հաճախորդների հայտերը կարող եք ընդունել անմիջապես կամ վարպետի հաստատումով՝ մեկ կոճակով։
• Հեշտությամբ տեղափոխեք գրանցումները, չեղարկումը հետ բերեք 5 վայրկյանում և վերականգնեք ջնջվածը։
• Սպասման ցուցակ. երբ ժամ է ազատվում, համակարգն ինքն է այն առաջարկում սպասողներին։
• Օրվա արդյունքներ, «Փակել օրը», չփակված այցեր մեկ սեղմումով։

ԱՌՑԱՆՑ ԳՐԱՆՑՈՒՄ ԵՎ ԿԱՏԱԼՈԳ
• Գրանցման հղում Instagram-ի, WhatsApp-ի և կայքի համար, ինչպես նաև կոճակ-վիջեթ ձեր կայքի համար։
• Ձեր սրահը BookTime-ի կատալոգում. մոտակա հաճախորդները տեսնում են ձեր ազատ ժամերը և գրանցվում են ինքնուրույն։
• Սրահի էջ հայերեն, ռուսերեն և անգլերեն, որը գտնում են որոնողական համակարգերը։
• Կանխավճար ձեր վավերապայմաններով. հաճախորդը փոխանցում է, դուք նշում եք «գումարը ստացվել է»։
• Յուրաքանչյուր վարպետ ունի իր կանոնները՝ հաստատում, չեղարկման ժամկետ, կանխավճար։

ՀԱՃԱԽՈՐԴՆԵՐ
• Հաճախորդի քարտ. այցերի պատմություն, նշումներ, փաստաթղթեր և լուսանկարներ, չներկայանալու դեպքեր։
• «Ժամանակն է գրանցել». ում է պետք նորից գալ՝ ըստ հաճախորդի այցերի ռիթմի։
• Անվճար հիշեցումներ Telegram-ով և push ծանուցումով, հաճախորդը հաստատում է այցը մեկ կոճակով։
• Բազայի տեղափոխում Excel-ից և այլ համակարգերից՝ առանց կրկնօրինակների։
• Կլինիկաներում՝ բժշկական քարտ և բուժման պլան։

ՊԱՏՎԵՐՆԵՐ ԱՐՀԵՍՏԱՆՈՑՆԵՐԻ ՀԱՄԱՐ
• Կարի արհեստանոց, տեխնիկայի նորոգում, քիմմաքրում, դիթեյլինգ։
• Կարգավիճակներ «ընդունված → աշխատանքի մեջ → պատրաստ → հանձնված»։
• Սեղմեցիք «Պատրաստ է», և հաճախորդն ինքնաբերաբար ստանում է հաղորդագրություն և «որտեղ է իմ պատվերը» հղումը։
• QR կոդով անդորրագիր, պատվերը վերցնելու հիշեցում 3 և 7 օր անց։

ՓՈՂ ԵՎ ԹԻՄ
• Դրամարկղ և այցերի վճարումներ, վարպետների աշխատավարձ, պահեստ՝ պիտանելիության ժամկետներով և տեսախցիկով շտրիխկոդի սկաներով։
• Հաշվետվություններ ըստ հասույթի, վարպետների և ծառայությունների։
• Աշխատակիցների դերեր և իրավունքներ, գործողությունների մատյան, մի քանի մասնաճյուղ մեկ հաշվում։

ՀԱՐՄԱՐ ԱՄԵՆ ՕՐ
• Push ծանուցում նոր գրանցման, տեղափոխման և չեղարկման մասին։
• Ծանուցումների հղումները բացվում են հենց հավելվածում։
• Ամբողջ կաբինետը հայերեն, ռուսերեն և անգլերեն։
• Գները դրամով, հեռախոսները՝ +374։

Բիզնեսի գրանցումը՝ booktime.am/business էջում։ Եթե հաճախորդ եք, ձեզ պետք է BookTime հավելվածը։
```

**Ինչ նոր կա 1.0.0-ում**
```text
BookTime Business-ի առաջին թողարկումը՝ գրանցումների մատյան, հաճախորդներ, առցանց գրանցում, արհեստանոցների պատվերներ և ծանուցումներ նոր գրանցումների մասին։
```
