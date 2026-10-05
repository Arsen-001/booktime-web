/**
 * Демо-данные на языке интерфейса (владелец, 05.10.2026: скриншоты для магазинов на hy и en показывали русские имена,
 * заказы, промоблоки). Сид пишется по-русски; после подъёма базы и при смене языка `localizeDemo(data, locale)`
 * переводит по словарю всё, что пришло из сида: имена людей (hy — армянским письмом, en — латиницей через
 * `translit` из армянской формы, тот же механизм, что `useDisplayName` у клиента), заметки, комментарии, заказы,
 * промоблоки, ссылки, должности. Строки, которых нет в словаре (введённые пользователем), не трогаются; id, телефоны
 * и форма данных не меняются. Словарь двусторонний: hy → en → ru переводится так же, поэтому перевод можно
 * применять повторно при каждой смене языка.
 *
 *   localizeDemo(data, 'hy') // те же объекты там, где переводить нечего (ссылки сохраняются)
 *
 * Правила для строки (по порядку): целиком фраза из словаря → шаблон («Кресло 3», «Нарек (сын)») → части через
 * « · » («Лусине Погосян · массаж») → имя из слов словаря имён («Ани Варданян»). `LocalizedText` без перевода
 * на нужный язык дополняется из словаря (pickText иначе показал бы ru). Картинка сгенерированной сторис
 * пересобирается с переведёнными строками (relocalizeStoryImage).
 */
import { relocalizeStoryImage } from '@/domain/client';
import type { LocaleCode, LocalizedText } from '@/domain/core';
import { translit } from '@/lib/translit';

interface Entry {
  ru: string;
  hy: string;
  en: string;
}

/** Имена, фамилии, отчества: ru → hy; en — translit(hy), если не задано третьим элементом */
const NAME_WORDS: [string, string, string?][] = [
  // женские
  ['Ани', 'Անի'], ['Анна', 'Աննա'], ['Мариам', 'Մարիամ'], ['Лилит', 'Լիլիթ'], ['Нарине', 'Նարինե'], ['Сона', 'Սոնա'],
  ['Гаяне', 'Գայանե'], ['Ева', 'Եվա'], ['Анаит', 'Անահիտ'], ['Седа', 'Սեդա'], ['Гоар', 'Գոհար'], ['Рузанна', 'Ռուզաննա'],
  ['Мэри', 'Մերի', 'Mary'], ['Арпи', 'Արփի'], ['Нане', 'Նանե'], ['Тамара', 'Թամարա'], ['Астхик', 'Աստղիկ'],
  ['Лусине', 'Լուսինե'], ['Кристине', 'Քրիստինե'], ['Армине', 'Արմինե'], ['Шушан', 'Շուշան'], ['Мане', 'Մանե'],
  ['Эмма', 'Էմմա'], ['Элен', 'Էլեն'], ['Милена', 'Միլենա'], ['Инесса', 'Ինեսսա'], ['Сюзанна', 'Սյուզաննա'],
  ['Карине', 'Կարինե'], ['Тагуи', 'Թագուհի'], ['Нуне', 'Նունե'], ['Ануш', 'Անուշ'], ['Лиана', 'Լիանա'], ['Диана', 'Դիանա'],
  ['Зара', 'Զառա'], ['Лаура', 'Լաուրա'], ['Нелли', 'Նելլի'], ['Рипсиме', 'Հռիփսիմե'], ['Сирануш', 'Սիրանուշ'],
  ['Мелине', 'Մելինե'], ['Ашхен', 'Աշխեն'], ['Тереза', 'Թերեզա'], ['Лала', 'Լալա'], ['Вардуи', 'Վարդուհի'],
  ['Мери', 'Մերի', 'Mary'], ['Нунэ', 'Նունե'],
  // мужские
  ['Арам', 'Արամ'], ['Тигран', 'Տիգրան'], ['Давид', 'Դավիթ'], ['Нарек', 'Նարեկ'], ['Эрик', 'Էրիկ'], ['Армен', 'Արմեն'],
  ['Карен', 'Կարեն'], ['Ашот', 'Աշոտ'], ['Гор', 'Գոռ'], ['Арман', 'Արման'], ['Ваагн', 'Վահագն'], ['Грант', 'Հրանտ'],
  ['Самвел', 'Սամվել'], ['Артур', 'Արթուր'], ['Левон', 'Լևոն'], ['Рубен', 'Ռուբեն'], ['Сурен', 'Սուրեն'], ['Гагик', 'Գագիկ'],
  ['Ованнес', 'Հովհաննես'], ['Андраник', 'Անդրանիկ'], ['Мигран', 'Միհրան'], ['Ваге', 'Վահե'], ['Айк', 'Հայկ'],
  ['Норайр', 'Նորայր'], ['Геворг', 'Գևորգ'], ['Эдгар', 'Էդգար'], ['Арсен', 'Արսեն'], ['Врам', 'Վռամ'], ['Мгер', 'Մհեր'],
  ['Артём', 'Արտյոմ'], ['Вардан', 'Վարդան'], ['Тарон', 'Տարոն'], ['Ваграм', 'Վահրամ'], ['Артак', 'Արտակ'], ['Гарик', 'Գարիկ'],
  // фамилии (Оганесян/Ованнисян и Саргсян/Саркисян — разные армянские формы, чтобы перевод обратно был однозначным)
  ['Саргсян', 'Սարգսյան'], ['Петросян', 'Պետրոսյան'], ['Григорян', 'Գրիգորյան'], ['Оганесян', 'Օհանեսյան'],
  ['Карапетян', 'Կարապետյան'], ['Хачатрян', 'Խաչատրյան'], ['Аветисян', 'Ավետիսյան'], ['Варданян', 'Վարդանյան'],
  ['Симонян', 'Սիմոնյան'], ['Манукян', 'Մանուկյան'], ['Гаспарян', 'Գասպարյան'], ['Бабаян', 'Բաբայան'],
  ['Мелконян', 'Մելքոնյան'], ['Адамян', 'Ադամյան'], ['Торосян', 'Թորոսյան'], ['Арутюнян', 'Հարությունյան'],
  ['Даниелян', 'Դանիելյան'], ['Галстян', 'Գալստյան'], ['Азарян', 'Ազարյան'], ['Егиазарян', 'Եղիազարյան'],
  ['Ованнисян', 'Հովհաննիսյան'], ['Мартиросян', 'Մարտիրոսյան'], ['Сафарян', 'Սաֆարյան'], ['Минасян', 'Մինասյան'],
  ['Погосян', 'Պողոսյան'], ['Геворгян', 'Գևորգյան'], ['Нерсесян', 'Ներսիսյան'], ['Абрамян', 'Աբրահամյան'],
  ['Мкртчян', 'Մկրտչյան'], ['Акопян', 'Հակոբյան'], ['Товмасян', 'Թովմասյան'], ['Бадалян', 'Բադալյան'],
  ['Казарян', 'Ղազարյան'], ['Амирханян', 'Ամիրխանյան'], ['Зограбян', 'Զոհրաբյան'], ['Асатрян', 'Ասատրյան'],
  ['Гукасян', 'Ղուկասյան'], ['Карамян', 'Կարամյան'], ['Арзуманян', 'Արզումանյան'], ['Саакян', 'Սահակյան'],
  ['Алексанян', 'Ալեքսանյան'], ['Бегларян', 'Բեգլարյան'], ['Давтян', 'Դավթյան'], ['Есаян', 'Եսայան'],
  ['Овсепян', 'Հովսեփյան'], ['Папоян', 'Պապոյան'], ['Чилингарян', 'Չիլինգարյան'], ['Мелкумян', 'Մելքումյան'],
  ['Шахбазян', 'Շահբազյան'], ['Тадевосян', 'Թադևոսյան'], ['Малхасян', 'Մալխասյան'], ['Сукиасян', 'Սուքիասյան'],
  ['Саркисян', 'Սարկիսյան'], ['Оганян', 'Օհանյան'], ['Мовсесян', 'Մովսեսյան'], ['Меликян', 'Մելիքյան'],
  ['Костанян', 'Կոստանյան'], ['Аветян', 'Ավետյան'], ['Амирян', 'Ամիրյան'],
  // отчества (по-армянски — родительный падеж имени отца)
  ['Артёмович', 'Արտյոմի', 'Artyomovich'], ['Самвеловна', 'Սամվելի', 'Samvelovna'], ['Ашотовна', 'Աշոտի', 'Ashotovna'],
  ['Вааговна', 'Վահագնի', 'Vahagnovna'], ['Гагикович', 'Գագիկի', 'Gagikovich'],
];

