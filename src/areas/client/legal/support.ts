import type { Locale } from '@/i18n/config';

/**
 * /support — «Помощь и поддержка» (05.10.2026): Support URL для App Store и страница помощи для Google Play — одна на
 * оба приложения («BookTime» и «BookTime Business»). Как и юридические тексты, лежит здесь, все три языка рядом;
 * почта — из operator.ts ({email}), чтобы меняться в одном месте. Пункты меню и кнопки названы так же, как в
 * интерфейсе (client.json, settings.json, clients.json) — поменяли подпись там, поправьте и здесь.
 */
export interface SupportLink {
  /** Путь без языка ('/account-deletion') — язык добавит localizedPath */
  href: string;
  label: string;
}

export interface SupportItem {
  id: string;
  q: string;
  /** Ответ; можно писать {email} */
  a: string;
  links?: SupportLink[];
}

export interface SupportGroup {
  id: 'clients' | 'business';
  heading: string;
  items: SupportItem[];
}

export interface SupportDoc {
  title: string;
  /** Описание для поисковиков (≤ 160 знаков) */
  description: string;
  intro: string;
  contact: {
    heading: string;
    /** Можно писать {email} */
    text: string;
    emailCta: string;
    /** Тема письма по кнопке «Написать» */
    emailSubject: string;
    business: string;
  };
  groups: [SupportGroup, SupportGroup];
  docsHeading: string;
}

