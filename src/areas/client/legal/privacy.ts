import type { LegalDocs } from '@/areas/client/legal/types';

/**
 * /privacy — политика конфиденциальности (04.10.2026). Описывает то, что код делает на самом деле
 * (сверено с booktime-backend и src/: вход по коду, Google/Apple, сессии, пуши FCM, бот Telegram, файлы на диске
 * в ЕС, бэкапы 14 дней, Sentry без личных данных, аналитика без cookie, удаление через 25 дней).
 * Поменялась обработка данных в коде — поправьте текст здесь и ответы магазинам в docs/store/privacy-answers.md.
 */
export const PRIVACY: LegalDocs = {
  ru: {
    title: 'Политика конфиденциальности',
    description: 'Какие данные собирают сайт booktime.am и приложения BookTime и BookTime Business, зачем, где хранят, кому передают и как удалить аккаунт.',
    updated: 'Действует с 4 октября 2026 г.',
    intro: [
      'BookTime — сервис онлайн-записи к мастерам, в салоны, клиники и мастерские Армении. Он работает на сайте booktime.am и в приложениях «BookTime» (для клиентов) и «BookTime Business» (для салонов и мастеров). Здесь простыми словами написано, какие данные мы получаем, зачем, где их храним и как вы можете ими управлять.',
      'Оператор персональных данных — {company}, {address}. Вопросы о данных: {email}. Мы обрабатываем данные по Закону Республики Армения «О защите персональных данных».',
    ],
    sections: [
      {
        id: 'roles',
        heading: 'Кто за какие данные отвечает',
        list: [
          'За ваш аккаунт BookTime, вход, записи через каталог, избранное, дневник, уведомления и отзывы отвечаем мы.',
          'Карточки клиентов, которые салон или мастер ведёт в BookTime Business (история визитов, заметки, медицинская карта, документы, фото работ), принадлежат салону. Салон решает, что в них записывать и сколько хранить, а мы храним и обрабатываем эти данные по его поручению. Чтобы изменить или удалить такую карточку, обратитесь в салон. Если салон не отвечает, напишите нам — поможем.',
        ],
      },
      {
        id: 'data',
        heading: 'Какие данные мы получаем',
        list: [
          'Аккаунт: номер телефона (армянский, +374) и имя. По желанию: фото профиля, пол, дата рождения, район и язык.',
          'Вход через Google или Apple: идентификатор аккаунта, адрес почты (если сервис его передал) и имя. Даже при таком входе номер телефона нужно один раз подтвердить кодом. Для входа через Apple мы храним зашифрованный токен Apple — он нужен, чтобы отозвать доступ, когда вы удалите аккаунт.',
          'Коды входа: храним только хеш кода, номер и IP-адрес. Через сутки эти данные удаляются.',
          'Сеанс входа: в cookie лежит случайный ключ, а в базе — только его хеш, IP-адрес и тип устройства. Сеанс действует 60 дней и продлевается, пока вы пользуетесь сервисом. Журнал входов (способ входа, IP-адрес, устройство) хранится год — он нужен для защиты аккаунта.',
          'Записи и активность: записи и их история, лист ожидания, избранное, дневник, оценки и отзывы, заказы (например, ремонт или химчистка), сертификаты, абонементы, карты лояльности, сообщения салону.',
          'Сотрудники салонов: имя, телефон, логин и хеш пароля, права доступа, журнал действий в кабинете (с IP-адресом и устройством).',
          'Карточки клиентов в кабинете салона: имя, телефон, почта, дата рождения, пол, заметки, метки, визиты, оплаты, отмеченные салоном. В клиниках также медицинская карта. Ещё документы и фото, которые загрузил салон.',
          'Уведомления: токен телефона для пушей (Firebase Cloud Messaging; на iPhone пуши идут через Apple Push Notification service). Если вы подключили Telegram-бота @booktime_am_bot, мы храним идентификатор чата, номер телефона и язык Telegram.',
          'Фото и файлы: фотографии пережимаются, а данные EXIF, включая место съёмки, удаляются. Фото салонов, мастеров и работ видны всем. Документы клиентов закрыты: их открывают только сотрудники салона с правом просмотра клиентов.',
          'Местоположение: только если вы сами разрешили его в браузере или приложении. Координаты нужны, чтобы показать ближайшие места, и не сохраняются.',
        ],
        after: ['Мы не читаем контакты телефона, не получаем данные банковских карт и не используем рекламные идентификаторы.'],
      },
      {
        id: 'purposes',
        heading: 'Зачем мы используем данные',
        list: [
          'Чтобы вы могли войти, записаться, перенести или отменить запись и видеть свои записи. Это исполнение договора с вами (пользовательского соглашения).',
          'Чтобы присылать коды входа, подтверждения и напоминания о записях.',
          'Чтобы салон мог вести журнал, клиентскую базу и заказы — по поручению салона.',
          'Чтобы защищать аккаунты и сервис от взлома, накрутки и злоупотреблений: лимиты кодов, журнал входов, журнал действий.',
          'Чтобы находить и исправлять ошибки и понимать, какие страницы помогают людям записаться. Для этого — только обезличенная статистика (см. ниже).',
          'Чтобы выполнять требования закона.',
        ],
        after: ['Согласие на обработку данных вы даёте при первом входе. Отозвать его можно, удалив аккаунт или написав нам.'],
      },
      {
        id: 'sharing',
        heading: 'Кому мы передаём данные',
        p: ['Мы не продаём данные и не передаём их рекламодателям. Данные получают только те, без кого сервис не работает:'],
        list: [
          'Салон или мастер, к которому вы записались: имя, телефон, выбранные услуги, время и комментарий к записи. Салоны, к которым вы не записывались, ваших данных не видят.',
          'Доставка кодов и сообщений: Telegram (Telegram Gateway — коды входа; бот — напоминания), Meta (WhatsApp Business — коды входа, если в Telegram код не доставлен). Им передаются номер телефона и текст сообщения.',
          'Вход и уведомления: Google (вход через Google, Firebase Cloud Messaging) и Apple (вход через Apple, пуши на iPhone).',
          'Хостинг: Railway (серверы и база данных в ЕС, Нидерланды) и Vercel (сайт и его доставка).',
          'Мониторинг ошибок: Sentry (хранение в ЕС). Перед отправкой из отчётов убираются данные пользователя, cookie, заголовки и тело запроса.',
          'Статистика посещений: Vercel Web Analytics и PostHog (хранение в ЕС). Имена, телефоны и тексты поиска туда не попадают, IP-адрес не сохраняется.',
          'Государственные органы — только по законному требованию.',
        ],
      },
      {
        id: 'storage',
        heading: 'Где и сколько хранятся данные',
        list: [
          'Сервер, база данных и загруженные файлы находятся в дата-центре в Евросоюзе (Нидерланды).',
          'Каждую ночь делается копия базы данных. Копии хранятся 14 дней, потом удаляются.',
          'Данные аккаунта хранятся, пока он существует. После удаления аккаунта они удаляются или обезличиваются (подробнее — в разделе «Удаление аккаунта»), а из резервных копий исчезают в течение следующих 14 дней.',
          'Коды входа хранятся сутки. Журнал входов — год. Закрытые сеансы удаляются через 30–90 дней.',
          'Записи и карточки клиентов в базе салона хранятся, пока салон пользуется BookTime. Когда салон уходит, ему передаётся выгрузка, а через 90 дней после этого его клиентская база обезличивается.',
        ],
      },
      {
        id: 'cookies',
        heading: 'Cookie и память браузера',
        list: [
          'Cookie сеанса (httpOnly) — чтобы вы оставались в аккаунте.',
          'Cookie настроек: язык, тема оформления, вид меню кабинета.',
          'Память браузера (localStorage): настройки экранов и случайный номер для обезличенной статистики. По этому номеру шаги одного визита складываются вместе, и он не связан с вашим именем или телефоном.',
        ],
        after: [
          'Рекламных и сторонних отслеживающих cookie нет. Если в браузере включены «Не отслеживать» (Do Not Track) или Global Privacy Control, статистика не собирается совсем.',
        ],
      },
      {
        id: 'rights',
        heading: 'Ваши права',
        list: [
          'Узнать, какие данные о вас есть, и получить их копию.',
          'Исправить данные. Имя и фото можно поменять в профиле.',
          'Удалить аккаунт прямо в приложении или на сайте, а также отозвать согласие.',
          'Попросить временно заблокировать обработку данных. В кабинете салона это кнопка «Запрос на блокировку данных» в разделе «Личный кабинет → Конфиденциальность».',
          'Отписаться от новостей салона в профиле. Напоминания о ваших записях приходят всегда, пока запись в силе.',
          'Пожаловаться в уполномоченный орган Республики Армения по защите персональных данных.',
        ],
        after: [
          'Напишите на {email} с номера, к которому привязан аккаунт, или укажите этот номер в письме. Мы можем попросить подтвердить номер кодом и ответим в течение 30 дней. Владельцы салонов могут сами выгрузить свою клиентскую базу в кабинете.',
        ],
      },
      {
        id: 'deletion',
        heading: 'Удаление аккаунта',
        p: [
          'Приложение «BookTime» и сайт: «Профиль» → «Удалить аккаунт». Приложение «BookTime Business»: «Настройки» → «Личный кабинет» → «Управление аккаунтом» → «Удалить мой аккаунт».',
          'Аккаунт удаляется через 25 дней после запроса. Эти дни нужны, чтобы вы могли передумать, а салон успел передать права владельца. В кабинете салона удаление можно отменить, в приложении клиента — написав нам. Затем мы удаляем имя, телефон, фото, пол, дату рождения, избранное, дневник, связки с Google и Apple, токены уведомлений и сеансы, отзываем вход через Apple, а лист ожидания обезличиваем. Записи и карточки у салонов остаются у салонов, но уже без связи с вашим аккаунтом. Оценки остаются в рейтинге мастера без вашего имени.',
          'Подробная инструкция — на странице «Удаление аккаунта».',
        ],
      },
      {
        id: 'security',
        heading: 'Как мы защищаем данные',
        list: [
          'Сайт, приложения и сервер общаются только по HTTPS.',
          'Коды входа, пароли и ключи сеансов хранятся только в виде хешей, токены Apple — в зашифрованном виде.',
          'Сотрудники салона видят только то, что разрешил владелец: телефоны клиентов, выгрузку базы, документы.',
          'Важные действия в кабинете записываются в журнал. Доступ к серверам есть только у ответственных людей.',
        ],
      },
      {
        id: 'children',
        heading: 'Дети',
        p: [
          'Ограничений по возрасту в сервисе нет: подростки записываются сами. Аккаунт можно создать с 13 лет. Ребёнка младше 13 лет записывает к мастеру или врачу родитель из своего аккаунта. Если вы узнали, что ребёнок младше 13 лет создал аккаунт сам, напишите нам — мы его удалим.',
        ],
      },
      {
        id: 'changes',
        heading: 'Изменения политики',
        p: [
          'Если мы изменим, какие данные и зачем обрабатываем, мы обновим эту страницу и дату вверху, а о важных изменениях предупредим в приложении заранее.',
        ],
      },
      {
        id: 'contacts',
        heading: 'Контакты',
        p: ['{company}, {address}. Почта по вопросам данных: {email}.'],
      },
    ],
  },

  en: {
    title: 'Privacy Policy',
    description:
      'What data booktime.am and the BookTime and BookTime Business apps collect, why, where it is stored, who receives it and how to delete your account.',
    updated: 'Effective from 4 October 2026',
    intro: [
      'BookTime is an online booking service for beauty professionals, salons, clinics and workshops in Armenia. It runs on booktime.am and in two apps: “BookTime” for clients and “BookTime Business” for salons and professionals. This page explains in plain words what data we receive, why, where we keep it and how you can control it.',
      'The data controller is {company}, {address}. Questions about your data: {email}. We process data under the Law of the Republic of Armenia “On Protection of Personal Data”.',
    ],
    sections: [
      {
        id: 'roles',
        heading: 'Who is responsible for which data',
        list: [
          'We are responsible for your BookTime account, sign-in, bookings made through the catalog, favourites, diary, notifications and reviews.',
          'Client records that a salon or professional keeps in BookTime Business (visit history, notes, medical card, documents, photos of work) belong to that business. The business decides what to record and how long to keep it. We store and process this data on its behalf. To change or delete such a record, contact the business. If it does not respond, write to us and we will help.',
        ],
      },
      {
        id: 'data',
        heading: 'What data we receive',
        list: [
          'Account: phone number (Armenian, +374) and name. Optional: profile photo, gender, date of birth, district, language.',
          'Sign in with Google or Apple: the account identifier, the email address (if the provider shares it) and your name. You still confirm your phone number with a code once. For Sign in with Apple we keep an encrypted Apple token so that we can revoke access when you delete your account.',
          'Sign-in codes: we store only a hash of the code, the phone number and the IP address. They are deleted after one day.',
          'Session: a random key in a cookie. Our database keeps only its hash, the IP address and the device type. A session lasts 60 days and is extended while you use the service. The sign-in log (method, IP address, device) is kept for one year to protect your account.',
          'Bookings and activity: bookings and their history, waitlist, favourites, diary, ratings and reviews, orders (for example repairs or dry cleaning), gift certificates, memberships, loyalty cards, messages to a business.',
          'Business staff: name, phone, login and password hash, permissions, and the log of actions in the business account (with IP address and device).',
          'Client records in a business account: name, phone, email, date of birth, gender, notes, tags, visits and payments the business recorded. For clinics, also a medical card. Plus documents and photos the business uploads.',
          'Notifications: the device push token (Firebase Cloud Messaging; on iPhone via Apple Push Notification service). If you connect our Telegram bot @booktime_am_bot, we store the chat ID, phone number and Telegram language.',
          'Photos and files: photos are re-encoded and EXIF data, including location, is removed. Photos of businesses, professionals and their work are public. Client documents are private: only business staff with permission to view clients can open them.',
          'Location: only if you allow it in your browser or the app. We use it to show nearby places and do not store it.',
        ],
        after: ['We do not read your phone contacts, we do not receive bank card data and we do not use advertising identifiers.'],
      },
      {
        id: 'purposes',
        heading: 'Why we use data',
        list: [
          'To let you sign in, book, reschedule or cancel and see your bookings. This is performance of our contract with you (the Terms of Use).',
          'To send sign-in codes, confirmations and booking reminders.',
          'To let a business keep its calendar, client base and orders, on the business’s behalf.',
          'To protect accounts and the service from hacking, abuse and fraud: code limits, the sign-in log, the action log.',
          'To find and fix errors and understand which pages help people book. For this we use only anonymous statistics (see below).',
          'To comply with the law.',
        ],
        after: ['You give consent to data processing when you first sign in. You can withdraw it by deleting your account or writing to us.'],
      },
      {
        id: 'sharing',
        heading: 'Who receives data',
        p: ['We do not sell data and do not share it with advertisers. Data goes only to those the service cannot work without:'],
        list: [
          'The business you book with: your name, phone, chosen services, time and booking comment. Businesses you have not booked with do not see your data.',
          'Delivery of codes and messages: Telegram (Telegram Gateway for sign-in codes; the bot for reminders), Meta (WhatsApp Business, for sign-in codes if Telegram could not deliver). They receive the phone number and the message text.',
          'Sign-in and notifications: Google (Sign in with Google, Firebase Cloud Messaging) and Apple (Sign in with Apple, iPhone push notifications).',
          'Hosting: Railway (servers and database in the EU, the Netherlands) and Vercel (website delivery).',
          'Error monitoring: Sentry (EU data storage). User data, cookies, headers and request bodies are removed before a report is sent.',
          'Visit statistics: Vercel Web Analytics and PostHog (EU data storage). Names, phone numbers and search text are never sent, and IP addresses are not stored.',
          'Public authorities, only on a lawful request.',
        ],
      },
      {
        id: 'storage',
        heading: 'Where and for how long data is stored',
        list: [
          'Our server, database and uploaded files are hosted in a data centre in the European Union (the Netherlands).',
          'The database is backed up every night. Backups are kept for 14 days and then deleted.',
          'Account data is kept while the account exists. After deletion it is erased or anonymised (see “Account deletion”), and it disappears from backups within the next 14 days.',
          'Sign-in codes are kept for one day, the sign-in log for one year. Closed sessions are removed after 30–90 days.',
          'Bookings and client records in a business’s base are kept while the business uses BookTime. When a business leaves, it receives an export, and 90 days later its client base is anonymised.',
        ],
      },
      {
        id: 'cookies',
        heading: 'Cookies and browser storage',
        list: [
          'Session cookie (httpOnly), to keep you signed in.',
          'Preference cookies: language, theme, business menu layout.',
          'Browser storage (localStorage): screen preferences and a random ID for anonymous statistics. The ID only groups the steps of one visit and is not linked to your name or phone.',
        ],
        after: [
          'There are no advertising or third-party tracking cookies. If your browser sends Do Not Track or Global Privacy Control, no statistics are collected at all.',
        ],
      },
      {
        id: 'rights',
        heading: 'Your rights',
        list: [
          'Find out what data we hold about you and get a copy.',
          'Correct your data. You can change your name and photo in your profile.',
          'Delete your account in the app or on the website, and withdraw consent.',
          'Ask us to temporarily block processing. In the business account, use “Request a data block” under “Personal account → Privacy”.',
          'Unsubscribe from a business’s news in your profile. Reminders about your bookings are always sent while the booking is active.',
          'Complain to the authorised body for personal data protection of the Republic of Armenia.',
        ],
        after: [
          'Write to {email} from the phone number linked to your account, or include that number in your message. We may ask you to confirm the number with a code. We reply within 30 days. Business owners can export their client base themselves in the business account.',
        ],
      },
      {
        id: 'deletion',
        heading: 'Account deletion',
        p: [
          'BookTime app and website: “Profile” → “Delete account”. BookTime Business app: “Settings” → “Personal account” → “Account management” → “Delete my account”.',
          'The account is deleted 25 days after the request. The delay lets you change your mind and lets a business transfer ownership. You can cancel in the business account, or in the client app by writing to us. We then erase your name, phone, photo, gender, date of birth, favourites, diary, Google and Apple links, push tokens and sessions. We revoke Sign in with Apple and anonymise waitlist entries. Bookings and client records at businesses stay with those businesses, no longer linked to your account. Ratings stay in a professional’s score without your name.',
          'Step-by-step instructions are on the “Account deletion” page.',
        ],
      },
      {
        id: 'security',
        heading: 'How we protect data',
        list: [
          'The website, apps and server communicate only over HTTPS.',
          'Sign-in codes, passwords and session keys are stored only as hashes, and Apple tokens are encrypted.',
          'Business staff see only what the owner allows: client phone numbers, base export, documents.',
          'Important actions in the business account are logged. Only responsible people have access to the servers.',
        ],
      },
      {
        id: 'children',
        heading: 'Children',
        p: [
          'The service has no age restrictions: teenagers can book on their own. You can create an account from age 13. A child under 13 is booked by a parent from the parent’s own account. If you learn that a child under 13 created an account, write to us and we will delete it.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes to this policy',
        p: [
          'If we change what data we process or why, we will update this page and the date at the top, and we will warn you in the app in advance about important changes.',
        ],
      },
      {
        id: 'contacts',
        heading: 'Contacts',
        p: ['{company}, {address}. Email for data questions: {email}.'],
      },
    ],
  },

  hy: {
    title: 'Գաղտնիության քաղաքականություն',
    description:
      'Ինչ տվյալներ են հավաքում booktime.am կայքը և BookTime ու BookTime Business հավելվածները, ինչու, որտեղ են պահվում, ում են փոխանցվում և ինչպես ջնջել հաշիվը։',
    updated: 'Գործում է 2026 թ. հոկտեմբերի 4-ից',
    intro: [
      'BookTime-ը Հայաստանում վարպետների, սրահների, կլինիկաների և արհեստանոցների մոտ առցանց գրանցվելու ծառայություն է։ Այն աշխատում է booktime.am կայքում և երկու հավելվածում՝ «BookTime» (հաճախորդների համար) և «BookTime Business» (սրահների ու վարպետների համար)։ Այստեղ պարզ բառերով գրված է, թե ինչ տվյալներ ենք ստանում, ինչու, որտեղ ենք պահում և ինչպես կարող եք դրանք կառավարել։',
      'Անձնական տվյալների մշակող՝ {company}, {address}։ Տվյալների վերաբերյալ հարցերի համար՝ {email}։ Տվյալները մշակում ենք «Անձնական տվյալների պաշտպանության մասին» ՀՀ օրենքի համաձայն։',
    ],
    sections: [
      {
        id: 'roles',
        heading: 'Ով ինչ տվյալների համար է պատասխանատու',
        list: [
          'Ձեր BookTime հաշվի, մուտքի, կատալոգով կատարված գրանցումների, ընտրյալների, օրագրի, ծանուցումների և կարծիքների համար պատասխանատու ենք մենք։',
          'Հաճախորդների քարտերը, որոնք սրահը կամ վարպետը վարում է BookTime Business-ում (այցերի պատմություն, նշումներ, բժշկական քարտ, փաստաթղթեր, աշխատանքների լուսանկարներ), պատկանում են սրահին։ Սրահն է որոշում, թե ինչ գրանցել և որքան պահել, իսկ մենք այդ տվյալները պահում և մշակում ենք նրա հանձնարարությամբ։ Նման քարտը փոխելու կամ ջնջելու համար դիմեք սրահին։ Եթե սրահը չի պատասխանում, գրեք մեզ, կօգնենք։',
        ],
      },
      {
        id: 'data',
        heading: 'Ինչ տվյալներ ենք ստանում',
        list: [
          'Հաշիվ՝ հեռախոսահամար (հայկական, +374) և անուն։ Ըստ ցանկության՝ պրոֆիլի լուսանկար, սեռ, ծննդյան օր, թաղամաս, լեզու։',
          'Մուտք Google-ով կամ Apple-ով՝ հաշվի նույնացուցիչը, էլ. հասցեն (եթե ծառայությունը այն փոխանցել է) և անունը։ Այդ դեպքում էլ հեռախոսահամարը պետք է մեկ անգամ հաստատել կոդով։ Apple-ով մուտքի համար պահում ենք Apple-ի գաղտնագրված տոկենը, որպեսզի հաշիվը ջնջելիս չեղարկենք մուտքի թույլտվությունը։',
          'Մուտքի կոդեր՝ պահում ենք միայն կոդի հեշը, համարը և IP հասցեն։ Մեկ օր անց դրանք ջնջվում են։',
          'Մուտքի սեանս՝ cookie-ում պատահական բանալի է, իսկ բազայում պահվում են միայն դրա հեշը, IP հասցեն և սարքի տեսակը։ Սեանսը գործում է 60 օր և երկարաձգվում է, քանի դեռ օգտվում եք ծառայությունից։ Մուտքերի մատյանը (մուտքի եղանակ, IP հասցե, սարք) պահվում է մեկ տարի՝ հաշվի պաշտպանության համար։',
          'Գրանցումներ և գործողություններ՝ գրանցումները և դրանց պատմությունը, սպասման ցուցակը, ընտրյալները, օրագիրը, գնահատականներն ու կարծիքները, պատվերները (օրինակ՝ նորոգում կամ քիմմաքրում), նվեր-քարտերը, աբոնեմենտները, հավատարմության քարտերը, հաղորդագրությունները սրահին։',
          'Սրահների աշխատակիցներ՝ անուն, հեռախոս, մուտքանուն և գաղտնաբառի հեշ, մուտքի իրավունքներ, կաբինետում կատարված գործողությունների մատյան (IP հասցեով և սարքով)։',
          'Հաճախորդների քարտեր սրահի կաբինետում՝ անուն, հեռախոս, էլ. փոստ, ծննդյան օր, սեռ, նշումներ, պիտակներ, սրահի նշած այցերն ու վճարումները։ Կլինիկաներում նաև բժշկական քարտ։ Ինչպես նաև սրահի վերբեռնած փաստաթղթերն ու լուսանկարները։',
          'Ծանուցումներ՝ հեռախոսի տոկենը push ծանուցումների համար (Firebase Cloud Messaging, iPhone-ում՝ Apple Push Notification service-ի միջոցով)։ Եթե միացրել եք @booktime_am_bot Telegram բոտը, պահում ենք զրույցի նույնացուցիչը, հեռախոսահամարը և Telegram-ի լեզուն։',
          'Լուսանկարներ և ֆայլեր՝ լուսանկարները վերամշակվում են, իսկ EXIF տվյալները, այդ թվում նկարահանման վայրը, հեռացվում են։ Սրահների, վարպետների և աշխատանքների լուսանկարները տեսանելի են բոլորին։ Հաճախորդների փաստաթղթերը փակ են. դրանք բացում են միայն հաճախորդներին դիտելու իրավունք ունեցող աշխատակիցները։',
          'Գտնվելու վայր՝ միայն եթե ինքներդ եք թույլատրել դիտարկիչում կամ հավելվածում։ Կոորդինատներն օգտագործում ենք մոտակա վայրերը ցույց տալու համար և չենք պահում։',
        ],
        after: ['Մենք չենք կարդում հեռախոսի կոնտակտները, չենք ստանում բանկային քարտերի տվյալներ և չենք օգտագործում գովազդային նույնացուցիչներ։'],
      },
      {
        id: 'purposes',
        heading: 'Ինչի համար ենք օգտագործում տվյալները',
        list: [
          'Որպեսզի կարողանաք մուտք գործել, գրանցվել, տեղափոխել կամ չեղարկել գրանցումը և տեսնել ձեր գրանցումները։ Սա ձեզ հետ պայմանագրի (օգտագործման պայմանների) կատարումն է։',
          'Մուտքի կոդեր, հաստատումներ և գրանցումների հիշեցումներ ուղարկելու համար։',
          'Որպեսզի սրահը վարի իր մատյանը, հաճախորդների բազան և պատվերները՝ սրահի հանձնարարությամբ։',
          'Հաշիվներն ու ծառայությունը կոտրումից, խարդախությունից և չարաշահումներից պաշտպանելու համար. կոդերի սահմանափակումներ, մուտքերի մատյան, գործողությունների մատյան։',
          'Սխալները գտնելու և ուղղելու, ինչպես նաև հասկանալու համար, թե որ էջերն են օգնում մարդկանց գրանցվել։ Դրա համար՝ միայն անանուն վիճակագրություն (տե՛ս ստորև)։',
          'Օրենքի պահանջները կատարելու համար։',
        ],
        after: ['Տվյալների մշակման համաձայնությունը տալիս եք առաջին մուտքի ժամանակ։ Այն կարող եք հետ վերցնել՝ ջնջելով հաշիվը կամ գրելով մեզ։'],
      },
      {
        id: 'sharing',
        heading: 'Ում ենք փոխանցում տվյալները',
        p: ['Մենք չենք վաճառում տվյալները և չենք փոխանցում գովազդատուներին։ Տվյալները ստանում են միայն նրանք, առանց որոնց ծառայությունը չի աշխատի.'],
        list: [
          'Սրահը կամ վարպետը, որի մոտ գրանցվել եք՝ անունը, հեռախոսը, ընտրված ծառայությունները, ժամը և մեկնաբանությունը։ Սրահները, որոնց մոտ չեք գրանցվել, ձեր տվյալները չեն տեսնում։',
          'Կոդերի և հաղորդագրությունների առաքում՝ Telegram (Telegram Gateway՝ մուտքի կոդեր, բոտ՝ հիշեցումներ), Meta (WhatsApp Business՝ մուտքի կոդեր, եթե Telegram-ով կոդը չի հասել)։ Նրանք ստանում են հեռախոսահամարը և հաղորդագրության տեքստը։',
          'Մուտք և ծանուցումներ՝ Google (մուտք Google-ով, Firebase Cloud Messaging) և Apple (մուտք Apple-ով, push ծանուցումներ iPhone-ում)։',
          'Հոսթինգ՝ Railway (սերվերներ և տվյալների բազա ԵՄ-ում, Նիդեռլանդներ) և Vercel (կայքի առաքում)։',
          'Սխալների մոնիթորինգ՝ Sentry (պահպանում ԵՄ-ում)։ Ուղարկելուց առաջ հաշվետվություններից հեռացվում են օգտատիրոջ տվյալները, cookie-ները, գլխագրերը և հարցման մարմինը։',
          'Այցելությունների վիճակագրություն՝ Vercel Web Analytics և PostHog (պահպանում ԵՄ-ում)։ Անուններ, հեռախոսահամարներ և որոնման տեքստեր այնտեղ չեն ուղարկվում, IP հասցեն չի պահվում։',
          'Պետական մարմիններ՝ միայն օրինական պահանջով։',
        ],
      },
      {
        id: 'storage',
        heading: 'Որտեղ և որքան են պահվում տվյալները',
        list: [
          'Սերվերը, տվյալների բազան և վերբեռնված ֆայլերը գտնվում են Եվրամիության տվյալների կենտրոնում (Նիդեռլանդներ)։',
          'Ամեն գիշեր ստեղծվում է բազայի պատճեն։ Պատճենները պահվում են 14 օր, հետո ջնջվում են։',
          'Հաշվի տվյալները պահվում են, քանի դեռ հաշիվը կա։ Հաշիվը ջնջելուց հետո դրանք ջնջվում կամ անանունացվում են (մանրամասն՝ «Հաշվի ջնջում» բաժնում), իսկ պահուստային պատճեններից անհետանում են հաջորդ 14 օրվա ընթացքում։',
          'Մուտքի կոդերը պահվում են մեկ օր, մուտքերի մատյանը՝ մեկ տարի։ Փակված սեանսները ջնջվում են 30–90 օր անց։',
          'Սրահի բազայում գրանցումներն ու հաճախորդների քարտերը պահվում են, քանի դեռ սրահն օգտվում է BookTime-ից։ Երբ սրահը հեռանում է, նրան տրվում է արտահանումը, իսկ դրանից 90 օր անց նրա հաճախորդների բազան անանունացվում է։',
        ],
      },
      {
        id: 'cookies',
        heading: 'Cookie-ներ և դիտարկիչի հիշողություն',
        list: [
          'Սեանսի cookie (httpOnly)՝ որպեսզի մնաք հաշվում։',
          'Կարգավորումների cookie-ներ՝ լեզու, ձևավորման թեմա, կաբինետի ընտրացանկի տեսք։',
          'Դիտարկիչի հիշողություն (localStorage)՝ էկրանների կարգավորումներ և պատահական համար անանուն վիճակագրության համար։ Այդ համարով միայն մեկ այցի քայլերն են միավորվում, և այն կապված չէ ձեր անվան կամ հեռախոսի հետ։',
        ],
        after: [
          'Գովազդային և երրորդ կողմի հետևող cookie-ներ չկան։ Եթե դիտարկիչում միացված է «Չհետևել» (Do Not Track) կամ Global Privacy Control, վիճակագրություն ընդհանրապես չի հավաքվում։',
        ],
      },
      {
        id: 'rights',
        heading: 'Ձեր իրավունքները',
        list: [
          'Իմանալ, թե ինչ տվյալներ կան ձեր մասին, և ստանալ դրանց պատճենը։',
          'Ուղղել տվյալները։ Անունն ու լուսանկարը կարող եք փոխել պրոֆիլում։',
          'Ջնջել հաշիվը հավելվածում կամ կայքում, ինչպես նաև հետ վերցնել համաձայնությունը։',
          'Խնդրել ժամանակավորապես արգելափակել տվյալների մշակումը։ Սրահի կաբինետում դա «Տվյալների արգելափակման հայտ» կոճակն է «Անձնական էջ → Գաղտնիություն» բաժնում։',
          'Պրոֆիլում հրաժարվել սրահի նորություններից։ Ձեր գրանցումների հիշեցումները գալիս են միշտ, քանի դեռ գրանցումն ուժի մեջ է։',
          'Բողոքել ՀՀ անձնական տվյալների պաշտպանության լիազոր մարմնին։',
        ],
        after: [
          'Գրեք {email} հասցեին այն համարից, որին կապված է հաշիվը, կամ նամակում նշեք այդ համարը։ Կարող ենք խնդրել հաստատել համարը կոդով։ Կպատասխանենք 30 օրվա ընթացքում։ Սրահների սեփականատերերը կարող են իրենք արտահանել հաճախորդների բազան կաբինետից։',
        ],
      },
      {
        id: 'deletion',
        heading: 'Հաշվի ջնջում',
        p: [
          '«BookTime» հավելված և կայք՝ «Պրոֆիլ» → «Ջնջել հաշիվը»։ «BookTime Business» հավելված՝ «Կարգավորումներ» → «Անձնական էջ» → «Հաշվի կառավարում» → «Ջնջել իմ հաշիվը»։',
          'Հաշիվը ջնջվում է հարցումից 25 օր անց։ Այդ օրերը պետք են, որպեսզի կարողանաք մտափոխվել, իսկ սրահը հասցնի փոխանցել սեփականատիրոջ իրավունքները։ Սրահի կաբինետում ջնջումը կարելի է չեղարկել, հաճախորդի հավելվածում՝ գրելով մեզ։ Այնուհետև ջնջում ենք անունը, հեռախոսը, լուսանկարը, սեռը, ծննդյան օրը, ընտրյալները, օրագիրը, Google-ի և Apple-ի կապերը, ծանուցումների տոկեններն ու սեանսները, չեղարկում ենք Apple-ով մուտքը, իսկ սպասման ցուցակն անանունացնում ենք։ Սրահներում եղած գրանցումներն ու քարտերը մնում են սրահներում, բայց այլևս կապված չեն ձեր հաշվի հետ։ Գնահատականները մնում են վարպետի վարկանիշում՝ առանց ձեր անվան։',
          'Մանրամասն հրահանգը՝ «Հաշվի ջնջում» էջում։',
        ],
      },
      {
        id: 'security',
        heading: 'Ինչպես ենք պաշտպանում տվյալները',
        list: [
          'Կայքը, հավելվածները և սերվերը շփվում են միայն HTTPS-ով։',
          'Մուտքի կոդերը, գաղտնաբառերը և սեանսների բանալիները պահվում են միայն հեշերի տեսքով, Apple-ի տոկենները՝ գաղտնագրված։',
          'Սրահի աշխատակիցները տեսնում են միայն այն, ինչ թույլ է տվել սեփականատերը՝ հաճախորդների հեռախոսները, բազայի արտահանումը, փաստաթղթերը։',
          'Կաբինետում կարևոր գործողությունները գրանցվում են մատյանում։ Սերվերներին հասանելիություն ունեն միայն պատասխանատու մարդիկ։',
        ],
      },
      {
        id: 'children',
        heading: 'Երեխաներ',
        p: [
          'Ծառայությունում տարիքային սահմանափակումներ չկան․ դեռահասները կարող են գրանցվել ինքնուրույն։ Հաշիվ կարելի է ստեղծել 13 տարեկանից։ 13 տարեկանից փոքր երեխային վարպետի կամ բժշկի մոտ գրանցում է ծնողը՝ իր հաշվից։ Եթե իմացել եք, որ 13 տարեկանից փոքր երեխան ինքն է հաշիվ ստեղծել, գրեք մեզ, և մենք այն կջնջենք։',
        ],
      },
      {
        id: 'changes',
        heading: 'Քաղաքականության փոփոխություններ',
        p: [
          'Եթե փոխենք, թե ինչ տվյալներ և ինչու ենք մշակում, կթարմացնենք այս էջը և վերևի ամսաթիվը, իսկ կարևոր փոփոխությունների մասին նախապես կզգուշացնենք հավելվածում։',
        ],
      },
      {
        id: 'contacts',
        heading: 'Կոնտակտներ',
        p: ['{company}, {address}։ Տվյալների հարցերով էլ. փոստ՝ {email}։'],
      },
    ],
  },
};
