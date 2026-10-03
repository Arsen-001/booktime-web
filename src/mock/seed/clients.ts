import type { AppUser, Client, DistrictId, Gender, LocaleCode, SphereId } from '@/domain/core';
import { BIZ, type BizKey } from '@/mock/seed/ids';
import type { SeedClock } from '@/mock/seed/helpers';
import { FEMALE_NAMES, MALE_NAMES, SURNAMES } from '@/mock/seed/names';
import { avatarPhoto } from '@/mock/seed/photos';
import type { Rng } from '@/mock/seed/random';

interface Person {
  name: string;
  gender: Gender;
  phone: string;
  birthday?: string;
}

/**
 * Сколько клиентов у бизнеса и доля женщин. Числа — как у живого салона за год работы:
 * владелец на показе должен узнать свою базу, а не 20 строк.
 */
const CLIENT_PLAN: Record<BizKey, { count: number; female: number }> = {
  nuri: { count: 90, female: 0.93 },
  kaytsak: { count: 80, female: 0 },
  atam: { count: 70, female: 0.56 },
  mananaNN: { count: 60, female: 0.86 },
  mananaSH: { count: 45, female: 0.78 },
  lusine: { count: 30, female: 0.62 },
  arman: { count: 28, female: 0.5 },
  mariam: { count: 30, female: 1 },
  davit: { count: 30, female: 0.25 },
  vard: { count: 70, female: 0.82 },
  hayk: { count: 32, female: 0 },
  meline: { count: 35, female: 1 },
  shushan: { count: 28, female: 0.8 },
  // Пустые бизнесы — без клиентов (демо «… — пусто»)
  empty: { count: 0, female: 0.5 },
  emptySolo: { count: 0, female: 0.5 },
  // FixPoint (заказы, 03.10.2026) — без случайных клиентов: свои клиенты ниже (FIXPOINT_CLIENTS), сид остальных не сдвигается
  fixpoint: { count: 0, female: 0.5 },
};

/** Клиенты приложения и в каких бизнесах они есть в базе. Первый — демо-персона «Клиент». */
const APP_USERS: { gender: Gender; businesses: BizKey[]; locale: LocaleCode; district: DistrictId }[] = [
  { gender: 'female', businesses: ['nuri', 'atam', 'mananaNN', 'lusine'], locale: 'ru', district: 'kentron' },
  { gender: 'male', businesses: ['kaytsak', 'atam'], locale: 'hy', district: 'arabkir' },
  { gender: 'female', businesses: ['nuri'], locale: 'hy', district: 'kentron' },
  { gender: 'female', businesses: ['mananaSH', 'arman'], locale: 'ru', district: 'shengavit' },
  { gender: 'male', businesses: ['kaytsak', 'davit'], locale: 'hy', district: 'arabkir' },
  { gender: 'female', businesses: ['mariam'], locale: 'hy', district: 'nor-nork' },
  { gender: 'male', businesses: ['arman'], locale: 'en', district: 'achapnyak' },
  { gender: 'female', businesses: ['mananaNN', 'shushan'], locale: 'ru', district: 'nor-nork' },
  { gender: 'female', businesses: ['nuri', 'lusine'], locale: 'hy', district: 'davtashen' },
  { gender: 'male', businesses: ['atam'], locale: 'ru', district: 'malatia-sebastia' },
  { gender: 'female', businesses: ['mananaSH', 'meline'], locale: 'hy', district: 'shengavit' },
  { gender: 'male', businesses: ['davit'], locale: 'hy', district: 'erebuni' },
  { gender: 'female', businesses: ['atam', 'nuri', 'vard'], locale: 'en', district: 'kentron' },
  { gender: 'male', businesses: ['kaytsak', 'vard'], locale: 'ru', district: 'arabkir' },
  { gender: 'female', businesses: ['arman', 'lusine'], locale: 'hy', district: 'achapnyak' },
];

/** Заметки о клиенте: общие + по сфере бизнеса — чтобы в стоматологии не было «фейда 0,5», а в барбершопе «нюда №12» */
const NOTES_COMMON = [
  'Предпочитает утро',
  'Просит не звонить — только WhatsApp',
  'Приходит с ребёнком',
  'Ходит к нам с открытия',
  'Опаздывает на 10–15 минут',
  'Нужна парковка рядом',
  'Любит кофе без сахара',
  'Удобно только по субботам с утра',
  'По рекомендации друзей',
  'Просит мастера помолчать — отдыхает',
  'Платит наличными',
];