/** Шаблоны: {a}/{b} — имя или фраза (переводятся), {n} — число как есть */
const TEMPLATES: Entry[] = [
  { ru: '{a} (сын)', hy: '{a} (որդի)', en: '{a} (son)' },
  { ru: '{a} (дочь)', hy: '{a} (դուստր)', en: '{a} (daughter)' },
  { ru: '{a} — записывает {b}', hy: '{b} · գրանցող՝ {a}', en: '{a} — booking for {b}' },
  { ru: 'Кресло {n}', hy: 'Բազկաթոռ {n}', en: 'Chair {n}' },
  { ru: 'Кабинет {n}', hy: 'Կաբինետ {n}', en: 'Room {n}' },
  { ru: 'Аппарат {n}', hy: 'Սարք {n}', en: 'Device {n}' },
  { ru: 'Зал {n}', hy: 'Սրահ {n}', en: 'Hall {n}' },
];

/** Фразы сида: [ru, hy, en] */
const PHRASES: [string, string, string][] = [
  // ── Названия бизнесов (часть после « · ») и пустые черновики
  ['Нор-Норк', 'Նոր Նորք', 'Nor Nork'],
  ['Шенгавит', 'Շենգավիթ', 'Shengavit'],
  ['массаж', 'մերսում', 'massage'],
  ['тренер', 'մարզիչ', 'trainer'],
  ['ногти', 'եղունգներ', 'nails'],
  ['мойка с выездом', 'շարժական լվացում', 'mobile car wash'],
  ['барбер', 'բարբեր', 'barber'],
  ['брови и ресницы', 'հոնքեր և թարթիչներ', 'brows & lashes'],
  ['парикмахер', 'վարսահարդար', 'hairdresser'],
  ['Новый салон', 'Նոր սրահ', 'New salon'],
  ['Новый мастер', 'Նոր վարպետ', 'New master'],
  ['Ереван, Армения', 'Երևան, Հայաստան', 'Yerevan, Armenia'],
  ['Гюмри, Армения', 'Գյումրի, Հայաստան', 'Gyumri, Armenia'],

  // ── Материалы мастеров и услуг
  ['гель-лак', 'գել-լաք', 'gel polish'],
  ['каучуковая база', 'կաուչուկային հիմք', 'rubber base'],
  ['одноразовые пилки', 'միանգամյա խարտոցներ', 'disposable files'],
  ['педикюрный аппарат', 'պեդիկյուրի սարք', 'pedicure machine'],
  ['SPA-скраб', 'SPA սկրաբ', 'SPA scrub'],
  ['парафин', 'պարաֆին', 'paraffin'],
  ['полигель', 'պոլիգել', 'polygel'],
  ['акварельные краски', 'ջրաներկեր', 'watercolor paints'],
  ['стразы', 'ստրազներ', 'rhinestones'],
  ['крафт-пакеты', 'կրաֆտ փաթեթներ', 'kraft pouches'],
  ['опасная бритва', 'ածելի', 'straight razor'],
  ['горячее полотенце', 'տաք սրբիչ', 'hot towel'],
  ['светоотверждаемые пломбы', 'լուսապնդվող լցանյութեր', 'light-cured fillings'],
  ['коффердам', 'կոֆերդամ', 'rubber dam'],
  ['безаммиачная краска', 'առանց ամոնիակի ներկ', 'ammonia-free dye'],
  ['олапекс', 'Olaplex', 'Olaplex'],
  ['массажный стол', 'մերսման սեղան', 'massage table'],
  ['масла без запаха', 'անհոտ յուղեր', 'unscented oils'],
  ['одноразовые инструменты', 'միանգամյա գործիքներ', 'disposable tools'],
  ['УФ-лампа', 'ՈՒՄ լամպ', 'UV lamp'],
  ['бесконтактная пена', 'անհպում փրփուր', 'touchless foam'],
  ['микрофибра', 'միկրոֆիբրա', 'microfiber'],
  ['пароочиститель', 'գոլորշու մաքրիչ', 'steam cleaner'],
  ['пудра для осветления', 'պայծառացնող փոշի', 'lightening powder'],
  ['одноразовые спонжи', 'միանգամյա սպունգեր', 'disposable sponges'],
  ['хна для бровей', 'հինա հոնքերի համար', 'brow henna'],
  ['состав для ламинирования', 'լամինացման բաղադրություն', 'lamination solution'],
  ['воск Reuzel', 'Reuzel մոմ', 'Reuzel wax'],
  ['одноразовые щёточки', 'միանգամյա խոզանակներ', 'disposable brushes'],
  ['машинка Wahl', 'Wahl մեքենա', 'Wahl clipper'],
  ['матовая паста', 'փայլատ մածուկ', 'matte paste'],
  ['масло для бороды', 'մորուքի յուղ', 'beard oil'],
  ['машинка', 'մեքենա', 'clipper'],
  ['воск', 'մոմ', 'wax'],
  ['верхние формы', 'վերին կաղապարներ', 'dual forms'],

  // ── Домашние адреса мастеров (выезд)
  ['ул. Налбандяна, 12, кв. 8', 'Նալբանդյան փ., 12, բն. 8', '12 Nalbandyan St, apt 8'],
  ['Давташен, 4-й квартал, д. 12, кв. 31', 'Դավթաշեն, 4-րդ թաղամաս, շ. 12, բն. 31', 'Davtashen, Block 4, bldg 12, apt 31'],
  ['Нор-Норк, 3-й массив, пр. Гая, 16, кв. 45', 'Նոր Նորք, 3-րդ զանգված, Գայի պող., 16, բն. 45', 'Nor Nork, 3rd district, 16 Gai Ave, apt 45'],
  ['Аван, 5-й квартал, д. 14, 1 этаж — отдельный вход', 'Ավան, 5-րդ թաղամաս, շ. 14, 1-ին հարկ — առանձին մուտք', 'Avan, Block 5, bldg 14, 1st floor — separate entrance'],
  ['ул. Эребуни, 12, кв. 9', 'Էրեբունի փ., 12, բն. 9', '12 Erebuni St, apt 9'],
  ['Канакер, ул. Зейтуни, 18', 'Քանաքեռ, Զեյթունի փ., 18', 'Kanaker, 18 Zeytuni St'],

  // ── Заметки и метки клиентов
  ['Просит не звонить — только WhatsApp', 'Խնդրում է չզանգել — միայն WhatsApp', 'Asks not to call — WhatsApp only'],
  ['постоянный', 'մշտական', 'regular'],
  ['пенсионер', 'թոշակառու', 'pensioner'],
  ['аллергия', 'ալերգիա', 'allergy'],
  ['новый', 'նոր', 'new'],
  ['сотрудник', 'աշխատակից', 'staff'],
  ['по рекомендации', 'խորհրդով', 'referred'],
  ['По рекомендации друзей', 'Ընկերների խորհրդով', 'Referred by friends'],
  ['Оттенок в прошлый раз: нюдовый беж, №12', 'Նախորդ անգամվա երանգը՝ նյուդ բեժ, №12', 'Last shade: nude beige, #12'],
  ['Удобно только по субботам с утра', 'Հարմար է միայն շաբաթ առավոտյան', 'Saturday mornings only'],
  ['Предпочитает утро', 'Նախընտրում է առավոտը', 'Prefers mornings'],
  ['Любит кофе без сахара', 'Սիրում է սուրճ առանց շաքարի', 'Likes coffee without sugar'],
  ['Приходит с ребёнком', 'Գալիս է երեխայի հետ', 'Comes with a child'],
  ['Просит мастера помолчать — отдыхает', 'Խնդրում է վարպետին չխոսել — հանգստանում է', 'Prefers a quiet session — comes to rest'],
  ['Тонкие ногти — только с укреплением', 'Բարակ եղունգներ — միայն ամրացումով', 'Thin nails — always strengthen'],
  ['Опаздывает на 10–15 минут', 'Ուշանում է 10–15 րոպե', 'Usually 10–15 minutes late'],
  ['Нужна парковка рядом', 'Մոտակայքում կայանատեղի է պետք', 'Needs parking nearby'],
  ['Ходит к нам с открытия', 'Մեզ մոտ է գալիս բացման օրից', 'With us since we opened'],
  ['Стрижка раз в 3 недели, перед работой', 'Սանրվածք 3 շաբաթը մեկ, աշխատանքից առաջ', 'Haircut every 3 weeks, before work'],
  ['Бороду — только контур, длину не трогать', 'Մորուքը՝ միայն եզրագիծը, երկարությունը չկրճատել', 'Beard — outline only, keep the length'],
  ['Платит наличными', 'Վճարում է կանխիկ', 'Pays in cash'],
  ['Фейд 0,5 по бокам, сверху ножницами', 'Ֆեյդ 0,5 կողքերից, վերևը՝ մկրատով', 'Fade 0.5 on the sides, scissors on top'],
  ['Аллергия на лидокаин — только артикаин', 'Ալերգիա լիդոկաինի նկատմամբ — միայն արտիկաին', 'Allergic to lidocaine — articaine only'],
  ['Боится бормашины — нужна анестезия', 'Վախենում է բորմեքենայից — անզգայացում է պետք', 'Afraid of the drill — needs anesthesia'],
  ['Сняли брекеты в прошлом году', 'Բրեկետները հանվել են անցյալ տարի', 'Braces removed last year'],
  ['Беременность — без агрессивных пилингов', 'Հղիություն — առանց ագրեսիվ պիլինգների', 'Pregnant — no aggressive peels'],
  ['Беременность — краска без аммиака', 'Հղիություն — ներկ առանց ամոնիակի', 'Pregnant — ammonia-free dye only'],
  ['Формула: 7.1 + 8.0, оксид 6%', 'Բանաձև՝ 7.1 + 8.0, օքսիդ 6%', 'Formula: 7.1 + 8.0, 6% developer'],
  ['Чувствительная кожа', 'Զգայուն մաշկ', 'Sensitive skin'],
  ['Любит светлые оттенки', 'Սիրում է բաց երանգներ', 'Likes light shades'],
  ['Волосы тонкие — без термоукладки', 'Բարակ մազեր — առանց տաք հարդարման', 'Fine hair — no heat styling'],
  ['Без ароматических масел', 'Առանց բուրավետ յուղերի', 'No scented oils'],
  ['Цель — минус 5 кг к лету', 'Նպատակը՝ մինուս 5 կգ մինչև ամառ', 'Goal: lose 5 kg by summer'],
  ['Колено после травмы — без прыжков', 'Ծունկը վնասվածքից հետո — առանց ցատկերի', 'Knee injury — no jumping'],
  ['Аллергия на латекс — перчатки нитриловые', 'Ալերգիա լատեքսի նկատմամբ — նիտրիլային ձեռնոցներ', 'Latex allergy — nitrile gloves'],
  ['Ключи оставляет у охраны', 'Բանալիները թողնում է պահակի մոտ', 'Leaves the keys with security'],
  ['Машина: Toyota RAV4, белая', 'Մեքենա՝ Toyota RAV4, սպիտակ', 'Car: Toyota RAV4, white'],
  ['Аллергия на хну — только краска', 'Ալերգիա հինայի նկատմամբ — միայն ներկ', 'Henna allergy — dye only'],
  ['Аллергия на лак с ацетоном — уточнять', 'Ալերգիա ացետոնով լաքի նկատմամբ — ճշտել', 'Allergic to acetone polish — double-check'],
  ['Просила звонить, а не писать', 'Խնդրել է զանգել, ոչ թե գրել', 'Asked to call rather than text'],
  ['Любит крепкий кофе перед процедурой', 'Սիրում է թունդ սուրճ պրոցեդուրայից առաջ', 'Likes strong coffee before the treatment'],

  // ── Комментарии к записям
  ['Запись после сторис со свободным окном', 'Գրանցվել է ազատ ժամով սթորիից', 'Booked from a free-slot story'],
  ['Тот же оттенок, что в прошлый раз', 'Նույն երանգը, ինչ նախորդ անգամ', 'Same shade as last time'],
  ['Перенос с прошлой недели', 'Տեղափոխված է անցյալ շաբաթից', 'Moved from last week'],
  ['Снять старое покрытие', 'Հեռացնել հին ծածկույթը', 'Remove old polish'],
  ['Напомнить за день', 'Հիշեցնել մեկ օր առաջ', 'Remind a day before'],
  ['Принесёт прошлый снимок', 'Կբերի նախորդ նկարը', 'Will bring the previous X-ray'],
  ['Покажет фото желаемого результата', 'Ցույց կտա ցանկալի արդյունքի լուսանկարը', 'Will show a photo of the look she wants'],
  ['Нужен чек для работы', 'Աշխատանքի համար կտրոն է պետք', 'Needs a receipt for work'],
  ['Покажет фото бровей, которые нравятся', 'Ցույց կտա իրեն դուր եկող հոնքերի լուսանկար', 'Will show photos of brows she likes'],
  ['Прийти без макияжа', 'Գալ առանց դիմահարդարման', 'Come without makeup'],
  ['Оплата картой', 'Վճարում քարտով', 'Paying by card'],
  ['Первый визит', 'Առաջին այց', 'First visit'],
  ['Хочет к тому же мастеру, что в прошлый раз', 'Ուզում է նույն վարպետի մոտ, ինչ նախորդ անգամ', 'Wants the same master as last time'],
  ['Подарочный сертификат', 'Նվեր-քարտ', 'Gift card'],
  ['Покажет фото дизайна', 'Ցույց կտա դիզայնի լուսանկարը', 'Will show a design photo'],
  ['Адрес: ул. Раффи, 101, частный дом, ворота зелёные', 'Հասցե՝ Րաֆֆու փ., 101, առանձնատուն, դարպասը կանաչ է', 'Address: 101 Raffi St, private house, green gate'],
  ['Может опоздать на 10 минут', 'Կարող է ուշանալ 10 րոպե', 'May be 10 minutes late'],
  ['Как в прошлый раз: фейд, сверху 4 см', 'Ինչպես նախորդ անգամ՝ ֆեյդ, վերևը 4 սմ', 'Same as last time: fade, 4 cm on top'],
  ['После травмы колена', 'Ծնկի վնասվածքից հետո', 'After a knee injury'],
  ['Адрес: пр. Маштоца, 33, 5 этаж, домофон 17', 'Հասցե՝ Մաշտոցի պող., 33, 5-րդ հարկ, դոմոֆոն 17', 'Address: 33 Mashtots Ave, 5th floor, intercom 17'],
  ['Нужна справка для работы', 'Աշխատանքի համար տեղեկանք է պետք', 'Needs a note for work'],
  ['Укладка к свадьбе сестры', 'Հարդարում քրոջ հարսանիքի համար', "Styling for her sister's wedding"],
  ['Mercedes E, серебристая, 99 MM 606', 'Mercedes E, արծաթագույն, 99 MM 606', 'Mercedes E, silver, 99 MM 606'],
  ['Бороду подровнять, не коротко', 'Մորուքը հարթեցնել, ոչ կարճ', 'Trim the beard, not too short'],
  ['Toyota Camry, белая, 45 KK 707', 'Toyota Camry, սպիտակ, 45 KK 707', 'Toyota Camry, white, 45 KK 707'],
  ['Kia Rio, серая, 35 AA 101', 'Kia Rio, մոխրագույն, 35 AA 101', 'Kia Rio, grey, 35 AA 101'],
  ['Toyota Prius, белая, 10 OO 202', 'Toyota Prius, սպիտակ, 10 OO 202', 'Toyota Prius, white, 10 OO 202'],
  ['Lada Niva, зелёная, 21 SS 404', 'Lada Niva, կանաչ, 21 SS 404', 'Lada Niva, green, 21 SS 404'],
  ['Hyundai Sonata, чёрная, 77 LL 303', 'Hyundai Sonata, սև, 77 LL 303', 'Hyundai Sonata, black, 77 LL 303'],
  ['BMW X5, чёрный, 01 BB 808', 'BMW X5, սև, 01 BB 808', 'BMW X5, black, 01 BB 808'],
  ['Nissan Leaf, синяя, 55 XX 505', 'Nissan Leaf, կապույտ, 55 XX 505', 'Nissan Leaf, blue, 55 XX 505'],
  ['Адрес: ул. Орбели, 8 — парковка во дворе', 'Հասցե՝ Օրբելի փ., 8 — կայանատեղին բակում', 'Address: 8 Orbeli St — parking in the yard'],
  ['Адрес: ул. Бабаяна, 14, подъезд 2, код 45', 'Հասցե՝ Բաբայանի փ., 14, մուտք 2, կոդ 45', 'Address: 14 Babayan St, entrance 2, code 45'],
  ['Покажет фото стрижки', 'Ցույց կտա սանրվածքի լուսանկարը', 'Will show a haircut photo'],
  ['Записали по звонку', 'Գրանցվել է զանգով', 'Booked by phone'],
  ['Болит справа внизу', 'Ցավում է ներքևի աջ կողմում', 'Pain in the lower right'],

  // ── Отметки в календаре мастера
  ['Личное', 'Անձնական', 'Personal'],
  ['Учёба: курс по фейдам', 'Ուսում՝ ֆեյդերի դասընթաց', 'Training: fade course'],
  ['Врач', 'Բժիշկ', 'Doctor'],
  ['Конференция', 'Համաժողով', 'Conference'],
  ['Техобслуживание машины', 'Մեքենայի տեխսպասարկում', 'Car service'],
  ['Семейное', 'Ընտանեկան', 'Family'],
  ['Обучение: новая палитра', 'Ուսուցում՝ նոր գունապնակ', 'Training: new palette'],

  // ── Приложение клиента: сторис, новости, отзывы, абонементы
  ['Свободно сегодня', 'Ազատ է այսօր', 'Free today'],
  ['Свободно завтра', 'Ազատ է վաղը', 'Free tomorrow'],
  ['Новая коллекция', 'Նոր հավաքածու', 'New collection'],
  ['Было вчера', 'Երեկ էր', 'Was yesterday'],
  ['Новый оттенок гель-лака уже в наличии — приходите на обновление!', 'Գել-լաքի նոր երանգն արդեն առկա է — եկեք թարմացնելու։', 'A new gel polish shade is in — come in for a refresh!'],
  ['Уютное место, всё по записи вовремя, обязательно вернусь ещё.', 'Հարմարավետ վայր է, ամեն ինչ ժամանակին է, անպայման նորից կգամ։', "Cozy place, everything on time — I'll definitely be back."],
  ['Новинка недели — весенняя коллекция гель-лаков', 'Շաբաթվա նորույթը՝ գել-լաքերի գարնանային հավաքածու', 'New this week — spring gel polish collection'],
  ['Брови: коррекция и окрашивание', 'Հոնքեր՝ ուղղում և ներկում', 'Brows: shaping and tinting'],
  ['Своя запись', 'Իմ գրառումը', 'My own entry'],
  ['Абонемент на 10 визитов', 'Աբոնեմենտ 10 այցի համար', 'Membership: 10 visits'],
  ['Абонемент на 5 визитов', 'Աբոնեմենտ 5 այցի համար', 'Membership: 5 visits'],
  ['Абонемент на 3 визита', 'Աբոնեմենտ 3 այցի համար', 'Membership: 3 visits'],
  ['Абонемент «Стрижка и укладка»', '«Սանրվածք և հարդարում» աբոնեմենտ', 'Membership: Haircut & styling'],
  ['Абонемент «8 маникюров»', '«8 մատնահարդարում» աբոնեմենտ', 'Membership: 8 manicures'],
  ['Скидка 5% постоянным клиентам', '5% զեղչ մշտական հաճախորդներին', '5% off for regular clients'],

  // ── Журнал: поля, товары
  ['Номер договора', 'Պայմանագրի համար', 'Contract number'],
  ['ID во внешней CRM', 'ID արտաքին CRM-ում', 'External CRM ID'],
  ['Откуда узнали', 'Որտեղից են իմացել', 'How they found us'],
  ['Инстаграм', 'Instagram', 'Instagram'],
  ['Рекомендация', 'Խորհուրդ', 'Referral'],
  ['Прошёл мимо', 'Անցնում էր կողքով', 'Walked by'],
  ['Сайт', 'Կայք', 'Website'],
  ['Дата согласия на обработку данных', 'Տվյալների մշակման համաձայնության ամսաթիվ', 'Data processing consent date'],
  ['Следующий осмотр', 'Հաջորդ զննում', 'Next check-up'],
  ['Шампунь профессиональный 250 мл', 'Պրոֆեսիոնալ շամպուն 250 մլ', 'Professional shampoo 250 ml'],
  ['Масло для кутикулы', 'Կուտիկուլայի յուղ', 'Cuticle oil'],
  ['Воск для укладки', 'Հարդարման մոմ', 'Styling wax'],
  ['Крем для рук подарочный', 'Ձեռքի կրեմ՝ նվերի', 'Hand cream gift set'],
  ['Абонемент «5 визитов»', '«5 այց» աբոնեմենտ', 'Membership “5 visits”'],
  ['Абонемент «10 визитов»', '«10 այց» աբոնեմենտ', 'Membership “10 visits”'],
  ['Сертификат 20 000 ֏', 'Նվեր-քարտ 20 000 ֏', 'Gift card 20,000 ֏'],
  ['Сертификат 50 000 ֏', 'Նվեր-քարտ 50 000 ֏', 'Gift card 50,000 ֏'],

  // ── Онлайн-запись: ссылки, поля, промоблоки
  ['Форма компании', 'Ընկերության ձև', 'Business booking form'],
  ['Сетевая ссылка', 'Ցանցի հղում', 'Network link'],
  ['Комментарий к записи', 'Մեկնաբանություն գրանցմանը', 'Booking comment'],
  ['Как узнали о нас', 'Ինչպես եք իմացել մեր մասին', 'How did you hear about us'],
  ['Друзья', 'Ընկերներ', 'Friends'],
  ['Прохожу мимо', 'Անցնում եմ կողքով', 'Walking by'],
  ['Другое', 'Այլ', 'Other'],
  ['Внутренний код клиента (CRM сети)', 'Հաճախորդի ներքին կոդ (ցանցի CRM)', 'Internal client code (network CRM)'],
  ['−15% на первую запись онлайн', '−15% առաջին առցանց գրանցման համար', '−15% off your first online booking'],
  ['Запишитесь через сайт или ссылку — скидка применится при оплате визита.', 'Գրանցվեք կայքով կամ հղումով — զեղչը կկիրառվի այցի վճարման ժամանակ։', 'Book on our website or via the link — the discount applies when you pay for the visit.'],
  ['Подробнее', 'Մանրամասն', 'Learn more'],
  ['Подарок на день рождения', 'Նվեր ծննդյան օրվա առթիվ', 'Birthday gift'],
  ['Расскажем в WhatsApp за неделю — не пропустите скидку.', 'Կգրենք WhatsApp-ով մեկ շաբաթ առաջ — բաց մի թողեք զեղչը։', "We'll message you on WhatsApp a week before — don't miss the discount."],
  ['Приведи подругу', 'Բեր ընկերուհուդ', 'Bring a friend'],
  ['Ссылка ведёт не на наш сайт и не на нашу страницу — уточните адрес', 'Հղումը չի տանում ձեր կայք կամ էջ — ճշտեք հասցեն', "The link doesn't lead to your website or page — check the address"],
  ['Две услуги одной записью — выберите мастера на каждую.', 'Երկու ծառայություն մեկ գրանցմամբ — ընտրեք վարպետ յուրաքանչյուրի համար։', 'Two services in one booking — pick a specialist for each.'],

  // ── Клиенты: сертификаты, абонементы, покупки
  ['Администратор', 'Ադմինիստրատոր', 'Administrator'],
  ['Подарочный сертификат 15 000 ֏', 'Նվեր-քարտ 15 000 ֏', 'Gift card 15,000 ֏'],
  ['Подарочный сертификат 30 000 ֏', 'Նվեր-քարտ 30 000 ֏', 'Gift card 30,000 ֏'],
  ['Сертификат «День красоты»', '«Գեղեցկության օր» նվեր-քարտ', '“Beauty Day” gift card'],
  ['Абонемент на маникюр × 5', 'Մատնահարդարման աբոնեմենտ × 5', 'Manicure membership × 5'],
  ['Шампунь для роста', 'Աճը խթանող շամպուն', 'Hair growth shampoo'],

  // ── Лояльность
  ['Постоянный гость', 'Մշտական հյուր', 'Regular guest'],
  ['Скидка постоянному гостю', 'Զեղչ մշտական հյուրին', 'Regular guest discount'],
  ['Кэшбэк 5%', 'Քեշբեք 5%', '5% cashback'],
  ['Маникюр × 5', 'Մատնահարդարում × 5', 'Manicure × 5'],
  ['Стрижка × 8', 'Սանրվածք × 8', 'Haircut × 8'],
  ['Безлимит на месяц', 'Անսահմանափակ՝ մեկ ամիս', 'Unlimited for a month'],
  ['Депозит', 'Դեպոզիտ', 'Deposit'],

  // ── Сотрудники: должности, сеть
  ['Владелец салона', 'Սրահի սեփականատեր', 'Salon owner'],
  ['Мастер маникюра', 'Մատնահարդար', 'Manicurist'],
  ['Мастер педикюра', 'Ոտնահարդար', 'Pedicurist'],
  ['Нейл-дизайнер', 'Նեյլ-դիզայներ', 'Nail designer'],
  ['Ассистент мастера', 'Վարպետի օգնական', 'Assistant'],
  ['Старший барбер', 'Ավագ բարբեր', 'Senior barber'],
  ['Барбер', 'Բարբեր', 'Barber'],
  ['Главный врач, стоматолог-хирург', 'Գլխավոր բժիշկ, ստոմատոլոգ-վիրաբույժ', 'Chief physician, oral surgeon'],
  ['Стоматолог-терапевт', 'Ստոմատոլոգ-թերապևտ', 'General dentist'],
  ['Гигиенист', 'Հիգիենիստ', 'Dental hygienist'],
  ['Стоматолог-ортопед', 'Ստոմատոլոգ-օրթոպեդ', 'Prosthodontist'],
  ['Онлайн-запись (виджет)', 'Առցանց գրանցում (վիջեթ)', 'Online booking (widget)'],
  ['Отпуск', 'Արձակուրդ', 'Vacation'],
  ['Больничный', 'Հիվանդության արձակուրդ', 'Sick leave'],
  ['По умолчанию', 'Լռելյայն', 'Default'],
  ['Первая консультация', 'Առաջին խորհրդատվություն', 'First consultation'],
  ['Повторный визит', 'Կրկնակի այց', 'Follow-up visit'],

  // ── Заказы (мастерская FixPoint)
  ['iPhone 14 — замена экрана', 'iPhone 14 — էկրանի փոխարինում', 'iPhone 14 — screen replacement'],
  ['Оригинальный дисплей', 'Օրիգինալ էկրան', 'Original display'],
  ['Защитное стекло', 'Պաշտպանիչ ապակի', 'Screen protector'],
  ['iPhone 11 — замена аккумулятора', 'iPhone 11 — մարտկոցի փոխարինում', 'iPhone 11 — battery replacement'],
  ['Наушники AirPods Pro — хрип в левом', 'AirPods Pro — ձախ ականջակալը խզխզում է', 'AirPods Pro — left earbud crackles'],
  ['Samsung S21 — замена разъёма', 'Samsung S21 — միակցիչի փոխարինում', 'Samsung S21 — port replacement'],
  ['Ноутбук Lenovo — не видит Wi-Fi', 'Lenovo նոութբուք — Wi-Fi-ը չի գտնում', 'Lenovo laptop — no Wi-Fi'],
  ['Сначала диагностика, цену уточним', 'Նախ՝ ախտորոշում, գինը կճշտենք', 'Diagnostics first, price to be confirmed'],
  ['Apple Watch S7 — замена стекла', 'Apple Watch S7 — ապակու փոխարինում', 'Apple Watch S7 — glass replacement'],
  ['PlayStation 5 — чистка и термопаста', 'PlayStation 5 — մաքրում և ջերմամածուկ', 'PlayStation 5 — cleaning and thermal paste'],
  ['Геймпад DualSense — дрифт стика', 'DualSense խաղաղեկ — ստիկի դրեյֆ', 'DualSense controller — stick drift'],
  ['iPhone 13 Pro — замена камеры', 'iPhone 13 Pro — տեսախցիկի փոխարինում', 'iPhone 13 Pro — camera replacement'],
  ['Царапина на корпусе была при приёме', 'Իրանի քերծվածքը կար ընդունելիս', 'Scratch on the case was there at drop-off'],
  ['Ждём модуль камеры от поставщика', 'Սպասում ենք տեսախցիկի մոդուլին մատակարարից', 'Waiting for the camera module from the supplier'],
  ['Xiaomi Redmi Note 11 — аккумулятор', 'Xiaomi Redmi Note 11 — մարտկոց', 'Xiaomi Redmi Note 11 — battery'],
  ['iPad 9 — замена стекла', 'iPad 9 — ապակու փոխարինում', 'iPad 9 — glass replacement'],
  ['MacBook Air — залит чаем', 'MacBook Air — թեյ է թափվել', 'MacBook Air — tea spill'],
  ['Не включается', 'Չի միանում', "Won't turn on"],
  ['Клиент отказался от ремонта после диагностики', 'Հաճախորդը հրաժարվեց վերանորոգումից ախտորոշումից հետո', 'Client declined the repair after diagnostics'],
  ['Samsung A52 — не заряжается', 'Samsung A52 — չի լիցքավորվում', "Samsung A52 — won't charge"],
  ['Зарядный кабель', 'Լիցքավորման մալուխ', 'Charging cable'],
  ['iPhone 12 — замена экрана', 'iPhone 12 — էկրանի փոխարինում', 'iPhone 12 — screen replacement'],
  ['Трещина по диагонали, Face ID работает', 'Անկյունագծով ճաք, Face ID-ն աշխատում է', 'Diagonal crack, Face ID works'],
  ['Samsung Galaxy Tab S7 — замена гнезда зарядки', 'Samsung Galaxy Tab S7 — լիցքավորման բնիկի փոխարինում', 'Samsung Galaxy Tab S7 — charging port replacement'],
  ['Гнездо ждали от поставщика две недели', 'Բնիկին մատակարարից սպասեցինք երկու շաբաթ', 'The port took two weeks to arrive from the supplier'],
  // смета (05.10.2026)
  ['Замена материнской платы', 'Մայրական սալիկի փոխարինում', 'Motherboard replacement'],
  ['Чистка после залития', 'Մաքրում հեղուկից հետո', 'Cleaning after the spill'],
  ['Работа мастера', 'Վարպետի աշխատանք', 'Labour'],
  ['Дорого, куплю новый', 'Թանկ է, նորը կգնեմ', "Too expensive, I'll buy a new one"],
  ['Модуль камеры iPhone 13 Pro', 'iPhone 13 Pro-ի տեսախցիկի մոդուլ', 'iPhone 13 Pro camera module'],
  ['Делайте, жду', 'Արեք, սպասում եմ', "Go ahead, I'll wait"],
  ['Замена модуля Wi-Fi', 'Wi-Fi մոդուլի փոխարինում', 'Wi-Fi module replacement'],
  ['Модуль есть в наличии — сделаем за день', 'Մոդուլը առկա է — կանենք մեկ օրում', "The module is in stock — we'll fix it in a day"],
];

