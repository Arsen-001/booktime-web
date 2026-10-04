# «BookTime» (клиенты) — тексты для App Store и Google Play

Bundle ID / applicationId: `am.booktime.app`. Открывает https://booktime.am/.
Лимиты проверены `node docs/store/check-limits.mjs` (длина в символах). Поля в блоках ```text``` копируются как есть.

**Языки магазинов.** В Google Play есть армянский (hy-AM): заводим hy-AM (основной), ru-RU, en-US.
В App Store Connect **армянского языка нет**. Основной язык — English (U.S.), плюс локализация Russian.
Армянский текст в App Store ставить некуда, поэтому армянские ключевые слова мы не дописываем в английские: в
английском поле им не место. Армянское описание пригодится в Google Play и на сайте.

Правила, которые учтены в текстах:
- в тексте для iOS нет слов «Android» и «Google Play»;
- нет имён конкурентов (App Store 2.3.7);
- нет цен и призывов платить вне приложения (3.1.1);
- нет «лучший» и «№1» без доказательств.

---

## Общие поля

| Поле | Значение |
|---|---|
| Категория App Store | Основная **Lifestyle**, дополнительная **Health & Fitness** |
| Категория Google Play | **Lifestyle** (Приложения → Образ жизни). Тег: «Салоны красоты». |
| Marketing URL (App Store) | https://booktime.am/ (hy: https://booktime.am/hy, en: https://booktime.am/en) |
| Support URL | https://booktime.am/terms#contacts (там почта, когда владелец её заполнит; нужна отдельная страница помощи — см. README) |
| Privacy Policy URL | https://booktime.am/privacy (en: https://booktime.am/en/privacy, hy: https://booktime.am/hy/privacy) |
| Удаление аккаунта (Google Play, Data safety) | https://booktime.am/account-deletion |
| Copyright (App Store) | © 2026 [Юридическое лицо] |
| Цена | Бесплатно, без встроенных покупок |
| Версия / сборка | 1.0.0 (1) |

### Возрастной рейтинг

**App Store** (анкета Age Rating, 2025):
- Насилие, мультяшное и реалистичное — нет.
- Сексуальное содержание, нагота — нет.
- Ненормативная лексика, грубый юмор — нет.
- Алкоголь, табак, наркотики — нет.
- Азартные игры, симулированные азартные игры, конкурсы — нет.
- Ужасы и пугающие темы — нет.
- Медицинская информация и лечение — нет. Приложение только записывает к врачу и не даёт советов.
- Unrestricted Web Access — **No**. Внутри открывается только booktime.am, остальные ссылки — в системном браузере.
- User-Generated Content — **Yes**. Это отзывы и оценки; их модерируют, а пожаловаться можно в один тап.
- Messaging and Chat — **No**. Клиент не переписывается с другими пользователями, только получает сообщения салона о записи.
- Advertising — **No**. Сторис и «выше в поиске» — это показ салонов внутри каталога, сторонней рекламы нет. Если Apple считает это рекламой, ответьте Yes: на рейтинг не влияет.
- Age Assurance / Parental Controls — нет.

Ожидаемый результат — **4+**. Если анкета из-за User-Generated Content поднимет рейтинг до 9+ или 13+, это нормально.

**Google Play** (анкета IARC):
- Категория — «Все остальные типы приложений» (All Other App Types).
- Насилие, страх, секс, ненормативная лексика, наркотики, азартные игры — нет.
- Пользователи могут общаться или обмениваться контентом — **да** (отзывы).
- Приложение передаёт личные данные третьим лицам — **да**: имя и телефон уходят салону, к которому вы записались.
- Приложение передаёт точное местоположение другим пользователям — **нет**.
- Цифровые покупки — **нет**.

Ожидаемый результат — **PEGI 3 / Everyone**, пометка «Users Interact».

Целевая аудитория (Play → Target audience) — **13–15, 16–17, 18+** (владелец 04.10.2026: ограничений по возрасту нет). Младше 13 не отмечать: иначе приложение попадает под программу Google Play для детей (Families) с отдельными требованиями к SDK и рекламе. Ребёнка младше 13 записывает родитель из своего аккаунта — так и в «Политике».