const NOTES_BY_SPHERE: Partial<Record<SphereId, string[]>> = {
  nails: ['Оттенок в прошлый раз: нюдовый беж, №12', 'Тонкие ногти — только с укреплением', 'Форма миндаль, короткая длина', 'Аллергия на латекс — перчатки нитриловые'],
  barber: ['Фейд 0,5 по бокам, сверху ножницами', 'Бороду — только контур, длину не трогать', 'Стрижка раз в 3 недели, перед работой'],
  hair: ['Формула: 7.1 + 8.0, оксид 6%', 'Любит светлые оттенки', 'Беременность — краска без аммиака', 'Волосы тонкие — без термоукладки'],
  cosmetology: ['Чувствительная кожа', 'Беременность — без агрессивных пилингов', 'Аллергия на хну — только краска'],
  dental: ['Боится бормашины — нужна анестезия', 'Аллергия на лидокаин — только артикаин', 'Сняли брекеты в прошлом году'],
  massage: ['Грыжа L5–S1 — поясницу мягко', 'Без ароматических масел'],
  fitness: ['Цель — минус 5 кг к лету', 'Колено после травмы — без прыжков'],
  carwash: ['Машина: Toyota RAV4, белая', 'Ключи оставляет у охраны'],
};

const SPHERE_OF: Record<BizKey, SphereId[]> = {
  nuri: ['nails'],
  kaytsak: ['barber'],
  atam: ['dental'],
  mananaNN: ['hair', 'cosmetology'],
  mananaSH: ['hair', 'cosmetology'],
  lusine: ['massage'],
  arman: ['fitness'],
  mariam: ['nails'],
  davit: ['carwash'],
  vard: ['hair', 'cosmetology'],
  hayk: ['barber'],
  meline: ['cosmetology'],
  shushan: ['hair'],
  empty: ['general'],
  emptySolo: ['general'],
  fixpoint: ['repair'],
};

/** Клиенты FixPoint (ремонт техники) — постоянные, без ГПСЧ; первая — демо-клиент приложения au_01 (пуш «Готово») */
const FIXPOINT_CLIENTS: { id: string; name: string; gender: Gender; phone: string; appUserId?: string; daysAgo: number }[] = [
  { id: 'cl_fix_01', name: 'Ани Мелкумян', gender: 'female', phone: '+37400160001', appUserId: 'au_01', daysAgo: 120 },
  { id: 'cl_fix_02', name: 'Давид Саркисян', gender: 'male', phone: '+37400170002', daysAgo: 95 },
  { id: 'cl_fix_03', name: 'Лилит Аветисян', gender: 'female', phone: '+37400170003', daysAgo: 60 },
  { id: 'cl_fix_04', name: 'Карен Манукян', gender: 'male', phone: '+37400170004', daysAgo: 41 },
  { id: 'cl_fix_05', name: 'Мери Петросян', gender: 'female', phone: '+37400170005', daysAgo: 30 },
  { id: 'cl_fix_06', name: 'Гор Хачатрян', gender: 'male', phone: '+37400170006', daysAgo: 14 },
  { id: 'cl_fix_07', name: 'Ануш Григорян', gender: 'female', phone: '+37400170007', daysAgo: 9 },
  { id: 'cl_fix_08', name: 'Артур Мкртчян', gender: 'male', phone: '+37400170008', daysAgo: 3 },
];

const notesFor = (key: BizKey): string[] => [...SPHERE_OF[key].flatMap((sp) => NOTES_BY_SPHERE[sp] ?? []), ...NOTES_COMMON];

const TAGS = ['VIP', 'постоянный', 'новый', 'по рекомендации', 'аллергия', 'пенсионер', 'сотрудник'];

/** Мобильные коды Армении — у клиентов номера выглядят как настоящие (ux-clients №2), но выдуманы */
const MOBILE_CODES = ['91', '93', '94', '95', '96', '77', '98', '99'];

/** Портрет у одного пользователя приложения (не у демо-клиента au_01) — видно и фото, и инициалы (F-14-059) */
const APP_USER_PHOTOS: Record<number, Parameters<typeof avatarPhoto>[0]> = {
  2: { hair: 'long', bg: 1, skin: 0, hairColor: 1, top: 6 },
};

