import type { LocalizedText, Service, ServiceCategory, SphereId, Workplace } from '@/domain/core';
import { BIZ, ST } from '@/mock/seed/ids';
import { lt } from '@/mock/seed/helpers';

interface ServiceDraft {
  id: string;
  sphereId: SphereId;
  name: LocalizedText;
  description?: LocalizedText;
  kind?: Service['kind'];
  dur: number;
  durMax?: number;
  price: number;
  priceMax?: number;
  buffer?: number;
  repeat?: number;
  capacity?: number;
  staff: string[];
  workplaces?: Workplace[];
  online?: boolean;
  materials?: string[];
  /** Выбор оттенка/варианта при записи (F-00-094…096) */
  shade?: Service['shadeChoice'];
}

interface CategoryDraft {
  id: string;
  businessId: string;
  name: LocalizedText;
  services: ServiceDraft[];
}

const NAILS_MASTERS = [ST.nuriAni, ST.nuriGayane, ST.nuriEva];

const CATALOG: CategoryDraft[] = [
  // ─────────── Nuri Nail Studio
  {
    id: 'cat_nuri_mani',
    businessId: BIZ.nuri,
    name: lt('Маникюр', 'Մատնահարդարում', 'Manicure'),
    services: [
      { id: 'sv_nuri_classic', sphereId: 'nails', name: lt('Маникюр классический', 'Դասական մատնահարդարում', 'Classic manicure'), description: lt('Обрезной маникюр, форма, уход за кутикулой и масло. Без покрытия.', 'Եզրային մատնահարդարում, ձև, կուտիկուլայի խնամք և յուղ։ Առանց ծածկույթի։', 'Cut manicure, shaping, cuticle care and oil. No polish.'), dur: 45, price: 5000, repeat: 21, staff: [...NAILS_MASTERS, ST.nuriSona] },
      { id: 'sv_nuri_hardware', sphereId: 'nails', name: lt('Маникюр аппаратный', 'Ապարատային մատնահարդարում', 'Machine manicure'), description: lt('Бережная обработка фрезами — без порезов, кутикула дольше остаётся аккуратной.', 'Խնամքով մշակում ֆրեզներով՝ առանց կտրվածքների, կուտիկուլան ավելի երկար է կոկիկ մնում։', 'Gentle e-file work — no cuts, and cuticles stay neat for longer.'), dur: 60, price: 6000, repeat: 21, staff: [...NAILS_MASTERS] },
      {
        id: 'sv_nuri_gel',
        sphereId: 'nails',
        name: lt('Маникюр с покрытием гель-лаком', 'Մատնահարդարում գել-լաքով', 'Manicure with gel polish'),
        description: lt('Снятие, аппаратный маникюр, выравнивание и покрытие. Оттенок выбираете при записи.', 'Հեռացում, ապարատային մատնահարդարում, հարթեցում և ծածկույթ։ Երանգը ընտրում եք գրանցվելիս։', 'Removal, machine manicure, levelling and polish. Pick the shade when booking.'),
        dur: 90,
        durMax: 105,
        price: 9000,
        priceMax: 11000,
        buffer: 10,
        repeat: 21,
        staff: [...NAILS_MASTERS, ST.nuriSona],
        // owner 27.09.2026: Ани's schedule has a Sunday "принимаю и дома" shift (schedules.ts), but every one of
        // her services was salon-only — no candidate service meant zero possible bookings on that day. This is
        // her main service, portable like Мариам's/Хайка's home nail visits — home added here (only Ани actually
        // has a `home` schedule row, so this doesn't change anyone else's real availability).
        workplaces: ['salon', 'home'],
        materials: ['гель-лак', 'каучуковая база'],
        shade: 'preferred',
      },
      { id: 'sv_nuri_strength', sphereId: 'nails', name: lt('Укрепление ногтей гелем', 'Եղունգների ամրացում գելով', 'Gel nail strengthening'), description: lt('Для тонких и ломких ногтей: маникюр, укрепление гелем и покрытие в любой оттенок.', 'Բարակ և փխրուն եղունգների համար՝ մատնահարդարում, ամրացում գելով և ծածկույթ ցանկացած երանգով։', 'For thin, brittle nails: manicure, gel overlay and polish in any shade.'), dur: 120, price: 11000, priceMax: 13000, buffer: 10, repeat: 21, staff: [ST.nuriAni, ST.nuriSona], shade: 'preferred' },
      { id: 'sv_nuri_remove', sphereId: 'nails', name: lt('Снятие покрытия', 'Ծածկույթի հեռացում', 'Polish removal'), dur: 20, price: 2000, staff: [...NAILS_MASTERS, ST.nuriSona] },
      { id: 'sv_nuri_men', sphereId: 'nails', name: lt('Мужской маникюр', 'Տղամարդու մատնահարդարում', "Men's manicure"), dur: 45, price: 6000, staff: [ST.nuriGayane] },
      { id: 'sv_nuri_kids', sphereId: 'nails', name: lt('Детский маникюр', 'Մանկական մատնահարդարում', "Kids' manicure"), dur: 30, price: 4000, staff: [ST.nuriAni, ST.nuriGayane] },
    ],
  },
  {
    id: 'cat_nuri_pedi',
    businessId: BIZ.nuri,
    name: lt('Педикюр', 'Ոտնահարդարում', 'Pedicure'),
    services: [
      { id: 'sv_nuri_pedi', sphereId: 'nails', name: lt('Педикюр классический', 'Դասական ոտնահարդարում', 'Classic pedicure'), description: lt('Стопы и пальцы, обработка пяток, увлажнение. Покрытие — отдельно.', 'Ոտնաթաթեր և մատներ, կրունկների մշակում, խոնավեցում։ Ծածկույթը՝ առանձին։', 'Feet and toes, heel care and moisturising. Polish is extra.'), dur: 60, price: 8000, buffer: 15, repeat: 30, staff: [ST.nuriMariam, ST.nuriGayane] },
      { id: 'sv_nuri_pedi_gel', sphereId: 'nails', name: lt('Педикюр с гель-лаком', 'Ոտնահարդարում գել-լաքով', 'Pedicure with gel polish'), dur: 90, price: 12000, buffer: 15, repeat: 30, staff: [ST.nuriMariam], shade: 'required' },
      { id: 'sv_nuri_pedi_spa', sphereId: 'nails', name: lt('SPA-педикюр', 'SPA ոտնահարդարում', 'SPA pedicure'), description: lt('Ванночка, скраб, парафин и массаж стоп — час, чтобы выдохнуть.', 'Լոգանք, սկրաբ, պարաֆին և ոտքերի մերսում՝ մեկ ժամ հանգստի համար։', 'Soak, scrub, paraffin and a foot massage — an hour to unwind.'), dur: 75, price: 13000, buffer: 15, staff: [ST.nuriMariam], materials: ['SPA-скраб', 'парафин'] },
    ],
  },
  {
    id: 'cat_nuri_design',
    businessId: BIZ.nuri,
    name: lt('Дизайн и наращивание', 'Դիզայն և երկարացում', 'Design & extensions'),
    services: [
      { id: 'sv_nuri_design', sphereId: 'nails', name: lt('Дизайн ногтей', 'Եղունգների դիզայն', 'Nail art'), dur: 30, durMax: 60, price: 2000, priceMax: 4000, staff: [ST.nuriSona] },
      { id: 'sv_nuri_ext', sphereId: 'nails', name: lt('Наращивание ногтей', 'Եղունգների երկարացում', 'Nail extensions'), description: lt('Полигель на верхние формы, любая длина и форма: миндаль, овал, квадрат.', 'Պոլիգել վերին ձևերով, ցանկացած երկարություն և ձև՝ նուշ, օվալ, քառակուսի։', 'Polygel on dual forms, any length and shape: almond, oval, square.'), dur: 150, durMax: 180, price: 15000, priceMax: 20000, buffer: 10, repeat: 21, staff: [ST.nuriSona], materials: ['полигель', 'верхние формы'] },
    ],
  },

  // ─────────── Kaytsak Barbershop
  {
    id: 'cat_kaytsak_cuts',
    businessId: BIZ.kaytsak,
    name: lt('Стрижки', 'Սանրվածքներ', 'Haircuts'),
    services: [
      { id: 'sv_kay_cut', sphereId: 'barber', name: lt('Мужская стрижка', 'Տղամարդու սանրվածք', "Men's haircut"), description: lt('Консультация, мытьё головы, стрижка ножницами и машинкой, укладка.', 'Խորհրդատվություն, գլխի լվացում, սանրվածք մկրատով և մեքենայով, հարդարում։', 'Consultation, wash, scissor and clipper cut, styling.'), dur: 45, price: 7000, repeat: 28, staff: [ST.kaytsakOwner, ST.kaytsakDavid, ST.kaytsakNarek, ST.kaytsakErik, ST.kaytsakVahe, ST.kaytsakSamvel, ST.kaytsakGevorg, ST.kaytsakLevon, ST.kaytsakArtur, ST.kaytsakGarik, ST.kaytsakRuben, ST.kaytsakGor, ST.kaytsakSuren, ST.kaytsakAndranik, ST.kaytsakMher] },
      { id: 'sv_kay_clipper', sphereId: 'barber', name: lt('Фейд машинкой', 'Ֆեյդ մեքենայով', 'Clipper fade'), dur: 30, price: 5000, repeat: 21, staff: [ST.kaytsakDavid, ST.kaytsakNarek, ST.kaytsakErik, ST.kaytsakVahe, ST.kaytsakGevorg, ST.kaytsakLevon, ST.kaytsakArtur, ST.kaytsakGarik, ST.kaytsakRuben, ST.kaytsakGor, ST.kaytsakSuren, ST.kaytsakAndranik, ST.kaytsakMher] },
      { id: 'sv_kay_kids', sphereId: 'barber', name: lt('Детская стрижка до 12 лет', 'Մանկական սանրվածք մինչև 12 տարեկան', "Kids' haircut (under 12)"), dur: 30, price: 4000, staff: [ST.kaytsakDavid, ST.kaytsakErik, ST.kaytsakGevorg, ST.kaytsakGarik, ST.kaytsakAndranik] },
      { id: 'sv_kay_combo', sphereId: 'barber', name: lt('Стрижка и борода', 'Սանրվածք և մորուք', 'Haircut & beard'), description: lt('Стрижка, оформление бороды опасной бритвой и горячее полотенце.', 'Սանրվածք, մորուքի ձևավորում ածելիով և տաք սրբիչ։', 'Haircut, straight-razor beard shaping and a hot towel.'), dur: 75, price: 10000, repeat: 28, staff: [ST.kaytsakOwner, ST.kaytsakDavid, ST.kaytsakNarek, ST.kaytsakVahe, ST.kaytsakSamvel, ST.kaytsakLevon, ST.kaytsakRuben, ST.kaytsakGor] },
    ],
  },
  {
    id: 'cat_kaytsak_beard',
    businessId: BIZ.kaytsak,
    name: lt('Борода и бритьё', 'Մորուք և սափրում', 'Beard & shave'),
    services: [
      { id: 'sv_kay_beard', sphereId: 'barber', name: lt('Оформление бороды', 'Մորուքի ձևավորում', 'Beard trim'), dur: 30, price: 4500, repeat: 14, staff: [ST.kaytsakOwner, ST.kaytsakDavid, ST.kaytsakNarek, ST.kaytsakErik, ST.kaytsakVahe, ST.kaytsakSamvel, ST.kaytsakLevon, ST.kaytsakArtur, ST.kaytsakGarik, ST.kaytsakRuben, ST.kaytsakGor, ST.kaytsakSuren] },
      { id: 'sv_kay_shave', sphereId: 'barber', name: lt('Королевское бритьё', 'Արքայական սափրում', 'Royal shave'), description: lt('Распаривание горячим полотенцем, бритьё опасной бритвой, уход после бритья.', 'Տաք սրբիչով շոգեխաշում, սափրում ածելիով, սափրվելուց հետո խնամք։', 'Hot-towel prep, straight-razor shave and aftercare.'), dur: 45, price: 6000, staff: [ST.kaytsakOwner, ST.kaytsakDavid, ST.kaytsakSamvel, ST.kaytsakRuben] },
    ],
  },
  {
    id: 'cat_kaytsak_care',
    businessId: BIZ.kaytsak,
    name: lt('Уход', 'Խնամք', 'Care'),
    services: [
      { id: 'sv_kay_grey', sphereId: 'barber', name: lt('Камуфляж седины', 'Ճերմակ մազերի քողարկում', 'Grey blending'), dur: 30, price: 5000, staff: [ST.kaytsakOwner, ST.kaytsakNarek, ST.kaytsakSamvel, ST.kaytsakArtur, ST.kaytsakSuren] },
      { id: 'sv_kay_style', sphereId: 'barber', name: lt('Укладка', 'Հարդարում', 'Styling'), dur: 20, price: 3000, staff: [ST.kaytsakDavid, ST.kaytsakNarek, ST.kaytsakErik, ST.kaytsakVahe, ST.kaytsakGevorg, ST.kaytsakLevon, ST.kaytsakGarik, ST.kaytsakGor, ST.kaytsakAndranik] },
    ],
  },

  // ─────────── Atam Dental
  {
    id: 'cat_atam_diag',
    businessId: BIZ.atam,
    name: lt('Диагностика', 'Ախտորոշում', 'Diagnostics'),
    services: [
      { id: 'sv_atam_consult', sphereId: 'dental', name: lt('Осмотр и план лечения', 'Զննում և բուժման պլան', 'Check-up & treatment plan'), description: lt('Осмотр, фото зубов и план лечения с ценами — забираете с собой.', 'Զննում, ատամների լուսանկար և բուժման պլան՝ գներով, որը վերցնում եք ձեզ հետ։', 'Check-up, photos of your teeth and a priced treatment plan to take home.'), dur: 30, price: 5000, staff: [ST.atamOwner, ST.atamKaren, ST.atamAshot] },
      { id: 'sv_atam_xray', sphereId: 'dental', name: lt('Прицельный снимок', 'Նպատակային ռենտգեն նկար', 'Dental X-ray'), dur: 15, price: 3000, staff: [ST.atamOwner, ST.atamKaren] },
      { id: 'sv_atam_kids', sphereId: 'dental', name: lt('Детский приём', 'Մանկական ընդունելություն', "Children's appointment"), description: lt('Спокойное знакомство с врачом, осмотр и чистка. Для детей от 3 лет.', 'Հանգիստ ծանոթություն բժշկի հետ, զննում և մաքրում։ 3 տարեկանից երեխաների համար։', 'A calm first meeting, check-up and cleaning. Ages 3 and up.'), dur: 30, price: 8000, repeat: 180, staff: [ST.atamKaren] },
    ],
  },
  {
    id: 'cat_atam_hygiene',
    businessId: BIZ.atam,
    name: lt('Гигиена', 'Հիգիենա', 'Hygiene'),
    services: [
      {
        id: 'sv_atam_clean',
        sphereId: 'dental',
        name: lt('Профессиональная чистка зубов', 'Ատամների մասնագիտական մաքրում', 'Professional teeth cleaning'),
        description: lt('Ультразвук, Air Flow, полировка и фторирование.', 'Ուլտրաձայն, Air Flow, փայլեցում և ֆտորացում։', 'Ultrasound, Air Flow, polishing and fluoride.'),
        dur: 60,
        price: 15000,
        priceMax: 25000,
        buffer: 15,
        repeat: 180,
        staff: [ST.atamSeda],
      },
      { id: 'sv_atam_whitening', sphereId: 'dental', name: lt('Отбеливание зубов ZOOM', 'Ատամների սպիտակեցում ZOOM', 'ZOOM teeth whitening'), description: lt('Светлее на 6–8 тонов за один визит. Перед процедурой — профессиональная чистка.', '6–8 երանգով ավելի բաց՝ մեկ այցով։ Պրոցեդուրայից առաջ՝ մասնագիտական մաքրում։', '6–8 shades lighter in one visit. Professional cleaning first.'), dur: 90, price: 80000, priceMax: 100000, buffer: 15, staff: [ST.atamSeda] },
      { id: 'sv_atam_fluor', sphereId: 'dental', name: lt('Фторирование', 'Ֆտորացում', 'Fluoride treatment'), dur: 30, price: 6000, staff: [ST.atamSeda, ST.atamKaren] },
    ],
  },
  {
    id: 'cat_atam_therapy',
    businessId: BIZ.atam,
    name: lt('Терапия', 'Թերապիա', 'Therapy'),
    services: [
      { id: 'sv_atam_filling', sphereId: 'dental', name: lt('Лечение кариеса с пломбой', 'Կարիեսի բուժում և պլոմբ', 'Cavity treatment & filling'), dur: 60, durMax: 90, price: 20000, priceMax: 40000, buffer: 15, staff: [ST.atamKaren, ST.atamOwner] },
      { id: 'sv_atam_canal', sphereId: 'dental', name: lt('Лечение каналов', 'Արմատախողովակների բուժում', 'Root canal treatment'), dur: 90, durMax: 120, price: 35000, priceMax: 60000, buffer: 15, staff: [ST.atamKaren] },
    ],
  },
  {
    id: 'cat_atam_surgery',
    businessId: BIZ.atam,
    name: lt('Ортопедия и хирургия', 'Օրթոպեդիա և վիրաբուժություն', 'Prosthetics & surgery'),
    services: [
      { id: 'sv_atam_extract', sphereId: 'dental', name: lt('Удаление зуба', 'Ատամի հեռացում', 'Tooth extraction'), dur: 45, price: 15000, priceMax: 30000, buffer: 15, staff: [ST.atamOwner] },
      { id: 'sv_atam_crown', sphereId: 'dental', name: lt('Коронка металлокерамическая', 'Մետաղակերամիկական պսակ', 'Metal-ceramic crown'), dur: 60, price: 60000, priceMax: 75000, buffer: 15, online: false, staff: [ST.atamAshot] },
      { id: 'sv_atam_zirconia', sphereId: 'dental', name: lt('Коронка из диоксида циркония', 'Ցիրկոնիումի երկօքսիդից պսակ', 'Zirconia crown'), description: lt('Не отличить от своего зуба, без металла. Цена — после осмотра.', 'Չի տարբերվում ձեր ատամից, առանց մետաղի։ Գինը՝ զննումից հետո։', 'Looks like your own tooth, metal-free. Priced after a check-up.'), dur: 60, price: 120000, priceMax: 150000, buffer: 15, online: false, staff: [ST.atamAshot] },
    ],
  },

  // ─────────── Manana Beauty · Нор-Норк
  {
    id: 'cat_mnn_cuts',
    businessId: BIZ.mananaNN,
    name: lt('Стрижки и укладки', 'Սանրվածքներ և հարդարում', 'Cuts & styling'),
    services: [
      { id: 'sv_mnn_cut', sphereId: 'hair', name: lt('Женская стрижка', 'Կանացի սանրվածք', "Women's haircut"), dur: 60, price: 8000, priceMax: 12000, repeat: 45, staff: [ST.mananaArpi] },
      { id: 'sv_mnn_style', sphereId: 'hair', name: lt('Укладка', 'Հարդարում', 'Blow-dry & styling'), dur: 45, price: 6000, staff: [ST.mananaArpi, ST.mananaNane] },
    ],
  },
  {
    id: 'cat_mnn_color',
    businessId: BIZ.mananaNN,
    name: lt('Окрашивание', 'Ներկում', 'Colouring'),
    services: [
      {
        id: 'sv_mnn_color',
        sphereId: 'hair',
        name: lt('Окрашивание в один тон', 'Միատոն ներկում', 'Single-colour dye'),
        description: lt('Цена зависит от длины и густоты волос.', 'Գինը կախված է մազերի երկարությունից և խտությունից։', 'Price depends on hair length and thickness.'),
        dur: 120,
        durMax: 180,
        price: 18000,
        priceMax: 30000,
        repeat: 42,
        staff: [ST.mananaNane],
        materials: ['безаммиачная краска'],
      },
      { id: 'sv_mnn_highlights', sphereId: 'hair', name: lt('Сложное окрашивание: AirTouch, шатуш', 'Բարդ ներկում՝ AirTouch, շատուշ', 'Advanced colour: AirTouch, shatush'), description: lt('Мягкий переход без чётких полос. Цена зависит от длины — уточним на консультации.', 'Փափուկ անցում՝ առանց հստակ գծերի։ Գինը կախված է երկարությունից՝ կճշտենք խորհրդատվության ժամանակ։', 'A soft blend with no harsh lines. Price depends on length — we confirm at the consultation.'), dur: 180, durMax: 240, price: 40000, priceMax: 70000, staff: [ST.mananaNane] },
      { id: 'sv_mnn_keratin', sphereId: 'hair', name: lt('Кератиновое выпрямление', 'Կերատինային ուղղում', 'Keratin smoothing'), dur: 150, price: 30000, priceMax: 45000, staff: [ST.mananaNane, ST.mananaArpi] },
    ],
  },
  {
    id: 'cat_mnn_cosm',
    businessId: BIZ.mananaNN,
    name: lt('Косметология', 'Կոսմետոլոգիա', 'Cosmetology'),
    services: [
      { id: 'sv_mnn_face', sphereId: 'cosmetology', name: lt('Комбинированная чистка лица', 'Դեմքի համակցված մաքրում', 'Combined facial cleansing'), description: lt('Ультразвук и мануальная чистка, маска по типу кожи.', 'Ուլտրաձայնային և ձեռքով մաքրում, դիմակ՝ ըստ մաշկի տեսակի։', 'Ultrasonic and manual cleansing, a mask for your skin type.'), dur: 75, price: 15000, buffer: 15, repeat: 30, staff: [ST.mananaAnna] },
      { id: 'sv_mnn_peel', sphereId: 'cosmetology', name: lt('Пилинг', 'Պիլինգ', 'Peel'), dur: 45, price: 12000, priceMax: 18000, buffer: 15, staff: [ST.mananaAnna] },
    ],
  },

  // ─────────── Manana Beauty · Шенгавит
  {
    id: 'cat_msh_hair',
    businessId: BIZ.mananaSH,
    name: lt('Парикмахерский зал', 'Վարսավիրական սրահ', 'Hair studio'),
    services: [
      { id: 'sv_msh_cut_w', sphereId: 'hair', name: lt('Женская стрижка', 'Կանացի սանրվածք', "Women's haircut"), dur: 60, price: 7000, priceMax: 10000, repeat: 45, staff: [ST.mananaAstghik, ST.mananaGor] },
      { id: 'sv_msh_cut_m', sphereId: 'hair', name: lt('Мужская стрижка', 'Տղամարդու սանրվածք', "Men's haircut"), dur: 45, price: 5000, repeat: 30, staff: [ST.mananaGor] },
      { id: 'sv_msh_color', sphereId: 'hair', name: lt('Окрашивание', 'Ներկում', 'Hair colouring'), dur: 120, price: 16000, priceMax: 28000, staff: [ST.mananaAstghik] },
      { id: 'sv_msh_style', sphereId: 'hair', name: lt('Укладка', 'Հարդարում', 'Blow-dry & styling'), dur: 45, price: 5000, staff: [ST.mananaAstghik, ST.mananaGor] },
      { id: 'sv_msh_perm', sphereId: 'hair', name: lt('Биозавивка', 'Բիոգանգրացում', 'Bio perm'), dur: 150, price: 25000, staff: [ST.mananaAstghik] },
    ],
  },
  {
    id: 'cat_msh_cosm',
    businessId: BIZ.mananaSH,
    name: lt('Косметология', 'Կոսմետոլոգիա', 'Cosmetology'),
    services: [
      { id: 'sv_msh_face', sphereId: 'cosmetology', name: lt('Чистка лица', 'Դեմքի մաքրում', 'Facial cleansing'), dur: 75, price: 14000, buffer: 15, repeat: 30, staff: [ST.mananaTamara] },
      { id: 'sv_msh_face_massage', sphereId: 'cosmetology', name: lt('Массаж лица', 'Դեմքի մերսում', 'Facial massage'), dur: 45, price: 9000, staff: [ST.mananaTamara] },
      { id: 'sv_msh_brows', sphereId: 'cosmetology', name: lt('Коррекция и окрашивание бровей', 'Հոնքերի ուղղում և ներկում', 'Brow shaping & tint'), dur: 40, price: 6000, repeat: 28, staff: [ST.mananaTamara] },
    ],
  },

  // ─────────── Лусине · массаж
  {
    id: 'cat_lus_body',
    businessId: BIZ.lusine,
    name: lt('Массаж тела', 'Մարմնի մերսում', 'Body massage'),
    services: [
      { id: 'sv_lus_classic', sphereId: 'massage', name: lt('Классический массаж, 60 минут', 'Դասական մերսում, 60 րոպե', 'Classic massage, 60 min'), description: lt('Всё тело. Курс из 10 сеансов — со скидкой, спросите при записи.', 'Ամբողջ մարմինը։ 10 սեանսից բաղկացած կուրսը՝ զեղչով, հարցրեք գրանցվելիս։', 'Full body. A 10-session course comes with a discount — ask when booking.'), dur: 60, price: 12000, buffer: 15, repeat: 14, staff: [ST.lusine], workplaces: ['home', 'visit'] },
      { id: 'sv_lus_cellulite', sphereId: 'massage', name: lt('Антицеллюлитный массаж', 'Հակացելյուլիտային մերսում', 'Anti-cellulite massage'), dur: 60, price: 15000, priceMax: 18000, buffer: 15, staff: [ST.lusine], workplaces: ['home'] },
      { id: 'sv_lus_sport', sphereId: 'massage', name: lt('Спортивный массаж', 'Սպորտային մերսում', 'Sports massage'), dur: 75, price: 16000, buffer: 15, staff: [ST.lusine], workplaces: ['home', 'visit'] },
      { id: 'sv_lus_relax', sphereId: 'massage', name: lt('Расслабляющий массаж, 90 минут', 'Հանգստացնող մերսում, 90 րոպե', 'Relaxing massage, 90 min'), dur: 90, price: 20000, buffer: 15, staff: [ST.lusine], workplaces: ['home', 'visit'] },
    ],
  },
  {
    id: 'cat_lus_local',
    businessId: BIZ.lusine,
    name: lt('Локальный массаж', 'Տեղային մերսում', 'Local massage'),
    services: [
      { id: 'sv_lus_back', sphereId: 'massage', name: lt('Массаж спины и шеи', 'Մեջքի և պարանոցի մերսում', 'Back & neck massage'), dur: 40, price: 8000, buffer: 10, repeat: 10, staff: [ST.lusine], workplaces: ['home', 'visit'] },
    ],
  },

  // ─────────── Арман · тренер
  {
    id: 'cat_arm_personal',
    businessId: BIZ.arman,
    name: lt('Персональные тренировки', 'Անհատական մարզումներ', 'Personal training'),
    services: [
      { id: 'sv_arm_personal', sphereId: 'fitness', name: lt('Персональная тренировка', 'Անհատական մարզում', 'Personal training'), description: lt('Час один на один: техника, нагрузка под вашу цель, дневник прогресса.', 'Մեկ ժամ առանձին՝ տեխնիկա, ծանրաբեռնվածություն ձեր նպատակի համար, առաջընթացի օրագիր։', 'An hour one-to-one: technique, load for your goal and a progress log.'), dur: 60, price: 10000, repeat: 3, staff: [ST.arman], workplaces: ['gym'] },
      { id: 'sv_arm_online', sphereId: 'fitness', name: lt('Онлайн-тренировка', 'Առցանց մարզում', 'Online training'), dur: 60, price: 8000, staff: [ST.arman], workplaces: ['online'] },
      { id: 'sv_arm_plan', sphereId: 'fitness', name: lt('Составление программы тренировок', 'Մարզումների ծրագրի կազմում', 'Training plan'), dur: 45, price: 12000, staff: [ST.arman], workplaces: ['gym', 'online'] },
    ],
  },
  {
    id: 'cat_arm_group',
    businessId: BIZ.arman,
    name: lt('Групповые занятия', 'Խմբային պարապմունքներ', 'Group classes'),
    services: [
      { id: 'sv_arm_group_func', sphereId: 'fitness', kind: 'group', capacity: 10, name: lt('Функциональная тренировка в группе', 'Խմբային ֆունկցիոնալ մարզում', 'Group functional training'), dur: 60, price: 3500, staff: [ST.arman], workplaces: ['gym'] },
      { id: 'sv_arm_group_stretch', sphereId: 'fitness', kind: 'group', capacity: 8, name: lt('Растяжка в группе', 'Խմբային ձգումներ', 'Group stretching'), dur: 60, price: 3000, staff: [ST.arman], workplaces: ['gym', 'online'] },
    ],
  },

  // ─────────── Мариам · ногти на дому
  {
    id: 'cat_mar_nails',
    businessId: BIZ.mariam,
    name: lt('Маникюр и педикюр', 'Մատնահարդարում և ոտնահարդարում', 'Manicure & pedicure'),
    services: [
      { id: 'sv_mar_gel', sphereId: 'nails', name: lt('Маникюр с покрытием', 'Մատնահարդարում ծածկույթով', 'Manicure with polish'), dur: 90, price: 8000, buffer: 10, repeat: 21, staff: [ST.mariam], workplaces: ['home'], shade: 'preferred' },
      { id: 'sv_mar_plain', sphereId: 'nails', name: lt('Маникюр без покрытия', 'Մատնահարդարում առանց ծածկույթի', 'Manicure without polish'), dur: 60, price: 6000, staff: [ST.mariam], workplaces: ['home'] },
      { id: 'sv_mar_pedi', sphereId: 'nails', name: lt('Педикюр', 'Ոտնահարդարում', 'Pedicure'), dur: 90, price: 10000, buffer: 10, staff: [ST.mariam], workplaces: ['home'] },
      { id: 'sv_mar_visit', sphereId: 'nails', name: lt('Маникюр с выездом к вам', 'Մատնահարդարում ձեր տանը', 'Manicure at your place'), dur: 120, price: 11000, staff: [ST.mariam], workplaces: ['visit'] },
    ],
  },

  // ─────────── Давид · мойка с выездом
  {
    id: 'cat_dav_wash',
    businessId: BIZ.davit,
    name: lt('Мойка', 'Լվացում', 'Washing'),
    services: [
      { id: 'sv_dav_express', sphereId: 'carwash', name: lt('Экспресс-мойка кузова', 'Թափքի արագ լվացում', 'Express exterior wash'), dur: 30, price: 5000, repeat: 10, staff: [ST.davit], workplaces: ['visit'] },
      { id: 'sv_dav_full', sphereId: 'carwash', name: lt('Комплексная мойка', 'Համալիր լվացում', 'Full wash'), description: lt('Кузов, диски, коврики, пылесос и стёкла изнутри — у вашего подъезда.', 'Թափք, անվահեծեր, գորգիկներ, փոշեկուլ և ապակիներ ներսից՝ ձեր մուտքի մոտ։', 'Body, wheels, mats, vacuum and inside glass — right outside your door.'), dur: 60, price: 9000, priceMax: 12000, repeat: 14, staff: [ST.davit], workplaces: ['visit'] },
    ],
  },
  {
    id: 'cat_dav_detail',
    businessId: BIZ.davit,
    name: lt('Детейлинг', 'Դիթեյլինգ', 'Detailing'),
    services: [
      { id: 'sv_dav_interior', sphereId: 'carwash', name: lt('Химчистка салона', 'Սրահի քիմմաքրում', 'Interior deep cleaning'), description: lt('Сиденья, потолок, ковры и пластик. Сушим на месте — машина сразу готова.', 'Նստատեղեր, առաստաղ, գորգեր և պլաստիկ։ Չորացնում ենք տեղում՝ մեքենան անմիջապես պատրաստ է։', 'Seats, headliner, carpets and trim. Dried on the spot — ready to drive.'), dur: 150, durMax: 210, price: 25000, priceMax: 40000, staff: [ST.davit], workplaces: ['visit'] },
      { id: 'sv_dav_polish', sphereId: 'carwash', name: lt('Полировка кузова с воском', 'Թափքի փայլեցում մոմով', 'Body polish & wax'), dur: 180, price: 35000, priceMax: 50000, staff: [ST.davit], workplaces: ['visit'] },
    ],
  },
  // ─────────── Vard Beauty Lounge
  {
    id: 'cat_vard_hair',
    businessId: BIZ.vard,
    name: lt('Стрижки и укладки', 'Սանրվածքներ և հարդարում', 'Cuts & styling'),
    services: [
      { id: 'sv_vard_cut_w', sphereId: 'hair', name: lt('Женская стрижка с укладкой', 'Կանացի սանրվածք հարդարումով', "Women's cut & blow-dry"), description: lt('Консультация, мытьё с уходом, стрижка и укладка феном.', 'Խորհրդատվություն, լվացում խնամքով, սանրվածք և հարդարում ֆենով։', 'Consultation, wash with care, cut and blow-dry.'), dur: 75, price: 10000, priceMax: 15000, repeat: 42, staff: [ST.vardLiana, ST.vardEdgar] },
      { id: 'sv_vard_cut_m', sphereId: 'hair', name: lt('Мужская стрижка', 'Տղամարդու սանրվածք', "Men's haircut"), dur: 45, price: 6000, repeat: 28, staff: [ST.vardEdgar] },
      { id: 'sv_vard_kids', sphereId: 'hair', name: lt('Детская стрижка', 'Մանկական սանրվածք', "Kids' haircut"), dur: 30, price: 4000, staff: [ST.vardEdgar] },
      { id: 'sv_vard_style', sphereId: 'hair', name: lt('Вечерняя укладка', 'Երեկոյան հարդարում', 'Evening styling'), description: lt('Локоны, пучок или голливудская волна — к празднику и на фото.', 'Գանգուրներ, փունջ կամ հոլիվուդյան ալիք՝ տոնի և լուսանկարների համար։', 'Curls, an updo or Hollywood waves — for events and photos.'), dur: 60, price: 12000, priceMax: 20000, staff: [ST.vardLiana] },
    ],
  },
  {
    id: 'cat_vard_color',
    businessId: BIZ.vard,
    name: lt('Окрашивание и уход', 'Ներկում և խնամք', 'Colour & care'),
    services: [
      { id: 'sv_vard_roots', sphereId: 'hair', name: lt('Окрашивание корней', 'Արմատների ներկում', 'Root touch-up'), dur: 90, price: 15000, priceMax: 18000, repeat: 35, staff: [ST.vardInessa], materials: ['безаммиачная краска'] },
      { id: 'sv_vard_airtouch', sphereId: 'hair', name: lt('AirTouch и балаяж', 'AirTouch և բալայաժ', 'AirTouch & balayage'), description: lt('Сложное окрашивание с мягким переходом. Сначала бесплатная консультация — подберём оттенок.', 'Բարդ ներկում՝ փափուկ անցումով։ Սկզբում՝ անվճար խորհրդատվություն, կընտրենք երանգը։', 'Advanced colour with a soft blend. Free consultation first to pick your shade.'), dur: 210, durMax: 270, price: 45000, priceMax: 80000, buffer: 15, staff: [ST.vardInessa], materials: ['пудра для осветления', 'Olaplex'] },
      { id: 'sv_vard_toning', sphereId: 'hair', name: lt('Тонирование', 'Թոնավորում', 'Toning'), dur: 60, price: 12000, priceMax: 16000, staff: [ST.vardInessa] },
      { id: 'sv_vard_olaplex', sphereId: 'hair', name: lt('Восстановление Olaplex', 'Վերականգնում Olaplex', 'Olaplex repair'), dur: 45, price: 10000, staff: [ST.vardInessa, ST.vardLiana] },
    ],
  },
  {
    id: 'cat_vard_skin',
    businessId: BIZ.vard,
    name: lt('Лицо, брови, ресницы', 'Դեմք, հոնքեր, թարթիչներ', 'Face, brows & lashes'),
    services: [
      { id: 'sv_vard_face', sphereId: 'cosmetology', name: lt('Чистка лица', 'Դեմքի մաքրում', 'Facial cleansing'), dur: 75, price: 16000, buffer: 15, repeat: 30, staff: [ST.vardKarine] },
      { id: 'sv_vard_peel', sphereId: 'cosmetology', name: lt('Пилинг PRX-T33', 'PRX-T33 պիլինգ', 'PRX-T33 peel'), description: lt('Без покраснения и шелушения — можно в любой сезон.', 'Առանց կարմրության և թեփոտման՝ կարելի է ցանկացած սեզոնին։', 'No redness or peeling — suitable in any season.'), dur: 45, price: 25000, buffer: 15, staff: [ST.vardKarine] },
      { id: 'sv_vard_biorev', sphereId: 'cosmetology', name: lt('Биоревитализация', 'Բիոռևիտալիզացիա', 'Biorevitalisation'), dur: 45, price: 40000, priceMax: 55000, buffer: 15, online: false, staff: [ST.vardKarine] },
      { id: 'sv_vard_brows', sphereId: 'cosmetology', name: lt('Архитектура бровей с окрашиванием', 'Հոնքերի ճարտարապետություն ներկումով', 'Brow shaping & tint'), dur: 45, price: 7000, repeat: 28, staff: [ST.vardZara] },
      { id: 'sv_vard_lami', sphereId: 'cosmetology', name: lt('Ламинирование бровей', 'Հոնքերի լամինացում', 'Brow lamination'), dur: 60, price: 10000, repeat: 42, staff: [ST.vardZara] },
      { id: 'sv_vard_lash', sphereId: 'cosmetology', name: lt('Ламинирование ресниц', 'Թարթիչների լամինացում', 'Lash lift'), dur: 60, price: 12000, repeat: 42, staff: [ST.vardZara] },
      { id: 'sv_vard_brows_visit', sphereId: 'cosmetology', name: lt('Брови с выездом к вам', 'Հոնքեր՝ ձեզ մոտ գալով', 'Brows at your place'), description: lt('Та же архитектура и ламинирование, но у вас дома.', 'Նույն ճարտարապետությունը և լամինացումը, բայց ձեր տանը։', 'Same shaping and lamination, at your home.'), dur: 60, price: 9000, priceMax: 12000, repeat: 28, staff: [ST.vardZara], workplaces: ['visit'] },
    ],
  },

  // ─────────── Айк · барбер
  {
    id: 'cat_hayk_cuts',
    businessId: BIZ.hayk,
    name: lt('Стрижки и борода', 'Սանրվածքներ և մորուք', 'Cuts & beard'),
    services: [
      { id: 'sv_hayk_cut', sphereId: 'barber', name: lt('Мужская стрижка', 'Տղամարդու սանրվածք', "Men's haircut"), description: lt('Любая сложность: фейд, кроп, классика. С мытьём и укладкой.', 'Ցանկացած բարդության՝ ֆեյդ, քրոփ, դասական։ Լվացումով և հարդարումով։', 'Any style: fade, crop, classic. Wash and styling included.'), dur: 60, price: 6000, repeat: 21, staff: [ST.hayk], workplaces: ['home'] },
      { id: 'sv_hayk_combo', sphereId: 'barber', name: lt('Стрижка и борода', 'Սանրվածք և մորուք', 'Haircut & beard'), dur: 90, price: 9000, repeat: 21, staff: [ST.hayk], workplaces: ['home'] },
      { id: 'sv_hayk_beard', sphereId: 'barber', name: lt('Борода с горячим полотенцем', 'Մորուք տաք սրբիչով', 'Beard with hot towel'), dur: 30, price: 4000, repeat: 14, staff: [ST.hayk], workplaces: ['home'] },
      { id: 'sv_hayk_kids', sphereId: 'barber', name: lt('Детская стрижка', 'Մանկական սանրվածք', "Kids' haircut"), dur: 30, price: 4000, staff: [ST.hayk], workplaces: ['home'] },
    ],
  },

  // ─────────── Мелине · брови и ресницы
  {
    id: 'cat_mel_brows',
    businessId: BIZ.meline,
    name: lt('Брови', 'Հոնքեր', 'Brows'),
    services: [
      { id: 'sv_mel_arch', sphereId: 'cosmetology', name: lt('Архитектура бровей', 'Հոնքերի ճարտարապետություն', 'Brow shaping'), description: lt('Форма под черты лица: воск и пинцет, окрашивание хной или краской.', 'Ձև՝ ըստ դեմքի գծերի. մոմ և նրբունելի, ներկում հինայով կամ ներկով։', 'Shape that suits your face: wax and tweezers, henna or dye tint.'), dur: 45, price: 6000, repeat: 28, staff: [ST.meline], workplaces: ['home'] },
      { id: 'sv_mel_lami', sphereId: 'cosmetology', name: lt('Ламинирование бровей с окрашиванием', 'Հոնքերի լամինացում ներկումով', 'Brow lamination & tint'), dur: 75, price: 10000, repeat: 42, staff: [ST.meline], workplaces: ['home'] },
    ],
  },
  {
    id: 'cat_mel_lashes',
    businessId: BIZ.meline,
    name: lt('Ресницы', 'Թարթիչներ', 'Lashes'),
    services: [
      { id: 'sv_mel_lash', sphereId: 'cosmetology', name: lt('Ламинирование ресниц', 'Թարթիչների լամինացում', 'Lash lift'), description: lt('Изгиб и цвет на 6 недель — без туши и наращивания.', 'Ծռություն և գույն 6 շաբաթով՝ առանց թանաքի և երկարացման։', 'Curl and colour for 6 weeks — no mascara or extensions.'), dur: 60, price: 12000, repeat: 42, staff: [ST.meline], workplaces: ['home'] },
      { id: 'sv_mel_combo', sphereId: 'cosmetology', name: lt('Брови и ресницы в один визит', 'Հոնքեր և թարթիչներ մեկ այցով', 'Brows & lashes in one visit'), dur: 120, price: 19000, repeat: 42, staff: [ST.meline], workplaces: ['home'] },
    ],
  },

  // ─────────── Шушан · парикмахер
  {
    id: 'cat_shu_hair',
    businessId: BIZ.shushan,
    name: lt('Стрижки и окрашивание', 'Սանրվածքներ և ներկում', 'Cuts & colour'),
    services: [
      { id: 'sv_shu_cut_w', sphereId: 'hair', name: lt('Женская стрижка', 'Կանացի սանրվածք', "Women's haircut"), dur: 60, price: 6000, priceMax: 8000, repeat: 42, staff: [ST.shushan], workplaces: ['home'] },
      { id: 'sv_shu_cut_m', sphereId: 'hair', name: lt('Мужская стрижка', 'Տղամարդու սանրվածք', "Men's haircut"), dur: 40, price: 4000, repeat: 28, staff: [ST.shushan], workplaces: ['home'] },
      { id: 'sv_shu_color', sphereId: 'hair', name: lt('Окрашивание в один тон', 'Միատոն ներկում', 'Single-colour dye'), description: lt('Краска мастера включена. Можно со своей — будет дешевле.', 'Վարպետի ներկը ներառված է։ Կարելի է ձերով՝ ավելի էժան կլինի։', 'Dye included. Bring your own and it costs less.'), dur: 120, price: 14000, priceMax: 22000, repeat: 42, staff: [ST.shushan], workplaces: ['home'], materials: ['безаммиачная краска'] },
      { id: 'sv_shu_bride', sphereId: 'hair', name: lt('Свадебная причёска с выездом', 'Հարսանեկան սանրվածք՝ տանը', 'Bridal hair at your place'), description: lt('Пробная причёска заранее, в день свадьбы приезжаю к вам с утра.', 'Փորձնական սանրվածք նախօրոք, հարսանիքի օրը գալիս եմ ձեզ մոտ առավոտյան։', 'A trial beforehand; on the day I come to you in the morning.'), dur: 120, price: 30000, priceMax: 45000, staff: [ST.shushan], workplaces: ['visit'] },
      { id: 'sv_shu_style', sphereId: 'hair', name: lt('Праздничная укладка', 'Տոնական հարդարում', 'Occasion styling'), dur: 60, price: 10000, staff: [ST.shushan], workplaces: ['home', 'visit'] },
    ],
  },
];

