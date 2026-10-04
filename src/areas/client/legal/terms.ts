import type { LegalDocs } from '@/areas/client/legal/types';

/**
 * /terms — пользовательское соглашение (04.10.2026): клиенты (запись) и бизнес (кабинет, подписка).
 * Цены не дублируем — они на /business. Тексты согласовываются с юристом владельца.
 */
export const TERMS: LegalDocs = {
  ru: {
    title: 'Пользовательское соглашение',
    description: 'Условия использования BookTime: запись к мастерам и в салоны, аккаунт, отзывы, правила для салонов и мастеров в BookTime Business.',
    updated: 'Действует с 4 октября 2026 г.',
    intro: [
      'Это соглашение между вами и {company} ({address}) об использовании сервиса BookTime: сайта booktime.am и приложений «BookTime» и «BookTime Business». Когда вы входите в сервис и отмечаете согласие, вы принимаете эти условия и Политику конфиденциальности.',
    ],
    sections: [
      {
        id: 'service',
        heading: 'Что такое BookTime',
        list: [
          'Для клиентов BookTime — каталог мастеров, салонов, клиник и мастерских Армении и онлайн-запись к ним. Для клиентов сервис бесплатный.',
          'Для бизнеса BookTime Business — журнал записей, клиентская база, онлайн-запись, заказы, уведомления клиентам, касса и отчёты.',
          'Услуги оказывает салон или мастер, а не BookTime. Цены, длительность, правила отмены и качество работы определяет он, и договор об услуге вы заключаете с ним. Мы даём инструмент для записи и связи.',
        ],
      },
      {
        id: 'account',
        heading: 'Аккаунт',
        list: [
          'Вход — по номеру телефона и одноразовому коду, который приходит в Telegram, WhatsApp или SMS. Можно также войти через Google или Apple.',
          'Указывайте своё настоящее имя и свой номер. Один аккаунт — для одного человека. Не передавайте коды входа другим.',
          'Вы отвечаете за действия, совершённые из вашего аккаунта. Если думаете, что в него вошёл кто-то чужой, сразу напишите нам.',
          'Удалить аккаунт можно в любой момент в приложении или на сайте (см. страницу «Удаление аккаунта»).',
        ],
      },
      {
        id: 'booking',
        heading: 'Запись',
        list: [
          'Запись появляется в журнале салона сразу. Если салон подтверждает записи вручную, мы сообщим, когда он подтвердит.',
          'Перенести или отменить запись можно в разделе «Записи» в пределах срока, который установил салон. Если срок прошёл, свяжитесь с салоном напрямую.',
          'Если вы не пришли и не отменили запись, салон может отметить это у себя. Салон вправе ограничить онлайн-запись тем, кто часто не приходит.',
          'Предоплату, если её требует салон, вы платите салону. Её условия и возврат показываются до записи и определяются салоном.',
          'Напоминания о записи приходят в приложение, в Telegram или другим способом, который выбрали вы или салон.',
        ],
      },
      {
        id: 'reviews',
        heading: 'Отзывы и материалы',
        list: [
          'Отзывы и оценки должны быть честными и о вашем собственном опыте. Нельзя оскорблять, публиковать чужие личные данные и рекламу.',
          'Мы можем скрыть отзыв или материал, который нарушает эти правила или закон.',
          'Загружая фото и тексты, вы подтверждаете, что имеете на них право, и разрешаете показывать их в сервисе.',
        ],
      },
      {
        id: 'business',
        heading: 'Для салонов и мастеров',
        list: [
          'Пользоваться BookTime Business можно по подписке. Тарифы и пробный период указаны на странице booktime.am/business. Об изменении цен мы предупреждаем заранее, и новая цена действует только со следующей оплаты.',
          'Подписка оплачивается по счёту или банковским переводом.',
          'Вы оператор персональных данных своих клиентов. Вы отвечаете за то, чтобы у вас было основание их обрабатывать, и решаете, что записывать в карточки. Мы обрабатываем эти данные только по вашему поручению и только для работы сервиса.',
          'Сообщения клиентам — только о записях и с их согласия на новости. Спам и рассылки людям, которые не были вашими клиентами, запрещены.',
          'Выгрузить свою клиентскую базу и отчёты можно в кабинете в любое время. Если вы уходите из BookTime, мы передаём выгрузку, а через 90 дней обезличиваем вашу клиентскую базу.',
        ],
      },
      {
        id: 'rules',
        heading: 'Что запрещено',
        list: [
          'Делать фальшивые записи, отзывы и аккаунты.',
          'Пытаться обойти лимиты, взломать сервис, автоматически собирать данные из каталога.',
          'Использовать сервис для незаконных услуг и для того, что нарушает права других людей.',
        ],
        after: ['За нарушения мы можем ограничить доступ или заблокировать аккаунт, а о блокировке сообщим.'],
      },
      {
        id: 'liability',
        heading: 'Ответственность',
        list: [
          'Мы стараемся, чтобы сервис работал без перерывов, но не можем это гарантировать: бывают обновления и сбои у провайдеров связи и хостинга.',
          'Мы не отвечаем за качество услуг салона, за его цены и за то, что он отменил или перенёс запись. Такие вопросы решаются с салоном, но мы поможем связаться.',
          'Наша ответственность ограничена тем, что прямо предусмотрено законом Республики Армения.',
        ],
      },
      {
        id: 'law',
        heading: 'Право и споры',
        p: [
          'Соглашение регулируется законодательством Республики Армения. Споры сначала решаем перепиской на {email}. Если договориться не удалось — в суде Республики Армения.',
        ],
      },
      {
        id: 'changes',
        heading: 'Изменения',
        p: [
          'Мы можем обновлять соглашение. Новая редакция начинает действовать с даты вверху страницы, а о существенных изменениях мы предупредим в приложении заранее. Если вы не согласны, можете удалить аккаунт.',
        ],
      },
      {
        id: 'contacts',
        heading: 'Контакты',
        p: ['{company}, {address}. Почта: {email}.'],
      },
    ],
  },

  en: {
    title: 'Terms of Use',
    description: 'BookTime terms of use: booking beauty and other services, your account, reviews, and rules for businesses in BookTime Business.',
    updated: 'Effective from 4 October 2026',
    intro: [
      'These terms are an agreement between you and {company} ({address}) about using BookTime: the booktime.am website and the “BookTime” and “BookTime Business” apps. By signing in and ticking the consent box, you accept these terms and the Privacy Policy.',
    ],
    sections: [
      {
        id: 'service',
        heading: 'What BookTime is',
        list: [
          'For clients, BookTime is a catalog of professionals, salons, clinics and workshops in Armenia with online booking. It is free for clients.',
          'For businesses, BookTime Business is a booking calendar, client base, online booking, orders, client notifications, cash desk and reports.',
          'The service itself is provided by the salon or professional, not by BookTime. They set prices, duration, cancellation rules and quality, and your contract for the service is with them. We provide the tool for booking and communication.',
        ],
      },
      {
        id: 'account',
        heading: 'Your account',
        list: [
          'You sign in with your phone number and a one-time code sent via Telegram, WhatsApp or SMS. You can also sign in with Google or Apple.',
          'Use your real name and your own number. One account is for one person. Do not share sign-in codes.',
          'You are responsible for actions taken from your account. If you think someone else has signed in, write to us immediately.',
          'You can delete your account at any time in the app or on the website (see the “Account deletion” page).',
        ],
      },
      {
        id: 'booking',
        heading: 'Bookings',
        list: [
          'A booking appears in the business’s calendar immediately. If the business confirms bookings manually, we will let you know when it does.',
          'You can reschedule or cancel in “Bookings” within the time limit the business has set. After that, contact the business directly.',
          'If you do not show up and do not cancel, the business may record this. A business may restrict online booking for people who often miss appointments.',
          'If a business requires a prepayment, you pay the business. Its terms and refund rules are shown before you book and are set by the business.',
          'Booking reminders come in the app, via Telegram or another channel you or the business have chosen.',
        ],
      },
      {
        id: 'reviews',
        heading: 'Reviews and content',
        list: [
          'Reviews and ratings must be honest and about your own experience. No insults, other people’s personal data or advertising.',
          'We may hide a review or content that breaks these rules or the law.',
          'By uploading photos and text, you confirm you have the right to them and allow us to show them in the service.',
        ],
      },
      {
        id: 'business',
        heading: 'For salons and professionals',
        list: [
          'BookTime Business is available by subscription. Plans and the trial period are listed at booktime.am/business. We announce price changes in advance, and a new price applies only from your next payment.',
          'The subscription is paid by invoice or bank transfer.',
          'You are the controller of your clients’ personal data. You are responsible for having a legal basis to process it and decide what goes into client records. We process this data only on your instructions and only to run the service.',
          'Messages to clients may only be about bookings, plus news for clients who agreed to receive it. Spam and messages to people who were never your clients are prohibited.',
          'You can export your client base and reports in the business account at any time. If you leave BookTime, we hand over an export, and 90 days later we anonymise your client base.',
        ],
      },
      {
        id: 'rules',
        heading: 'What is not allowed',
        list: [
          'Fake bookings, reviews or accounts.',
          'Trying to bypass limits, hack the service or scrape the catalog.',
          'Using the service for illegal services or to violate other people’s rights.',
        ],
        after: ['We may restrict access or block an account for violations, and we will tell you if we do.'],
      },
      {
        id: 'liability',
        heading: 'Liability',
        list: [
          'We work to keep the service running without interruptions but cannot guarantee it: updates happen, and communication and hosting providers can fail.',
          'We are not responsible for the quality of a business’s services, its prices, or its cancelling or moving a booking. Such questions are settled with the business, and we will help you get in touch.',
          'Our liability is limited to what the law of the Republic of Armenia expressly provides.',
        ],
      },
      {
        id: 'law',
        heading: 'Governing law and disputes',
        p: [
          'These terms are governed by the law of the Republic of Armenia. We first try to settle disputes by email at {email}. If that fails, the courts of the Republic of Armenia decide.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes',
        p: [
          'We may update these terms. A new version applies from the date at the top of the page, and we will warn you in the app in advance about significant changes. If you do not agree, you can delete your account.',
        ],
      },
      {
        id: 'contacts',
        heading: 'Contacts',
        p: ['{company}, {address}. Email: {email}.'],
      },
    ],
  },

  hy: {
    title: 'Օգտագործման պայմաններ',
    description:
      'BookTime-ի օգտագործման պայմանները՝ գրանցում վարպետների և սրահների մոտ, հաշիվ, կարծիքներ, կանոններ սրահների և վարպետների համար BookTime Business-ում։',
    updated: 'Գործում է 2026 թ. հոկտեմբերի 4-ից',
    intro: [
      'Այս պայմանները կարգավորում են BookTime ծառայությունից՝ booktime.am կայքից և «BookTime» ու «BookTime Business» հավելվածներից օգտվելը։ Ծառայության օպերատոր՝ {company}, {address}։ Ծառայություն մուտք գործելով և համաձայնությունը նշելով՝ ընդունում եք այս պայմանները և Գաղտնիության քաղաքականությունը։',
    ],
    sections: [
      {
        id: 'service',
        heading: 'Ինչ է BookTime-ը',
        list: [
          'Հաճախորդների համար BookTime-ը Հայաստանի վարպետների, սրահների, կլինիկաների և արհեստանոցների կատալոգ է՝ առցանց գրանցմամբ։ Հաճախորդների համար ծառայությունն անվճար է։',
          'Բիզնեսի համար BookTime Business-ը գրանցումների մատյան է, հաճախորդների բազա, առցանց գրանցում, պատվերներ, ծանուցումներ հաճախորդներին, դրամարկղ և հաշվետվություններ։',
          'Ծառայությունը մատուցում է սրահը կամ վարպետը, ոչ թե BookTime-ը։ Գները, տևողությունը, չեղարկման կանոններն ու աշխատանքի որակը որոշում է նա, և ծառայության պայմանագիրը կնքում եք նրա հետ։ Մենք տրամադրում ենք գրանցման և կապի գործիքը։',
        ],
      },
      {
        id: 'account',
        heading: 'Հաշիվ',
        list: [
          'Մուտքը հեռախոսահամարով և միանգամյա կոդով է, որը գալիս է Telegram-ով, WhatsApp-ով կամ SMS-ով։ Կարող եք նաև մուտք գործել Google-ով կամ Apple-ով։',
          'Նշեք ձեր իրական անունը և ձեր համարը։ Մեկ հաշիվը մեկ մարդու համար է։ Մուտքի կոդերը մի փոխանցեք ուրիշներին։',
          'Դուք պատասխանատու եք ձեր հաշվից կատարված գործողությունների համար։ Եթե կարծում եք, որ ձեր հաշիվ մուտք է գործել օտար մարդ, անմիջապես գրեք մեզ։',
          'Հաշիվը կարող եք ջնջել ցանկացած պահի հավելվածում կամ կայքում (տե՛ս «Հաշվի ջնջում» էջը)։',
        ],
      },
      {
        id: 'booking',
        heading: 'Գրանցում',
        list: [
          'Գրանցումն անմիջապես հայտնվում է սրահի մատյանում։ Եթե սրահը գրանցումները հաստատում է ձեռքով, կտեղեկացնենք, երբ հաստատի։',
          'Գրանցումը կարող եք տեղափոխել կամ չեղարկել «Գրանցումներ» բաժնում՝ սրահի սահմանած ժամկետում։ Ժամկետն անցնելուց հետո կապվեք սրահի հետ անմիջապես։',
          'Եթե չեք եկել և չեք չեղարկել գրանցումը, սրահը կարող է դա նշել իր մոտ։ Սրահն իրավունք ունի սահմանափակել առցանց գրանցումը նրանց համար, ովքեր հաճախ չեն գալիս։',
          'Կանխավճարը, եթե սրահը պահանջում է, վճարում եք սրահին։ Դրա պայմաններն ու վերադարձը ցույց են տրվում մինչև գրանցումը և որոշվում են սրահի կողմից։',
          'Գրանցման հիշեցումները գալիս են հավելվածում, Telegram-ում կամ այլ եղանակով, որը ընտրել եք դուք կամ սրահը։',
        ],
      },
      {
        id: 'reviews',
        heading: 'Կարծիքներ և նյութեր',
        list: [
          'Կարծիքներն ու գնահատականները պետք է լինեն ազնիվ և ձեր սեփական փորձի մասին։ Չի կարելի վիրավորել, հրապարակել ուրիշների անձնական տվյալներ կամ գովազդ։',
          'Կարող ենք թաքցնել կարծիքը կամ նյութը, որը խախտում է այս կանոնները կամ օրենքը։',
          'Լուսանկարներ և տեքստեր վերբեռնելով՝ հաստատում եք, որ դրանց իրավունքն ունեք, և թույլ եք տալիս դրանք ցուցադրել ծառայությունում։',
        ],
      },
      {
        id: 'business',
        heading: 'Սրահների և վարպետների համար',
        list: [
          'BookTime Business-ից կարելի է օգտվել բաժանորդագրությամբ։ Սակագները և փորձաշրջանը նշված են booktime.am/business էջում։ Գների փոփոխության մասին նախապես զգուշացնում ենք, և նոր գինը գործում է միայն հաջորդ վճարումից։',
          'Բաժանորդագրությունը վճարվում է հաշիվ-ապրանքագրով կամ բանկային փոխանցումով։',
          'Դուք ձեր հաճախորդների անձնական տվյալների մշակողն եք։ Պատասխանատու եք, որ դրանք մշակելու հիմք ունենաք, և որոշում եք, թե ինչ գրել քարտերում։ Մենք այդ տվյալները մշակում ենք միայն ձեր հանձնարարությամբ և միայն ծառայության աշխատանքի համար։',
          'Հաճախորդներին հաղորդագրություններ՝ միայն գրանցումների մասին, իսկ նորություններ՝ նրանց համաձայնությամբ։ Սպամն ու հաղորդագրությունները մարդկանց, որոնք երբեք ձեր հաճախորդը չեն եղել, արգելված են։',
          'Հաճախորդների բազան և հաշվետվությունները կարող եք արտահանել կաբինետից ցանկացած պահի։ Եթե հեռանում եք BookTime-ից, փոխանցում ենք արտահանումը, իսկ 90 օր անց անանունացնում ենք ձեր հաճախորդների բազան։',
        ],
      },
      {
        id: 'rules',
        heading: 'Ինչն է արգելված',
        list: [
          'Կեղծ գրանցումներ, կարծիքներ և հաշիվներ ստեղծել։',
          'Փորձել շրջանցել սահմանափակումները, կոտրել ծառայությունը, ավտոմատ հավաքել տվյալներ կատալոգից։',
          'Օգտագործել ծառայությունը անօրինական ծառայությունների կամ այլ մարդկանց իրավունքները խախտելու համար։',
        ],
        after: ['Խախտումների դեպքում կարող ենք սահմանափակել հասանելիությունը կամ արգելափակել հաշիվը և կտեղեկացնենք այդ մասին։'],
      },
      {
        id: 'liability',
        heading: 'Պատասխանատվություն',
        list: [
          'Ջանում ենք, որ ծառայությունն աշխատի առանց ընդհատումների, բայց չենք կարող դա երաշխավորել. լինում են թարմացումներ և կապի ու հոսթինգի մատակարարների խափանումներ։',
          'Պատասխանատու չենք սրահի ծառայությունների որակի, գների և այն բանի համար, որ նա չեղարկել կամ տեղափոխել է գրանցումը։ Նման հարցերը լուծվում են սրահի հետ, իսկ մենք կօգնենք կապվել։',
          'Մեր պատասխանատվությունը սահմանափակված է նրանով, ինչ ուղղակիորեն նախատեսված է ՀՀ օրենսդրությամբ։',
        ],
      },
      {
        id: 'law',
        heading: 'Իրավունք և վեճեր',
        p: [
          'Համաձայնագիրը կարգավորվում է ՀՀ օրենսդրությամբ։ Վեճերը նախ լուծում ենք նամակագրությամբ՝ {email} հասցեով։ Եթե չհաջողվի համաձայնության գալ՝ ՀՀ դատարանում։',
        ],
      },
      {
        id: 'changes',
        heading: 'Փոփոխություններ',
        p: [
          'Կարող ենք թարմացնել համաձայնագիրը։ Նոր խմբագրությունը գործում է էջի վերևում նշված ամսաթվից, իսկ էական փոփոխությունների մասին նախապես կզգուշացնենք հավելվածում։ Եթե համաձայն չեք, կարող եք ջնջել հաշիվը։',
        ],
      },
      {
        id: 'contacts',
        heading: 'Կոնտակտներ',
        p: ['{company}, {address}։ Էլ. փոստ՝ {email}։'],
      },
    ],
  },
};