export function buildClients(rng: Rng, clock: SeedClock): { appUsers: AppUser[]; clients: Client[] } {
  // Уникальные выдуманные номера клиентов: +374 <мобильный код> XXX XXX. Бизнесы, сотрудники и демо-клиент au_01
  // остаются на несуществующем коде 00 (+374 00 1XX XXX) — на них ссылаются сквозные проверки.
  const usedPhones = new Set<string>();
  const newPhone = () => {
    for (;;) {
      const phone = `+374${rng.pick(MOBILE_CODES)}${String(rng.int(100000, 999999))}`;
      if (usedPhones.has(phone)) continue;
      usedPhones.add(phone);
      return phone;
    }
  };
  const usedNames = new Set<string>();
  const newPerson = (gender: Gender): Person => {
    let name = '';
    do {
      const first = gender === 'male' ? rng.pick(MALE_NAMES) : rng.pick(FEMALE_NAMES);
      name = `${first} ${rng.pick(SURNAMES)}`;
    } while (usedNames.has(name));
    usedNames.add(name);
    const birthday = rng.chance(0.45)
      ? `${rng.int(1958, 2006)}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`
      : undefined;
    return { name, gender, phone: newPhone(), birthday };
  };

  const appUsers: AppUser[] = [];
  const members: Record<BizKey, (Person & { appUserId?: string })[]> = {
    nuri: [], kaytsak: [], atam: [], mananaNN: [], mananaSH: [], lusine: [], arman: [], mariam: [], davit: [], vard: [], hayk: [], meline: [], shushan: [], empty: [], emptySolo: [], fixpoint: [],
  };

  APP_USERS.forEach((plan, i) => {
    const person = i === 0 ? { name: 'Ани Мелкумян', gender: 'female' as const, phone: '+37400160001', birthday: '1994-05-17' } : newPerson(plan.gender);
    if (i === 0) {
      usedPhones.add(person.phone);
      usedNames.add(person.name);
    }
    const id = `au_${String(i + 1).padStart(2, '0')}`;
    appUsers.push({
      id,
      phone: person.phone,
      name: person.name,
      gender: person.gender,
      birthday: person.birthday,
      district: plan.district,
      locale: plan.locale,
      photoUrl: APP_USER_PHOTOS[i] ? avatarPhoto(APP_USER_PHOTOS[i]) : undefined,
      createdAt: clock.at(-rng.int(20, 200), `${String(rng.int(9, 22)).padStart(2, '0')}:${rng.pick(['05', '17', '32', '48'])}`),
    });
    plan.businesses.forEach((b) => members[b].push({ ...person, appUserId: id }));
  });

  // Несколько людей ходят в два места (без приложения)
  const shared: [BizKey, BizKey][] = [
    ['nuri', 'mananaNN'],
    ['nuri', 'mariam'],
    ['kaytsak', 'atam'],
    ['mananaSH', 'atam'],
    ['lusine', 'arman'],
    ['davit', 'kaytsak'],
    ['vard', 'nuri'],
    ['meline', 'mananaSH'],
    ['hayk', 'davit'],
    ['shushan', 'mariam'],
  ];
  shared.forEach(([a, b]) => {
    const gender: Gender = CLIENT_PLAN[a].female > 0.5 && CLIENT_PLAN[b].female > 0.3 ? 'female' : 'male';
    const p = newPerson(gender);
    members[a].push(p);
    members[b].push(p);
  });

  (Object.keys(CLIENT_PLAN) as BizKey[]).forEach((key) => {
    const plan = CLIENT_PLAN[key];
    while (members[key].length < plan.count) {
      members[key].push(newPerson(rng.chance(plan.female) ? 'female' : 'male'));
    }
  });

  const clients: Client[] = [];
  let n = 0;
  let blockedLeft = 4;
  (Object.keys(CLIENT_PLAN) as BizKey[]).forEach((key) => {
    members[key].forEach((p) => {
      n++;
      const sampled = rng.chance(0.3) ? rng.sample(TAGS, rng.int(1, 2)) : [];
      // «новый» и «постоянный» вместе не бывают
      const tags = sampled.includes('новый') && sampled.includes('постоянный') ? sampled.filter((x) => x !== 'новый') : sampled;
      const blocked = !p.appUserId && blockedLeft > 0 && rng.chance(0.04);
      if (blocked) blockedLeft--;
      clients.push({
        id: `cl_${String(n).padStart(3, '0')}`,
        businessId: BIZ[key],
        phone: p.phone,
        name: p.name,
        gender: p.gender,
        birthday: p.birthday,
        email: rng.chance(0.12) ? `client${n}@example.com` : undefined,
        note: rng.chance(0.2) ? rng.pick(notesFor(key)) : undefined,
        tags,
        appUserId: p.appUserId,
        noShowCount: rng.chance(0.1) ? rng.int(1, 3) : 0,
        blocked: blocked || undefined,
        createdAt: clock.at(-rng.int(10, 400), `${String(rng.int(9, 20)).padStart(2, '0')}:${rng.pick(['00', '15', '30', '45'])}`),
      });
    });
  });

  FIXPOINT_CLIENTS.forEach((c) =>
    clients.push({
      id: c.id,
      businessId: BIZ.fixpoint,
      phone: c.phone,
      name: c.name,
      gender: c.gender,
      tags: [],
      appUserId: c.appUserId,
      noShowCount: 0,
      createdAt: clock.at(-c.daysAgo, '12:00'),
    }),
  );

  return { appUsers, clients };
}
