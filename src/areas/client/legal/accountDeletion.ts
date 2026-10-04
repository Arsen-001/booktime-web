import type { LegalDocs } from '@/areas/client/legal/types';

/**
 * /account-deletion — как удалить аккаунт (04.10.2026). Google Play требует публичную ссылку на такую страницу
 * (Data safety → Data deletion), App Store — удаление внутри приложения (5.1.1(v)): оно есть в профиле клиента
 * и в «Личный кабинет → Управление аккаунтом» кабинета. Срок — ACCOUNT_DELETION_DAYS сервера (25 дней);
 * что стирается — booktime-backend/src/modules/account/account-anonymize.ts.
 */
export const ACCOUNT_DELETION: LegalDocs = {
  ru: {
    title: 'Удаление аккаунта',
    description: 'Как удалить аккаунт BookTime или BookTime Business, какие данные удаляются, какие остаются у салонов и сколько это занимает.',
    updated: 'Обновлено 4 октября 2026 г.',
    intro: ['Аккаунт BookTime можно удалить самому в приложении или на сайте. Если войти не получается, напишите нам — удалим по просьбе.'],
    sections: [
      {
        id: 'client',
        ordered: true,
        heading: 'Приложение «BookTime» и сайт booktime.am',
        list: ['Войдите по своему номеру телефона.', 'Откройте «Профиль» (нижнее меню).', 'Внизу нажмите «Удалить аккаунт» и подтвердите.'],
      },
      {
        id: 'business',
        ordered: true,
        heading: 'Приложение «BookTime Business»',
        list: ['Откройте «Настройки» → «Личный кабинет».', 'Выберите вкладку «Управление аккаунтом».', 'Нажмите «Удалить мой аккаунт» и подтвердите.'],
        after: [
          'Если вы владелец салона, сначала передайте права владельца другому сотруднику. Иначе салон останется без владельца. Удалить весь бизнес или филиал можно там же, кнопкой «Удалить бизнес / филиал»: заявку обработает поддержка, а перед этим выгрузите свои данные.',
        ],
      },
      {
        id: 'no-access',
        heading: 'Если нет доступа к приложению',
        p: [
          'Напишите на {email} с темой «Удалить аккаунт» и укажите номер телефона, к которому привязан аккаунт. Чтобы никто не удалил чужой аккаунт, мы попросим подтвердить номер кодом. Запрос выполним в течение 30 дней.',
        ],
      },
      {
        id: 'what',
        heading: 'Что удаляется',
        list: [
          'Имя, номер телефона, фото, пол, дата рождения и район в профиле.',
          'Избранное, дневник, записи в листе ожидания (обезличиваются).',
          'Связки со входом через Google и Apple. Доступ, выданный через Apple, мы отзываем у Apple.',
          'Токены уведомлений и все сеансы входа на всех устройствах.',
        ],
      },
      {
        id: 'kept',
        heading: 'Что остаётся',
        list: [
          'Записи и карточка клиента у салонов, где вы были. Это записи самих салонов, они остаются у них, но без связи с вашим аккаунтом. Чтобы удалить такую карточку, обратитесь в салон.',
          'Оценки остаются в рейтинге мастера, но уже без вашего имени.',
          'Записи, которые мы обязаны хранить по закону, хранятся положенный срок.',
        ],
      },
      {
        id: 'when',
        heading: 'Сколько это занимает',
        p: [
          'Аккаунт удаляется через 25 дней после запроса. Пока срок не прошёл, удаление можно отменить: в BookTime Business — кнопкой «Отменить удаление», в приложении клиента — написав нам. Из резервных копий данные исчезают ещё через 14 дней. Потом вы сможете снова зарегистрироваться по тому же номеру, но уже с чистым профилем.',
        ],
      },
    ],
  },

  en: {
    title: 'Account deletion',
    description: 'How to delete a BookTime or BookTime Business account, what data is deleted, what stays with businesses and how long it takes.',
    updated: 'Updated 4 October 2026',
    intro: ['You can delete your BookTime account yourself in the app or on the website. If you cannot sign in, write to us and we will delete it on request.'],
    sections: [
      {
        id: 'client',
        ordered: true,
        heading: 'BookTime app and booktime.am',
        list: ['Sign in with your phone number.', 'Open “Profile” (bottom menu).', 'Tap “Delete account” at the bottom and confirm.'],
      },
      {
        id: 'business',
        ordered: true,
        heading: 'BookTime Business app',
        list: ['Open “Settings” → “Personal account”.', 'Choose the “Account management” tab.', 'Tap “Delete my account” and confirm.'],
        after: [
          'If you own a salon, transfer ownership to another staff member first, or the salon will be left without an owner. To delete the whole business or a location, use “Delete business / location” on the same tab: support handles the request. Export your data before that.',
        ],
      },
      {
        id: 'no-access',
        heading: 'If you cannot open the app',
        p: [
          'Email {email} with the subject “Delete account” and the phone number linked to the account. To make sure nobody deletes someone else’s account, we will ask you to confirm the number with a code. We complete requests within 30 days.',
        ],
      },
      {
        id: 'what',
        heading: 'What is deleted',
        list: [
          'Name, phone number, photo, gender, date of birth and district in your profile.',
          'Favourites, diary, and waitlist entries (anonymised).',
          'Google and Apple sign-in links. We also revoke the access granted through Apple.',
          'Push tokens and all sign-in sessions on all devices.',
        ],
      },
      {
        id: 'kept',
        heading: 'What stays',
        list: [
          'Bookings and your client record at businesses you visited. These are the businesses’ own records, so they stay with them, no longer linked to your account. To delete such a record, contact the business.',
          'Ratings stay in a professional’s score, without your name.',
          'Records we must keep by law are kept for the required period.',
        ],
      },
      {
        id: 'when',
        heading: 'How long it takes',
        p: [
          'The account is deleted 25 days after the request. Until then you can cancel: in BookTime Business with “Cancel deletion”, or in the client app by writing to us. Data disappears from backups 14 days later. After that you can sign up again with the same number, starting with an empty profile.',
        ],
      },
    ],
  },

  hy: {
    title: 'Հաշվի ջնջում',
    description: 'Ինչպես ջնջել BookTime կամ BookTime Business հաշիվը, ինչ տվյալներ են ջնջվում, ինչն է մնում սրահներում և որքան է տևում։',
    updated: 'Թարմացվել է 2026 թ. հոկտեմբերի 4-ին',
    intro: ['BookTime հաշիվը կարող եք ինքներդ ջնջել հավելվածում կամ կայքում։ Եթե չի ստացվում մուտք գործել, գրեք մեզ, և կջնջենք ձեր խնդրանքով։'],
    sections: [
      {
        id: 'client',
        ordered: true,
        heading: '«BookTime» հավելված և booktime.am կայք',
        list: ['Մուտք գործեք ձեր հեռախոսահամարով։', 'Բացեք «Պրոֆիլ»-ը (ներքևի ընտրացանկ)։', 'Ներքևում սեղմեք «Ջնջել հաշիվը» և հաստատեք։'],
      },
      {
        id: 'business',
        ordered: true,
        heading: '«BookTime Business» հավելված',
        list: ['Բացեք «Կարգավորումներ» → «Անձնական էջ»։', 'Ընտրեք «Հաշվի կառավարում» ներդիրը։', 'Սեղմեք «Ջնջել իմ հաշիվը» և հաստատեք։'],
        after: [
          'Եթե սրահի սեփականատերն եք, նախ փոխանցեք սեփականատիրոջ իրավունքները մեկ այլ աշխատակցի, այլապես սրահը կմնա առանց սեփականատիրոջ։ Ամբողջ բիզնեսը կամ մասնաճյուղը կարող եք ջնջել նույն տեղում՝ «Ջնջել բիզնեսը / մասնաճյուղը» կոճակով. հայտը կմշակի աջակցման ծառայությունը։ Դրանից առաջ արտահանեք ձեր տվյալները։',
        ],
      },
      {
        id: 'no-access',
        heading: 'Եթե հավելվածին հասանելիություն չունեք',
        p: [
          'Գրեք {email} հասցեին «Ջնջել հաշիվը» թեմայով և նշեք այն հեռախոսահամարը, որին կապված է հաշիվը։ Որպեսզի ոչ ոք ուրիշի հաշիվը չջնջի, կխնդրենք հաստատել համարը կոդով։ Հարցումը կկատարենք 30 օրվա ընթացքում։',
        ],
      },
      {
        id: 'what',
        heading: 'Ինչ է ջնջվում',
        list: [
          'Անունը, հեռախոսահամարը, լուսանկարը, սեռը, ծննդյան օրը և թաղամասը պրոֆիլում։',
          'Ընտրյալները, օրագիրը, սպասման ցուցակի գրառումները (անանունացվում են)։',
          'Google-ով և Apple-ով մուտքի կապերը։ Apple-ի միջոցով տրված հասանելիությունը չեղարկում ենք Apple-ի մոտ։',
          'Ծանուցումների տոկենները և մուտքի բոլոր սեանսները բոլոր սարքերում։',
        ],
      },
      {
        id: 'kept',
        heading: 'Ինչ է մնում',
        list: [
          'Գրանցումները և հաճախորդի քարտը այն սրահներում, որտեղ եղել եք։ Դրանք սրահների սեփական գրառումներն են, ուստի մնում են նրանց մոտ, բայց այլևս կապված չեն ձեր հաշվի հետ։ Նման քարտը ջնջելու համար դիմեք սրահին։',
          'Գնահատականները մնում են վարպետի վարկանիշում՝ առանց ձեր անվան։',
          'Գրառումները, որոնք օրենքով պարտավոր ենք պահել, պահվում են սահմանված ժամկետով։',
        ],
      },
      {
        id: 'when',
        heading: 'Որքան է տևում',
        p: [
          'Հաշիվը ջնջվում է հարցումից 25 օր անց։ Մինչ այդ ջնջումը կարելի է չեղարկել. BookTime Business-ում՝ «Չեղարկել ջնջումը» կոճակով, հաճախորդի հավելվածում՝ գրելով մեզ։ Պահուստային պատճեններից տվյալներն անհետանում են ևս 14 օր անց։ Դրանից հետո կարող եք նորից գրանցվել նույն համարով՝ մաքուր պրոֆիլով։',
        ],
      },
    ],
  },
};