---

## Русский (ru)

**Название** (App Store ≤ 30, Google Play ≤ 30)
```text
BookTime: запись к мастерам
```
Если имя в App Store занято — `BookTime Армения`.

**Подзаголовок iOS** (≤ 30)
```text
Свободное время мастеров рядом
```

**Краткое описание Google Play** (≤ 80)
```text
Свободное время мастеров и салонов Еревана — запись онлайн за минуту
```

**Ключевые слова iOS** (≤ 100, через запятую без пробелов; слов из названия и подзаголовка не повторяем)
```text
маникюр,барбершоп,стрижка,парикмахер,массаж,косметолог,стоматолог,педикюр,ногти,брови,салон,Ереван
```

**Promotional text iOS** (≤ 170, меняется без новой версии)
```text
Кто свободен сегодня и завтра — в одном списке. Запишитесь к мастеру за минуту, получите напоминание в Telegram и подтвердите визит одной кнопкой.
```

**Описание** (App Store и Google Play, ≤ 4000)
```text
BookTime показывает, у каких мастеров и салонов Еревана есть свободное время сегодня и завтра, и позволяет записаться за минуту — без звонков и переписки.

КТО КОГДА СВОБОДЕН
• Маникюр и педикюр, барбершопы, парикмахерские, косметологи, массаж, стоматологи, фитнес, автомойки.
• Ателье, ремонт техники, химчистки и детейлинг — тоже здесь.
• Поиск «Что ищете?» понимает синонимы на армянском, русском и английском.
• Фильтры по району Еревана, «Свободно сегодня» и «Свободно завтра».
• «Рядом со мной» — ближайшие мастера, если разрешите доступ к месту.
• Смотреть мастеров, услуги, цены и свободное время можно без регистрации.

ЗАПИСЬ ЗА МИНУТУ
• Выберите услугу, мастера или «Любой мастер», день и время.
• Вход по номеру телефона: код приходит в Telegram или WhatsApp. Можно войти через Apple или Google.
• Можно записать не себя, а ребёнка или питомца.
• Выбирайте оттенок или вариант услуги прямо при записи.
• Если мастер просит предоплату, переведите её по реквизитам мастера и нажмите «Я оплатил».

НАПОМНИМ И ПОДСКАЖЕМ
• Пуш-уведомления и бесплатный Telegram-бот напоминают о записи за сутки и за 2 часа.
• Подтвердить визит можно одной кнопкой.
• Перенести или отменить запись можно в пару нажатий. Свободные окна того же мастера видны сразу.
• Нет подходящего времени? Встаньте в лист ожидания — сообщим, когда освободится.
• Подпишитесь на любимого мастера, чтобы видеть его новости и новые окна.

ВСЁ В ОДНОМ МЕСТЕ
• Предстоящие, прошедшие и отменённые записи.
• «Повторить» — снова к тому же мастеру в одно нажатие.
• Сертификаты, абонементы и карты лояльности салонов.
• Статус заказа в мастерской: принят, в работе, готов. Когда заказ готов, придёт уведомление.
• Дневник: сколько вы потратили на услуги.

ЧЕСТНО И УДОБНО
• Для клиентов бесплатно.
• Настоящие контакты салонов, звонок, WhatsApp, Telegram и Instagram в один тап.
• Материалы, стерилизация и дипломы на карточке мастера.
• Армянский, русский и английский. Крупный шрифт для тех, кому так удобнее.
• Номер телефона получает только салон, к которому вы записались.
• Удалить аккаунт можно в профиле.

Вы мастер или владелец салона? Скачайте BookTime Business — журнал записей, клиенты и онлайн-запись.
```

**Что нового в 1.0.0** (≤ 4000 iOS, ≤ 500 Play)
```text
Первый выпуск BookTime: поиск мастеров со свободным временем, запись за минуту, напоминания в приложении и в Telegram.
```

---