export const SUPPORT: Record<Locale, SupportDoc> = {
  ru: {
    title: 'Помощь и поддержка',
    description: 'Ответы на частые вопросы о BookTime и BookTime Business: запись, перенос и отмена, код входа, удаление аккаунта, цены, перенос клиентов. Как связаться с нами.',
    intro: 'Ответы на частые вопросы о приложениях «BookTime» и «BookTime Business». Не нашли ответ — напишите нам.',
    contact: {
      heading: 'Связаться с нами',
      text: 'Почта: {email}. Укажите номер телефона, к которому привязан аккаунт, и опишите, что случилось. Отвечаем на том языке, на котором вы пишете: армянском, русском или английском.',
      emailCta: 'Написать на почту',
      emailSubject: 'BookTime: вопрос',
      business: 'Из кабинета BookTime Business: «Настройки» → «Помощь и поддержка» — ответ придёт на контакт из вашего профиля.',
    },
    groups: [
      {
        id: 'clients',
        heading: 'Клиентам',
        items: [
          {
            id: 'book',
            q: 'Как записаться?',
            a: 'Найдите салон или мастера в поиске или откройте ссылку, которую прислал салон. Выберите услугу, мастера и свободное время, укажите имя и телефон и подтвердите номер кодом. Запись появится в «Мои записи», салон увидит её сразу.',
            links: [{ href: '/search', label: 'Поиск' }],
          },
          {
            id: 'change',
            q: 'Как перенести или отменить запись?',
            a: 'Откройте «Мои записи», выберите запись и нажмите «Перенести» или «Отменить запись». Если срок бесплатной отмены, который задал салон, уже прошёл, отмена засчитается как неявка — тогда лучше предупредить салон.',
          },
          {
            id: 'code',
            q: 'Куда приходит код?',
            a: 'В Telegram или WhatsApp — при входе выберите, куда удобнее. SMS мы не отправляем. Код не пришёл — проверьте, что на этом номере есть выбранный мессенджер, и запросите код ещё раз или выберите другой.',
          },
          {
            id: 'social',
            q: 'Можно войти через Google или Apple?',
            a: 'Да: через Google — на сайте и в приложениях, через Apple — в приложении на iPhone. В первый раз подтвердите номер телефона кодом, дальше вход — одной кнопкой.',
          },
          {
            id: 'data',
            q: 'Как получить копию своих данных?',
            a: 'Скачайте сами за пару секунд: «Профиль» → «Скачать мои данные» — придёт файл JSON с профилем, записями во всех салонах, избранным, отзывами и согласиями. Сотрудники салонов — «Личный кабинет» → «Конфиденциальность» → «Скачать мои данные». Не получается войти в аккаунт — напишите на {email} с темой «Мои данные» и номером телефона аккаунта, пришлём данные в течение 30 дней.',
          },
          {
            id: 'delete',
            q: 'Как удалить аккаунт?',
            a: 'Откройте «Профиль» и внизу нажмите «Удалить аккаунт». Аккаунт удалится через 25 дней, до этого удаление можно отменить.',
            links: [{ href: '/account-deletion', label: 'Подробнее об удалении' }],
          },
        ],
      },
      {
        id: 'business',
        heading: 'Салонам и мастерам',
        items: [
          {
            id: 'register',
            q: 'Как подключить салон?',
            a: 'Зарегистрируйтесь на странице «Регистрация бизнеса»: тип, сфера, название и телефон. Кабинет откроется сразу, услуги для вашей сферы уже готовы — останется поправить цены и добавить мастеров.',
            links: [{ href: '/register-business', label: 'Регистрация бизнеса' }],
          },
          {
            id: 'price',
            q: 'Сколько это стоит?',
            a: 'Мастер-одиночка — 5 000 ֏ в месяц, салон — 4 000 ֏ за мастера в месяц (не меньше 8 000 ֏). Для первых салонов первый месяц бесплатный. Для ваших клиентов BookTime всегда бесплатный.',
            links: [{ href: '/business', label: 'Цены и возможности' }],
          },
          {
            id: 'import',
            q: 'Как перенести клиентов из Altegio, DIKIDI или Excel?',
            a: 'В кабинете откройте «Клиенты» → «Импорт и выгрузка» и загрузите файл выгрузки или таблицу Excel — до 20 000 строк. Мы покажем, что получилось, до сохранения, а повторная загрузка не создаст дублей. Там же базу можно выгрузить в Excel.',
          },
          {
            id: 'help',
            q: 'Как написать в поддержку из кабинета?',
            a: '«Настройки» → «Помощь и поддержка»: выберите тему и опишите вопрос. Ваши обращения и ответы видны там же. Или напишите на {email}.',
          },
        ],
      },
    ],
    docsHeading: 'Документы',
  },

  en: {
    title: 'Help & support',
    description: 'Answers about BookTime and BookTime Business: booking, rescheduling and cancelling, sign-in codes, account deletion, pricing, client import. How to contact us.',
    intro: 'Answers to common questions about the BookTime and BookTime Business apps. Can’t find yours? Write to us.',
    contact: {
      heading: 'Contact us',
      text: 'Email: {email}. Include the phone number linked to your account and describe what happened. We reply in the language you write in: Armenian, Russian or English.',
      emailCta: 'Send an email',
      emailSubject: 'BookTime: question',
      business: 'From the BookTime Business account: “Settings” → “Help & support”. The reply goes to the contact in your profile.',
    },
    groups: [
      {
        id: 'clients',
        heading: 'For clients',
        items: [
          {
            id: 'book',
            q: 'How do I book?',
            a: 'Find a salon or professional in search, or open the link the salon sent you. Choose a service, a professional and a free time, enter your name and phone, and confirm the number with a code. The booking appears in “My bookings”, and the salon sees it right away.',
            links: [{ href: '/search', label: 'Search' }],
          },
          {
            id: 'change',
            q: 'How do I reschedule or cancel?',
            a: 'Open “My bookings”, choose the booking and tap “Reschedule” or “Cancel booking”. If the salon’s free cancellation period has passed, the cancellation counts as a no-show, so it is better to let the salon know.',
          },
          {
            id: 'code',
            q: 'Where does the code arrive?',
            a: 'In Telegram or WhatsApp — choose which when you sign in. We do not send SMS. No code? Check that the chosen messenger is installed for this number, then request the code again or pick the other one.',
          },
          {
            id: 'social',
            q: 'Can I sign in with Google or Apple?',
            a: 'Yes: Google on the website and in the apps, Apple in the iPhone app. The first time, confirm your phone number with a code; after that, signing in is one tap.',
          },
          {
            id: 'data',
            q: 'How do I get a copy of my data?',
            a: 'Download it yourself in seconds: “Profile” → “Download my data” — you get a JSON file with your profile, bookings at every salon, favorites, reviews and consents. Salon staff: “Personal account” → “Privacy” → “Download my data”. Can’t sign in? Email {email} with the subject “My data” and the phone number of your account — we send your data within 30 days.',
          },
          {
            id: 'delete',
            q: 'How do I delete my account?',
            a: 'Open “Profile” and tap “Delete account” at the bottom. The account is deleted after 25 days; until then you can cancel.',
            links: [{ href: '/account-deletion', label: 'More about deletion' }],
          },
        ],
      },
      {
        id: 'business',
        heading: 'For salons and professionals',
        items: [
          {
            id: 'register',
            q: 'How do I add my salon?',
            a: 'Sign up on the “Register your business” page: type, field, name and phone. Your account opens right away with services for your field ready — just adjust prices and add your team.',
            links: [{ href: '/register-business', label: 'Register your business' }],
          },
          {
            id: 'price',
            q: 'How much does it cost?',
            a: 'A solo professional pays 5 000 ֏ a month, a salon 4 000 ֏ per professional a month (at least 8 000 ֏). The first month is free for our first salons. BookTime is always free for your clients.',
            links: [{ href: '/business', label: 'Pricing and features' }],
          },
          {
            id: 'import',
            q: 'How do I move clients from Altegio, DIKIDI or Excel?',
            a: 'In your account open “Clients” → “Import & export” and upload the export file or an Excel sheet — up to 20 000 rows. You see the result before saving, and uploading again creates no duplicates. You can export your client base to Excel there too.',
          },
          {
            id: 'help',
            q: 'How do I contact support from my account?',
            a: '“Settings” → “Help & support”: pick a topic and describe your question. Your requests and our replies are listed there. Or email {email}.',
          },
        ],
      },
    ],
    docsHeading: 'Documents',
  },

  hy: {
    title: 'Օգնություն և աջակցություն',
    description: 'Պատասխաններ BookTime-ի և BookTime Business-ի մասին՝ ամրագրում, տեղափոխում և չեղարկում, մուտքի կոդ, հաշվի ջնջում, գներ, հաճախորդների ներմուծում։ Ինչպես կապվել մեզ հետ։',
    intro: 'Պատասխաններ «BookTime» և «BookTime Business» հավելվածների մասին հաճախ տրվող հարցերին։ Չգտա՞ք պատասխանը՝ գրեք մեզ։',
    contact: {
      heading: 'Կապվել մեզ հետ',
      text: 'Էլ. փոստ՝ {email}։ Նշեք այն հեռախոսահամարը, որին կապված է հաշիվը, և նկարագրեք, թե ինչ է պատահել։ Պատասխանում ենք այն լեզվով, որով գրում եք՝ հայերեն, ռուսերեն կամ անգլերեն։',
      emailCta: 'Գրել էլ. փոստով',
      emailSubject: 'BookTime: հարց',
      business: 'BookTime Business-ի էջից՝ «Կարգավորումներ» → «Օգնություն և աջակցություն». պատասխանը կգա ձեր պրոֆիլում նշված կոնտակտին։',
    },
    groups: [
      {
        id: 'clients',
        heading: 'Հաճախորդներին',
        items: [
          {
            id: 'book',
            q: 'Ինչպե՞ս ամրագրվել։',
            a: 'Գտեք սրահը կամ վարպետին որոնման մեջ կամ բացեք սրահի ուղարկած հղումը։ Ընտրեք ծառայությունը, վարպետին և ազատ ժամը, նշեք անունն ու հեռախոսահամարը և հաստատեք համարը կոդով։ Ամրագրումը կհայտնվի «Իմ ամրագրումները» բաժնում, իսկ սրահն այն կտեսնի անմիջապես։',
            links: [{ href: '/search', label: 'Որոնում' }],
          },
          {
            id: 'change',
            q: 'Ինչպե՞ս տեղափոխել կամ չեղարկել ամրագրումը։',
            a: 'Բացեք «Իմ ամրագրումները», ընտրեք ամրագրումը և սեղմեք «Տեղափոխել» կամ «Չեղարկել ամրագրումը»։ Եթե սրահի սահմանած անվճար չեղարկման ժամկետն արդեն անցել է, չեղարկումը կհաշվվի որպես չներկայանալ. այդ դեպքում ավելի լավ է զգուշացնել սրահին։',
          },
          {
            id: 'code',
            q: 'Ո՞ւր է գալիս կոդը։',
            a: 'Telegram կամ WhatsApp՝ մուտք գործելիս ընտրեք, թե որն է ձեզ հարմար։ SMS չենք ուղարկում։ Կոդը չե՞կավ. ստուգեք, որ այդ համարով ընտրված մեսենջերը կա, և նորից խնդրեք կոդը կամ ընտրեք մյուսը։',
          },
          {
            id: 'social',
            q: 'Կարո՞ղ եմ մուտք գործել Google-ով կամ Apple-ով։',
            a: 'Այո՝ Google-ով՝ կայքում և հավելվածներում, Apple-ով՝ iPhone-ի հավելվածում։ Առաջին անգամ հաստատեք հեռախոսահամարը կոդով, հետո մուտքը՝ մեկ կոճակով։',
          },
          {
            id: 'data',
            q: 'Ինչպե՞ս ստանալ իմ տվյալների պատճենը։',
            a: 'Ներբեռնեք ինքներդ մի քանի վայրկյանում՝ «Պրոֆիլ» → «Ներբեռնել իմ տվյալները». կստանաք JSON ֆայլ՝ պրոֆիլով, բոլոր սրահների ամրագրումներով, ընտրյալներով, կարծիքներով և համաձայնություններով։ Սրահների աշխատակիցները՝ «Անձնական էջ» → «Գաղտնիություն» → «Ներբեռնել իմ տվյալները»։ Եթե չեք կարողանում մուտք գործել հաշիվ, գրեք {email} հասցեին «Իմ տվյալները» թեմայով և նշեք հաշվի հեռախոսահամարը, տվյալները կուղարկենք 30 օրվա ընթացքում։',
          },
          {
            id: 'delete',
            q: 'Ինչպե՞ս ջնջել հաշիվը։',
            a: 'Բացեք «Պրոֆիլ»-ը և ներքևում սեղմեք «Ջնջել հաշիվը»։ Հաշիվը կջնջվի 25 օր անց, մինչ այդ ջնջումը կարելի է չեղարկել։',
            links: [{ href: '/account-deletion', label: 'Մանրամասն ջնջման մասին' }],
          },
        ],
      },
      {
        id: 'business',
        heading: 'Սրահներին և վարպետներին',
        items: [
          {
            id: 'register',
            q: 'Ինչպե՞ս միացնել սրահը։',
            a: 'Գրանցվեք «Բիզնեսի գրանցում» էջում՝ տեսակը, ոլորտը, անվանումը և հեռախոսահամարը։ Էջը կբացվի անմիջապես, ձեր ոլորտի ծառայություններն արդեն պատրաստ են՝ մնում է ճշտել գները և ավելացնել վարպետներին։',
            links: [{ href: '/register-business', label: 'Բիզնեսի գրանցում' }],
          },
          {
            id: 'price',
            q: 'Որքա՞ն արժե։',
            a: 'Մենակ աշխատող վարպետը վճարում է ամսական 5 000 ֏, սրահը՝ ամսական 4 000 ֏ մեկ վարպետի համար (առնվազն 8 000 ֏)։ Առաջին սրահների համար առաջին ամիսն անվճար է։ Ձեր հաճախորդների համար BookTime-ը միշտ անվճար է։',
            links: [{ href: '/business', label: 'Գներ և հնարավորություններ' }],
          },
          {
            id: 'import',
            q: 'Ինչպե՞ս տեղափոխել հաճախորդներին Altegio-ից, DIKIDI-ից կամ Excel-ից։',
            a: 'Բացեք «Հաճախորդներ» → «Ներմուծում և արտահանում» և բեռնեք արտահանման ֆայլը կամ Excel աղյուսակը՝ մինչև 20 000 տող։ Արդյունքը կտեսնեք մինչև պահպանելը, իսկ կրկին բեռնելիս կրկնօրինակներ չեն ստեղծվի։ Այնտեղ էլ կարող եք բազան արտահանել Excel։',
          },
          {
            id: 'help',
            q: 'Ինչպե՞ս գրել աջակցման ծառայությանը էջից։',
            a: '«Կարգավորումներ» → «Օգնություն և աջակցություն»՝ ընտրեք թեման և նկարագրեք հարցը։ Ձեր դիմումներն ու պատասխանները երևում են նույն տեղում։ Կամ գրեք {email} հասցեին։',
          },
        ],
      },
    ],
    docsHeading: 'Փաստաթղթեր',
  },
};