// ─────────────────────────── Индексы ───────────────────────────

/**
 * Любая языковая форма → запись (первая выигрывает: «Мэри»/«Мери» → одна армянская форма). Форма, одинаковая
 * на двух языках («Olaplex» в hy и en), обратно не переводится — иначе латинская строка в ru стала бы «олапекс».
 */
function indexOf(entries: Entry[], aliases = false): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const e of entries) addEntry(map, e, aliases);
  return map;
}

/**
 * Английская форма вида «nails», «barber», «new» обратно не переводится: так же выглядят id сфер и прочие
 * значения-перечисления в данных («nails» в ru стал бы «ногти»).
 */
const IDENTIFIER_LIKE = /^[a-z0-9_-]+$/;

/** Форма, общая для двух разных русских строк (две услуги с одним английским названием), обратно не переводится */
const AMBIGUOUS: Entry = { ru: '', hy: '', en: '' };

/** aliases — два русских написания одного имени («Мэри»/«Мери»): обратно — в первое, а не «неоднозначно» */
function addEntry(map: Map<string, Entry>, e: Entry, aliases = false): void {
  if (!map.has(e.ru)) map.set(e.ru, e);
  if (e.hy === e.en || e.hy === e.ru) return;
  const reverse = (form: string) => {
    const prev = map.get(form);
    if (!prev) map.set(form, e);
    else if (!aliases && prev !== AMBIGUOUS && prev.ru !== e.ru && prev.ru !== form) map.set(form, AMBIGUOUS);
  };
  reverse(e.hy);
  if (!IDENTIFIER_LIKE.test(e.en)) reverse(e.en);
}