## English (en)

**Name** (≤ 30)
```text
BookTime: Book in Yerevan
```
Fallback: `BookTime Armenia`.

**Subtitle iOS** (≤ 30)
```text
Free slots at salons near you
```

**Short description Google Play** (≤ 80)
```text
See who has free time today in Yerevan salons and book online in a minute
```

**Keywords iOS** (≤ 100)
```text
manicure,barber,haircut,hairdresser,massage,beauty,dentist,nails,pedicure,brows,appointment,Armenia
```

**Promotional text iOS** (≤ 170)
```text
Who is free today and tomorrow — in one list. Book a professional in a minute, get a Telegram reminder and confirm your visit with one tap.
```

**Description** (≤ 4000)
```text
BookTime shows which professionals and salons in Yerevan have free time today and tomorrow and lets you book in a minute — no calls, no back-and-forth messages.

WHO IS FREE AND WHEN
• Manicure and pedicure, barbershops, hairdressers, cosmetologists, massage, dentists, fitness, car washes.
• Tailors, electronics repair, dry cleaning and detailing are here too.
• “What are you looking for?” search understands synonyms in Armenian, Russian and English.
• Filter by Yerevan district, “Free today” and “Free tomorrow”.
• “Near me” shows the closest professionals if you allow location access.
• Browse professionals, services, prices and free time without signing up.

BOOK IN A MINUTE
• Pick a service, a professional or “Any master”, a day and a time.
• Sign in with your phone number: the code arrives via Telegram or WhatsApp. Sign in with Apple or Google also works.
• Book for someone else, such as your child or your pet.
• Choose a shade or a service option while booking.
• If the professional asks for a prepayment, transfer it to their details and tap “I’ve paid”.

REMINDERS AND HELP
• Push notifications and a free Telegram bot remind you a day and 2 hours before.
• Confirm your visit with one tap.
• Reschedule or cancel in a couple of taps. The same professional’s free slots are shown right away.
• No suitable time? Join the waitlist and we’ll tell you when a slot opens up.
• Follow your favourite professionals to see their news and new slots.

EVERYTHING IN ONE PLACE
• Upcoming, past and cancelled bookings.
• “Repeat” books the same professional again in one tap.
• Gift certificates, memberships and loyalty cards from salons.
• Workshop order status: received, in progress, ready. You get a notification when the order is ready.
• A diary of how much you spend on services.

HONEST AND SIMPLE
• Free for clients.
• Real salon contacts: call, WhatsApp, Telegram and Instagram in one tap.
• Materials, sterilisation and diplomas on each professional’s card.
• Armenian, Russian and English. Large text for those who prefer it.
• Only the salon you book with receives your phone number.
• Delete your account any time in your profile.

Are you a professional or a salon owner? Get BookTime Business — booking calendar, clients and online booking.
```

**What’s new in 1.0.0**
```text
The first release of BookTime: find professionals with free time, book in a minute, get reminders in the app and in Telegram.
```

---

## Հայերեն (hy) — только Google Play (в App Store армянского нет)

**Անվանում** (≤ 30)
```text
BookTime՝ գրանցում վարպետին
```

**Կարճ նկարագրություն** (≤ 80)
```text
Երևանի վարպետների և սրահների ազատ ժամերը՝ առցանց գրանցում մեկ րոպեում
```