const SALON_WORKPLACE: Workplace[] = ['salon'];

export function buildServices(): { categories: ServiceCategory[]; services: Service[] } {
  const categories: ServiceCategory[] = [];
  const services: Service[] = [];
  const orderByBusiness = new Map<string, number>();

  for (const cat of CATALOG) {
    const catOrder = orderByBusiness.get(cat.businessId) ?? 0;
    orderByBusiness.set(cat.businessId, catOrder + 1);
    categories.push({ id: cat.id, businessId: cat.businessId, name: cat.name, order: catOrder });
    cat.services.forEach((s, i) => {
      services.push({
        id: s.id,
        businessId: cat.businessId,
        categoryId: cat.id,
        sphereId: s.sphereId,
        name: s.name,
        description: s.description,
        kind: s.kind ?? 'individual',
        durationMin: s.dur,
        durationMax: s.durMax,
        priceMin: s.price,
        priceMax: s.priceMax,
        bufferAfterMin: s.buffer,
        repeatIntervalDays: s.repeat,
        capacity: s.capacity,
        photos: [],
        materials: s.materials ?? [],
        staffIds: s.staff,
        workplaces: s.workplaces ?? SALON_WORKPLACE,
        onlineBookable: s.online ?? true,
        active: true,
        order: i,
        shadeChoice: s.shade,
      });
    });
  }
  return { categories, services };
}