const NAME_INDEX = indexOf(
  NAME_WORDS.map(([ru, hy, en]) => ({ ru, hy, en: en ?? translit(hy) })),
  true,
);
/** Английская форма — с заглавной («Massage», «Wax»): строчное слово выглядит как id и обратно не переводилось бы */
const STATIC_PHRASES: Entry[] = PHRASES.map(([ru, hy, en]) => ({ ru, hy, en: en.charAt(0).toUpperCase() + en.slice(1) }));

interface CompiledTemplate {
  entry: Entry;
  /** Для каждого языка: регулярное выражение и порядок мест */
  forms: Record<LocaleCode, { re: RegExp; slots: string[] }>;
}

function compileTemplate(entry: Entry): CompiledTemplate {
  const compile = (tpl: string) => {
    const slots: string[] = [];
    const src = tpl
      .split(/(\{[abn]\})/)
      .map((part) => {
        const m = /^\{([abn])\}$/.exec(part);
        if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        slots.push(m[1]);
        return m[1] === 'n' ? '(\\d+)' : '(.+?)';
      })
      .join('');
    return { re: new RegExp(`^${src}$`, 'u'), slots };
  };
  return { entry, forms: { ru: compile(entry.ru), hy: compile(entry.hy), en: compile(entry.en) } };
}