**Նկարագրություն** (≤ 4000)
```text
BookTime-ը ցույց է տալիս, թե Երևանի որ վարպետներն ու սրահներն ունեն ազատ ժամ այսօր և վաղը, և թույլ է տալիս գրանցվել մեկ րոպեում՝ առանց զանգերի և նամակագրության։

ՈՎ Է ԱԶԱՏ ԵՎ ԵՐԲ
• Մատնահարդարում և ոտնահարդարում, բարբերշոփեր, վարսավիրանոցներ, կոսմետոլոգներ, մերսում, ատամնաբույժներ, ֆիթնես, ավտոլվացումներ։
• Կարի արհեստանոցներ, տեխնիկայի նորոգում, քիմմաքրում և դիթեյլինգ՝ նույնպես այստեղ։
• «Ի՞նչ եք փնտրում» որոնումը հասկանում է հոմանիշները հայերեն, ռուսերեն և անգլերեն։
• Զտիչներ ըստ Երևանի թաղամասի, «Ազատ է այսօր» և «Ազատ է վաղը»։
• «Մոտակայքում»՝ մոտակա վարպետները, եթե թույլ տաք օգտագործել գտնվելու վայրը։
• Վարպետներին, ծառայություններն ու գները կարող եք դիտել առանց գրանցվելու։

ԳՐԱՆՑՈՒՄ ՄԵԿ ՐՈՊԵՈՒՄ
• Ընտրեք ծառայությունը, վարպետին կամ «Ցանկացած վարպետ», օրն ու ժամը։
• Մուտք հեռախոսահամարով. կոդը գալիս է Telegram-ով կամ WhatsApp-ով։ Կարելի է մուտք գործել Apple-ով կամ Google-ով։
• Կարող եք գրանցել ոչ թե ձեզ, այլ երեխային կամ ընտանի կենդանուն։
• Ընտրեք երանգը կամ ծառայության տարբերակը հենց գրանցման ժամանակ։
• Եթե վարպետը կանխավճար է խնդրում, փոխանցեք այն վարպետի վավերապայմաններով և սեղմեք «Ես վճարել եմ»։

ԿՀԻՇԵՑՆԵՆՔ ԵՎ ԿՕԳՆԵՆՔ
• Push ծանուցումները և անվճար Telegram բոտը հիշեցնում են գրանցման մասին մեկ օր և 2 ժամ առաջ։
• Այցը կարող եք հաստատել մեկ կոճակով։
• Գրանցումը տեղափոխել կամ չեղարկել կարող եք մի քանի սեղմումով։ Նույն վարպետի ազատ ժամերը տեսանելի են անմիջապես։
• Հարմար ժամ չկա՞։ Կանգնեք սպասման ցուցակում, և կտեղեկացնենք, երբ ժամ ազատվի։
• Հետևեք սիրելի վարպետին, որպեսզի տեսնեք նրա նորություններն ու նոր ազատ ժամերը։

ԱՄԵՆ ԻՆՉ ՄԵԿ ՏԵՂՈՒՄ
• Առաջիկա, անցած և չեղարկված գրանցումներ։
• «Կրկնել»՝ նորից նույն վարպետի մոտ մեկ սեղմումով։
• Սրահների նվեր-քարտեր, աբոնեմենտներ և հավատարմության քարտեր։
• Պատվերի կարգավիճակը արհեստանոցում՝ ընդունված, աշխատանքի մեջ, պատրաստ։ Երբ պատվերը պատրաստ է, կգա ծանուցում։
• Օրագիր՝ որքան եք ծախսել ծառայությունների վրա։

ԱԶՆԻՎ ԵՎ ՀԱՐՄԱՐ
• Հաճախորդների համար անվճար է։
• Սրահների իրական կոնտակտներ, զանգ, WhatsApp, Telegram և Instagram մեկ հպումով։
• Նյութերը, մանրէազերծումը և դիպլոմները՝ վարպետի քարտում։
• Հայերեն, ռուսերեն և անգլերեն։ Խոշոր տառատեսակ նրանց համար, ում այդպես հարմար է։
• Ձեր հեռախոսահամարը ստանում է միայն այն սրահը, որի մոտ գրանցվել եք։
• Հաշիվը կարող եք ջնջել պրոֆիլում։

Վարպե՞տ եք կամ սրահի սեփականատեր։ Ներբեռնեք BookTime Business-ը՝ գրանցումների մատյան, հաճախորդներ և առցանց գրանցում։
```

**Ինչ նոր կա 1.0.0-ում**
```text
BookTime-ի առաջին թողարկումը՝ ազատ ժամերով վարպետների որոնում, գրանցում մեկ րոպեում, հիշեցումներ հավելվածում և Telegram-ում։
```