const COMPILED_TEMPLATES = TEMPLATES.map(compileTemplate);
const LOCALE_ORDER: LocaleCode[] = ['ru', 'hy', 'en'];

/** Есть ли в строке буквы, которые вообще можно перевести (кириллица, армянский, латиница) */
const HAS_LETTERS = /\p{L}/u;

// ─────────────────────────── Перевод строки ───────────────────────────

function createTranslator(phrases: Map<string, Entry>, locale: LocaleCode) {
  const cache = new Map<string, string>();

  const name = (s: string): string | undefined => {
    const tokens = s.split(' ');
    if (tokens.length > 4) return undefined;
    const out: string[] = [];
    for (const t of tokens) {
      const e = NAME_INDEX.get(t);
      if (!e || e === AMBIGUOUS) return undefined;
      out.push(e[locale]);
    }
    return out.join(' ');
  };

  const template = (s: string): string | undefined => {
    for (const t of COMPILED_TEMPLATES) {
      for (const from of LOCALE_ORDER) {
        const { re, slots } = t.forms[from];
        const m = re.exec(s);
        if (!m) continue;
        const values: Record<string, string> = {};
        let ok = true;
        slots.forEach((slot, i) => {
          const raw = m[i + 1];
          if (slot === 'n') values.n = raw;
          else {
            const v = translate(raw);
            if (v === raw && !NAME_INDEX.has(raw.split(' ')[0]) && !phrases.has(raw)) ok = false;
            values[slot] = v;
          }
        });
        if (!ok) continue;
        return t.entry[locale].replace(/\{([abn])\}/g, (_, k: string) => values[k] ?? '');
      }
    }
    return undefined;
  };

  function translate(s: string): string {
    if (!s || !HAS_LETTERS.test(s)) return s;
    const hit = cache.get(s);
    if (hit !== undefined) return hit;
    const entry = phrases.get(s);
    let out: string | undefined = entry && entry !== AMBIGUOUS ? entry[locale] : undefined;
    if (out === undefined && s.startsWith('data:image/svg+xml')) out = relocalizeStoryImage(s, translate);
    if (out === undefined) out = template(s);
    if (out === undefined && s.includes(' · ')) {
      const parts = s.split(' · ');
      const mapped = parts.map((p) => translate(p));
      if (mapped.some((p, i) => p !== parts[i])) out = mapped.join(' · ');
    }
    if (out === undefined) out = name(s);
    out ??= s;
    cache.set(s, out);
    return out;
  }

  return translate;
}

// ─────────────────────────── Обход данных ───────────────────────────

const LT_KEYS = new Set(['ru', 'hy', 'en']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function isLocalizedText(o: Record<string, unknown>): o is Record<string, unknown> & LocalizedText {
  if (typeof o.ru !== 'string') return false;
  for (const k of Object.keys(o)) if (!LT_KEYS.has(k)) return false;
  return true;
}

/** Переводы из самих данных: названия и описания услуг, категорий, должностей с тремя языками — копии в срезах */
function collectLocalized(value: unknown, into: Map<string, Entry>, depth = 0): void {
  if (depth > 6) return;
  if (Array.isArray(value)) {
    for (const v of value) collectLocalized(v, into, depth + 1);
    return;
  }
  if (!isPlainObject(value)) return;
  if (isLocalizedText(value)) {
    const { ru, hy, en } = value;
    if (ru && hy && en && !into.has(ru)) addEntry(into, { ru, hy, en });
    return;
  }
  for (const v of Object.values(value)) collectLocalized(v, into, depth + 1);
}

/** Копия при изменении: неизменённые ветки сохраняют ссылки (точечное перечитывание запросов в db.ts) */
function walk(value: unknown, translate: (s: string) => string, phrases: Map<string, Entry>, locale: LocaleCode): unknown {
  if (typeof value === 'string') return translate(value);
  if (Array.isArray(value)) {
    let out: unknown[] | undefined;
    for (let i = 0; i < value.length; i++) {
      const next = walk(value[i], translate, phrases, locale);
      if (next !== value[i]) (out ??= value.slice())[i] = next;
    }
    return out ?? value;
  }
  if (!isPlainObject(value)) return value;
  if (isLocalizedText(value)) {
    // Перевод на нужный язык есть — не трогаем; нет — из словаря (ru — по самой ru-строке)
    if (locale === 'ru' || value[locale]?.trim()) return value;
    const e = phrases.get(value.ru);
    return e && e !== AMBIGUOUS ? { ...value, [locale]: e[locale] } : value;
  }
  let out: Record<string, unknown> | undefined;
  for (const key of Object.keys(value)) {
    const next = walk(value[key], translate, phrases, locale);
    if (next !== value[key]) (out ??= { ...value })[key] = next;
  }
  return out ?? value;
}

/**
 * Демо-данные на языке locale. data — любой объект (ядро, срезы); возвращает тот же объект, если переводить нечего,
 * иначе копию с теми же ссылками на неизменённые ветки. sources — где искать готовые тройки ru/hy/en (услуги…).
 */
export function localizeDemo<T>(data: T, locale: LocaleCode, sources: unknown[] = []): T {
  const phrases = indexOf(STATIC_PHRASES);
  const collected = new Map<string, Entry>();
  for (const s of sources) collectLocalized(s, collected);
  for (const [k, e] of collected) if (!phrases.has(k)) phrases.set(k, e);
  const translate = createTranslator(phrases, locale);
  return walk(data, translate, phrases, locale) as T;
}
