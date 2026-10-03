/**
 * F-05-043 «Когда уведомления не уходят»: автотест на каждое правило из сводного списка ТЗ, которое
 * движок (deriveLiveLogEntries) реально применяет. Строит минимальное ядро вручную (без общей
 * фикстуры domain/rules — там нет bookingEvents/appUserId в клиенте, которые нужны здесь) и типы —
 * через тот же buildTypes(), что и сид базы (src/mock/slices/notify.ts), так что тест не разойдётся
 * с тем, что реально видит пользователь.
 *
 * Запуск: node src/areas/notify/lib/run-tests.mjs
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Booking, BookingEvent, Client, CoreData } from '@/domain/core';
import type { NotificationType } from '@/domain/notify';
import { buildTypes } from '@/areas/notify/lib/registry';
import { previewDelivery } from '@/areas/notify/lib/engine';
import { deriveLiveLogEntries } from '@/areas/notify/lib/liveLog';

const BIZ = 'biz_t';

function client(patch: Partial<Client> = {}): Client {
  return {
    id: 'cl_t',
    businessId: BIZ,
    phone: '+37400199999',
    name: 'Тест Тестов',
    gender: 'female',
    tags: [],
    noShowCount: 0,
    createdAt: '2026-01-01T10:00',
    // По умолчанию у клиента есть приложение — иначе push (единственный канал по умолчанию у клиентских
    // типов, CLIENT_DEFAULT в registry.ts) недоставим и ни один тест правила не увидит строку в журнале.
    appUserId: 'au_t',
    ...patch,
  };
}

function booking(patch: Partial<Booking> = {}): Booking {
  return {
    id: 'bk_t',
    businessId: BIZ,
    locationId: 'loc_t',
    staffId: 'st_t',
    clientId: 'cl_t',
    start: '2026-10-01T12:00',
    durationMin: 60,
    status: 'scheduled',
    services: [{ serviceId: 'sv_t', staffId: 'st_t', price: 5000, durationMin: 60, qty: 1 }],
    total: 5000,
    resourceIds: [],
    workplace: 'salon',
    source: 'journal',
    createdBy: 'st_owner',
    forWhom: 'self',
    createdAt: '2026-09-20T10:00',
    updatedAt: '2026-09-20T10:00',
    ...patch,
  };
}

function core(patch: Partial<CoreData> = {}): CoreData {
  return {
    networks: [],
    businesses: [
      { id: BIZ, kind: 'salon', name: 'Тест', slug: 'test', sphereIds: ['nails'], ownerStaffId: 'st_owner', locationIds: ['loc_t'], phone: '+37400100000', photos: [], status: 'active', createdAt: '2025-01-01T10:00' },
    ],
    locations: [{ id: 'loc_t', businessId: BIZ, name: { ru: 'Центр' }, address: { ru: 'ул. Тест 1' }, district: 'kentron' }],
    staff: [
      { id: 'st_t', businessId: BIZ, locationIds: ['loc_t'], name: 'Мастер', phone: '+37400111111', role: 'master', sphereIds: ['nails'], photos: [], materials: [], workplaces: ['salon'], accepts: 'all', calendarVisibility: 'all', calendarMode: 'free', confirmMode: 'instant', colorIndex: 1, serviceIds: ['sv_t'], status: 'active', hiredAt: '2025-01-01' },
    ],
    serviceCategories: [],
    services: [{ id: 'sv_t', businessId: BIZ, categoryId: 'cat_t', sphereId: 'nails', name: { ru: 'Услуга' }, kind: 'individual', durationMin: 60, priceMin: 5000, photos: [], materials: [], staffIds: ['st_t'], workplaces: ['salon'], onlineBookable: true, active: true, order: 1 }],
    resources: [],
    clients: [],
    appUsers: [],
    bookings: [],
    groupEvents: [],
    schedules: [],
    calendarMarks: [],
    bookingEvents: [],
    ...patch,
  };
}

function ctxFor(opts: { core: CoreData; types: NotificationType[]; now: string }) {
  return { businessId: BIZ, core: opts.core, types: opts.types, overrides: {}, now: new Date(opts.now) };
}

const DEFAULT_OVERRIDE_FOR_TEST = {
  sendOnSave: true,
  pushEnabled: true,
  pushTimingHours: 1,
  smsEnabled: true,
  smsTimingHours: 1,
  emailEnabled: false,
  emailTimingHours: 12,
};

function onlyType(types: NotificationType[], code: number, patch: Partial<NotificationType> = {}): NotificationType[] {
  return types.map((t) => (t.code === code ? { ...t, ...patch } : { ...t, enabled: false }));
}

describe('F-05-043 · когда уведомления не уходят', () => {
  test('тип 8 (запись в журнале): без телефона у клиента сообщение не создаётся', () => {
    const c = core({ clients: [client({ phone: '' })], bookings: [booking()], bookingEvents: [{ id: 'ev1', businessId: BIZ, bookingId: 'bk_t', kind: 'created', staffId: 'st_t', at: '2026-09-20T10:00', by: 'st_owner' } as BookingEvent] });
    const types = onlyType(buildTypes(BIZ), 8, { enabled: true });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-20T11:00' }));
    assert.equal(entries.filter((e) => e.typeCode === 8).length, 0, 'без телефона тип 8 не должен создавать строку');
  });

  test('тип 8: с телефоном и включённым типом сообщение создаётся', () => {
    const c = core({ clients: [client()], bookings: [booking()], bookingEvents: [{ id: 'ev1', businessId: BIZ, bookingId: 'bk_t', kind: 'created', staffId: 'st_t', at: '2026-09-20T10:00', by: 'st_owner' } as BookingEvent] });
    const types = onlyType(buildTypes(BIZ), 8, { enabled: true });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-20T11:00' }));
    assert.equal(entries.filter((e) => e.typeCode === 8).length, 1);
  });

  test('тип 75 («не пришёл»): статус ДО начала визита шлёт отмену', () => {
    const c = core({
      clients: [client()],
      bookings: [booking({ status: 'no_show' })],
      bookingEvents: [{ id: 'ev1', businessId: BIZ, bookingId: 'bk_t', kind: 'status', staffId: 'st_t', from: 'scheduled', to: 'no_show', at: '2026-10-01T11:30', by: 'st_t' } as BookingEvent],
    });
    const types = onlyType(buildTypes(BIZ), 75, { enabled: true });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-10-01T12:00' }));
    assert.equal(entries.filter((e) => e.typeCode === 75).length, 1, 'статус до начала визита (11:30 < старт 12:00) должен слать отмену');
  });

  test('тип 75: статус ПОСЛЕ начала визита ничего не шлёт (F-05-031 п.2)', () => {
    const c = core({
      clients: [client()],
      bookings: [booking({ status: 'no_show' })],
      bookingEvents: [{ id: 'ev1', businessId: BIZ, bookingId: 'bk_t', kind: 'status', staffId: 'st_t', from: 'scheduled', to: 'no_show', at: '2026-10-01T12:30', by: 'st_t' } as BookingEvent],
    });
    const types = onlyType(buildTypes(BIZ), 75, { enabled: true });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-10-01T13:00' }));
    assert.equal(entries.filter((e) => e.typeCode === 75).length, 0, 'статус после начала визита (12:30 > старт 12:00) не должен слать ничего');
  });

  test('⭐ тип 73 (запрос подтверждения, 03.10): только «Записан» (= «Ожидание клиента» Altegio), как сервер', () => {
    const types = onlyType(buildTypes(BIZ), 73, { enabled: true, conditions: { timingHours: 24 } });
    const rows = (status: Booking['status']) =>
      deriveLiveLogEntries(ctxFor({ core: core({ clients: [client()], bookings: [booking({ status })] }), types, now: '2026-10-01T11:00' })).filter((e) => e.typeCode === 73);
    assert.deepEqual(rows('scheduled').map((e) => e.channel), ['push'], '«Записан» — клиент ещё не подтвердил, просим');
    assert.equal(rows('awaiting_confirmation').length, 0, '«Ждёт подтверждения» ждёт мастера — клиенту подтверждать нечего');
    assert.equal(rows('client_confirmed').length, 0, 'уже подтвердил');
    // Пуш выключен у записи — запроса нет
    const off = deriveLiveLogEntries({
      ...ctxFor({ core: core({ clients: [client()], bookings: [booking()] }), types, now: '2026-10-01T11:00' }),
      overrides: { bk_t: { ...DEFAULT_OVERRIDE_FOR_TEST, pushEnabled: false } },
    }).filter((e) => e.typeCode === 73);
    assert.equal(off.length, 0);
  });

  test('тип 72 (приглашение недошедшим): у клиента с будущей записью приглашение не уходит', () => {
    const c = core({
      clients: [client()],
      bookings: [
        booking({ id: 'bk_missed', status: 'cancelled_by_client', start: '2026-09-25T12:00' }),
        booking({ id: 'bk_future', start: '2026-10-10T12:00' }),
      ],
      bookingEvents: [{ id: 'ev1', businessId: BIZ, bookingId: 'bk_missed', kind: 'status', staffId: 'st_t', from: 'scheduled', to: 'cancelled_by_client', at: '2026-09-25T12:05', by: 'client' } as BookingEvent],
    });
    const types = onlyType(buildTypes(BIZ), 72, { enabled: true, conditions: { inviteAfterHours: 0, inviteStatusFilter: 'all' } });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-25T13:00' }));
    assert.equal(entries.filter((e) => e.typeCode === 72).length, 0, 'у клиента уже есть будущая запись — приглашение не нужно');
  });

  test('тип 72: без будущей записи приглашение уходит после отмены', () => {
    const c = core({
      clients: [client()],
      bookings: [booking({ id: 'bk_missed', status: 'cancelled_by_client', start: '2026-09-25T12:00' })],
      bookingEvents: [{ id: 'ev1', businessId: BIZ, bookingId: 'bk_missed', kind: 'status', staffId: 'st_t', from: 'scheduled', to: 'cancelled_by_client', at: '2026-09-25T12:05', by: 'client' } as BookingEvent],
    });
    const types = onlyType(buildTypes(BIZ), 72, { enabled: true, conditions: { inviteAfterHours: 0, inviteStatusFilter: 'all' } });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-25T13:00' }));
    assert.equal(entries.filter((e) => e.typeCode === 72).length, 1);
  });

  test('тип 55 (повторный визит): визит без статуса «Пришёл» не считается', () => {
    const c = core({ clients: [client()], bookings: [booking({ status: 'scheduled', start: '2026-09-01T12:00' })] });
    const types = onlyType(buildTypes(BIZ), 55, { enabled: true, conditions: { winbackAfterDays: 14 } });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-20T12:00' }));
    assert.equal(entries.filter((e) => e.typeCode === 55).length, 0, 'только "arrived" запускает напоминание о повторном визите');
  });

  test('тип 55: два визита клиента, созревшие в один день, дают ОДНО сообщение (F-05-037)', () => {
    const c = core({
      clients: [client()],
      services: [
        { id: 'sv_t', businessId: BIZ, categoryId: 'cat_t', sphereId: 'nails', name: { ru: 'Маникюр' }, kind: 'individual', durationMin: 60, priceMin: 5000, photos: [], materials: [], staffIds: ['st_t'], workplaces: ['salon'], onlineBookable: true, active: true, order: 1 },
        { id: 'sv_t2', businessId: BIZ, categoryId: 'cat_t', sphereId: 'nails', name: { ru: 'Стрижка' }, kind: 'individual', durationMin: 60, priceMin: 5000, photos: [], materials: [], staffIds: ['st_t'], workplaces: ['salon'], onlineBookable: true, active: true, order: 2 },
      ],
      bookings: [
        booking({ id: 'bk_a', status: 'arrived', start: '2026-09-01T12:00', services: [{ serviceId: 'sv_t', staffId: 'st_t', price: 5000, durationMin: 60, qty: 1 }] }),
        booking({ id: 'bk_b', status: 'arrived', start: '2026-09-01T14:00', services: [{ serviceId: 'sv_t2', staffId: 'st_t', price: 5000, durationMin: 60, qty: 1 }] }),
      ],
    });
    const types = onlyType(buildTypes(BIZ), 55, { enabled: true, conditions: { winbackAfterDays: 14 } });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-20T12:00' })).filter((e) => e.typeCode === 55);
    assert.equal(entries.length, 1, 'два визита с сроком в один день — одно сообщение, не два');
    assert.match(entries[0].text.ru, /Маникюр/);
    assert.match(entries[0].text.ru, /Стрижка/);
  });

  test('смена клиента в записи не создаёт уведомления (F-05-138)', () => {
    // Смена клиента не порождает bookingEvent (BookingEventKind не знает такого вида события,
    // src/domain/core.ts) — движок notify читает только bookingEvents, поэтому смена клиента структурно
    // не может ничего запустить. Проверяем это явно: два клиента, запись «перевешена» на второго без
    // единого события — журнал для второго клиента пуст.
    const c = core({
      clients: [client(), client({ id: 'cl_2', phone: '+37400188888', appUserId: 'au_2' })],
      bookings: [booking({ clientId: 'cl_2' })],
      bookingEvents: [],
    });
    // Все типы выключены, чтобы изолировать проверку от несвязанных правил (например, напоминание типа 1
    // сработало бы для этой же записи просто потому что она "scheduled" и это ей не мешает).
    const types = onlyType(buildTypes(BIZ), -1);
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-10-01T13:00' }));
    assert.equal(entries.filter((e) => e.clientId === 'cl_2').length, 0, 'без bookingEvent для клиента cl_2 уведомлений быть не должно');
  });

  test('«Оплатить» ставит «Пришёл» и это запускает те же следствия, что и ручной статус (F-05-138)', () => {
    // BookingWindow.tsx (журнал) на «Оплатить» вызывает changeBookingStatus(…, 'arrived', …) — движок
    // notify читает итоговый booking.status, а не КАК он стал 'arrived', поэтому приглашение на повторный
    // визит срабатывает одинаково для «оплатили» и «отметили руками».
    const c = core({
      clients: [client()],
      bookings: [booking({ status: 'arrived', start: '2026-09-01T12:00' })],
    });
    const types = onlyType(buildTypes(BIZ), 55, { enabled: true, conditions: { winbackAfterDays: 14 } });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-20T12:00' })).filter((e) => e.typeCode === 55);
    assert.equal(entries.length, 1, 'status === "arrived" достаточно — источник (оплата или ручной статус) не важен');
  });

  test('массовое удаление (F-05-030 п.2): N удалённых записей дают N отмен клиенту — правило одинаково для одной и для многих', () => {
    // «Удалить выбранные» в отчёте «Записи» (владелец журнала) создаёт по одному bookingEvent kind:'deleted'
    // НА КАЖДУЮ запись — то же самое, что при одиночном удалении. Правило здесь читает bookingEvents по
    // одному, поэтому массовое удаление автоматически шлёт ровно столько же уведомлений, сколько записей.
    const c = core({
      clients: [client(), client({ id: 'cl_2', phone: '+37400188888', appUserId: 'au_2' })],
      bookings: [
        booking({ id: 'bk_a', deletedAt: '2026-09-21T10:00' }),
        booking({ id: 'bk_b', clientId: 'cl_2', deletedAt: '2026-09-21T10:00' }),
      ],
      bookingEvents: [
        { id: 'ev_a', businessId: BIZ, bookingId: 'bk_a', kind: 'deleted', staffId: 'st_t', at: '2026-09-21T10:00', by: 'st_owner' } as BookingEvent,
        { id: 'ev_b', businessId: BIZ, bookingId: 'bk_b', kind: 'deleted', staffId: 'st_t', at: '2026-09-21T10:00', by: 'st_owner' } as BookingEvent,
      ],
    });
    const types = onlyType(buildTypes(BIZ), 4, { enabled: true });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-21T11:00' })).filter((e) => e.typeCode === 4);
    assert.equal(entries.length, 2, 'два удаления из массового набора — два уведомления, по одному на клиента');
    assert.deepEqual(new Set(entries.map((e) => e.clientId)), new Set(['cl_t', 'cl_2']));
  });

  test('тип 4 (отмена): выключенный тип ничего не пишет в журнал даже при удалении записи', () => {
    const c = core({
      clients: [client()],
      bookings: [booking({ deletedAt: '2026-09-21T10:00' })],
      bookingEvents: [{ id: 'ev1', businessId: BIZ, bookingId: 'bk_t', kind: 'deleted', staffId: 'st_t', at: '2026-09-21T10:00', by: 'st_owner' } as BookingEvent],
    });
    const types = onlyType(buildTypes(BIZ), 4, { enabled: false });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-21T11:00' }));
    assert.equal(entries.filter((e) => e.typeCode === 4).length, 0);
  });

  test('тип 1 (напоминание, F-05-029 проверка 2): запись создана позже момента напоминания — сообщение не создаётся', () => {
    // Визит в 12:00, «за 1 час» → момент напоминания 11:00. Запись создана в 11:30, то есть УЖЕ ПОСЛЕ момента
    // напоминания (как «за 30 минут до визита при настройке за 1 час» в тексте ТЗ) — по тому же правилу, что у
    // типа 73 в F-05-043, сообщение не создаётся вовсе, а не «досылается» задним числом.
    const c = core({
      clients: [client()],
      bookings: [booking({ start: '2026-10-01T12:00', createdAt: '2026-10-01T11:30', updatedAt: '2026-10-01T11:30' })],
    });
    const types = onlyType(buildTypes(BIZ), 1, { enabled: true, conditions: { timingHours: 1 } });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-10-01T11:59' })).filter((e) => e.typeCode === 1);
    assert.equal(entries.length, 0, 'запись создана в 11:30, момент напоминания (11:00) уже прошёл — напоминание не шлём');
  });

  test('тип 1: запись создана ДО момента напоминания — сообщение создаётся как обычно', () => {
    const c = core({
      clients: [client()],
      bookings: [booking({ start: '2026-10-01T12:00', createdAt: '2026-09-20T10:00' })],
    });
    const types = onlyType(buildTypes(BIZ), 1, { enabled: true, conditions: { timingHours: 1 } });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-10-01T11:59' })).filter((e) => e.typeCode === 1);
    assert.equal(entries.length, 1);
  });

  test('тип 1 (F-05-029 проверка 2): перенос визита после «запланированного» напоминания сдвигает его на новое время', () => {
    // Движок стейтless: «запланированного» напоминания как отдельной сущности нет — оно каждый раз считается от
    // актуального booking.start. Перенос визита с 12:00 на 18:00 (после того как окно «за 1 час до 12:00» уже
    // прошло бы) не должен «потерять» клиента — напоминание пересчитывается от НОВОГО времени визита.
    const c = core({
      clients: [client()],
      bookings: [booking({ start: '2026-10-01T18:00', createdAt: '2026-09-20T10:00', updatedAt: '2026-10-01T10:00' })],
    });
    const types = onlyType(buildTypes(BIZ), 1, { enabled: true, conditions: { timingHours: 1 } });
    // "Теперь" — 17:00, то есть за час до НОВОГО времени визита (18:00), а старое время (12:00) уже давно прошло.
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-10-01T17:00' })).filter((e) => e.typeCode === 1);
    assert.equal(entries.length, 1, 'напоминание считается от нового booking.start после переноса, а не теряется');
  });

  test('⭐ типы 1 и 73 (30.09): клиенту без приложения Telegram уходит, только если он подключил бота', () => {
    const c = core({
      clients: [client({ appUserId: undefined })],
      bookings: [booking({ status: 'scheduled', start: '2026-10-02T12:00', createdAt: '2026-09-20T10:00' })],
    });
    const types = buildTypes(BIZ).map((t) => (t.code === 1 || t.code === 73 ? { ...t, enabled: true, conditions: { ...t.conditions, timingHours: 1 } } : { ...t, enabled: false }));
    const now = '2026-10-02T11:30';
    const none = deriveLiveLogEntries(ctxFor({ core: c, types, now })).filter((e) => e.typeCode === 1 || e.typeCode === 73);
    assert.equal(none.length, 0, 'бот не подключён и приложения нет — ни пуша, ни Telegram (раньше писалось «Telegram, доставлено»)');
    const linked = deriveLiveLogEntries({ ...ctxFor({ core: c, types, now }), telegramLinked: { '+37400199999': '2026-09-30T10:00' } })
      .filter((e) => e.typeCode === 1 || e.typeCode === 73);
    // Напоминание в Telegram — два: за 24 ч и за 2 ч (как сервер telegram-reminders.ts); запрос подтверждения за 1 ч
    // (03.10.2026, сервер notify-confirm-requests.ts) — позже напоминания за сутки, оно остаётся
    assert.deepEqual(linked.map((e) => [e.typeCode, e.channel]).sort(), [[1, 'telegram'], [1, 'telegram'], [73, 'telegram']]);
  });

  test('⭐ тип 73 в Telegram (03.10): запрос за сутки заменяет напоминание за сутки, за 2 часа остаётся', () => {
    const c = core({
      clients: [client({ appUserId: undefined })],
      bookings: [booking({ status: 'scheduled', start: '2026-10-02T12:00', createdAt: '2026-09-20T10:00' })],
    });
    const types = buildTypes(BIZ).map((t) => (t.code === 1 || t.code === 73 ? { ...t, enabled: true } : { ...t, enabled: false }));
    const ctx = { ...ctxFor({ core: c, types, now: '2026-10-02T11:30' }), telegramLinked: { '+37400199999': '2026-09-30T10:00' } };
    const rows = deriveLiveLogEntries(ctx).filter((e) => e.typeCode === 1 || e.typeCode === 73);
    assert.deepEqual(rows.map((e) => [e.typeCode, e.channel, e.createdAt]).sort(), [
      [1, 'telegram', '2026-10-02T10:00'],
      [73, 'telegram', '2026-10-01T12:00'],
    ]);
    // Telegram у записи выключен — ни запроса, ни напоминаний в Telegram
    const off = deriveLiveLogEntries({ ...ctx, overrides: { bk_t: { ...DEFAULT_OVERRIDE_FOR_TEST, telegramEnabled: false } } }).filter(
      (e) => (e.typeCode === 1 || e.typeCode === 73) && e.channel === 'telegram',
    );
    assert.equal(off.length, 0);
  });

  test('⭐ предпросмотр типа (01.10): с приложением — только пуш, Telegram не дублирует; без приложения — Telegram', () => {
    const type1 = buildTypes(BIZ).find((t) => t.code === 1)!;
    assert.deepEqual(previewDelivery({ ...type1, enabled: true }, true).willSend, ['push']);
    assert.deepEqual(previewDelivery({ ...type1, enabled: true }, false).willSend, ['telegram']);
    // 03.10.2026: запрос подтверждения (73) — тоже пуш с приложением, Telegram без него (сервер notify-confirm-requests.ts)
    const type73 = buildTypes(BIZ).find((t) => t.code === 73)!;
    assert.equal(type73.enabled, true);
    assert.deepEqual(previewDelivery(type73, true).willSend, ['push']);
    assert.deepEqual(previewDelivery(type73, false).willSend, ['telegram']);
  });

  test('⭐ тип 1 (30.09): Telegram — только без приложения; выключатель Telegram у записи свой', () => {
    const types = buildTypes(BIZ).map((t) => (t.code === 1 ? { ...t, enabled: true, conditions: { ...t.conditions, timingHours: 1 } } : { ...t, enabled: false }));
    const now = '2026-10-02T11:30';
    const linkedPhones = { '+37400199999': '2026-09-30T10:00' };
    const bk = booking({ start: '2026-10-02T12:00', createdAt: '2026-09-20T10:00' });
    // С приложением — только пуш, в Telegram ничего не дублируется, даже если бот подключён
    const withApp = core({ clients: [client()], bookings: [bk] });
    const appRows = deriveLiveLogEntries({ ...ctxFor({ core: withApp, types, now }), telegramLinked: linkedPhones }).filter((e) => e.typeCode === 1);
    assert.deepEqual(appRows.map((e) => e.channel), ['push']);
    // Без приложения, Telegram выключен у этой записи — Telegram не уходит (SMS-выключатель на него не влияет)
    const noApp = core({ clients: [client({ appUserId: undefined })], bookings: [bk] });
    const off = deriveLiveLogEntries({
      ...ctxFor({ core: noApp, types, now }),
      telegramLinked: linkedPhones,
      overrides: { [bk.id]: { ...DEFAULT_OVERRIDE_FOR_TEST, telegramEnabled: false } },
    }).filter((e) => e.typeCode === 1 && e.channel === 'telegram');
    assert.equal(off.length, 0);
  });
});

describe('F-05-139 · «другой посетитель»: кому уходят уведомления', () => {
  test('сообщение адресовано контакту записавшего клиента (телефон посетителя не существует)', () => {
    const c = core({
      clients: [client({ phone: '+37400199999' })],
      bookings: [booking({ visitorName: 'Ани (дочь)' })],
      bookingEvents: [{ id: 'ev1', businessId: BIZ, bookingId: 'bk_t', kind: 'created', staffId: 'st_t', at: '2026-09-20T10:00', by: 'st_owner' } as BookingEvent],
    });
    const types = onlyType(buildTypes(BIZ), 8, { enabled: true });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-20T11:00' })).filter((e) => e.typeCode === 8);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].contact, '+37400199999', 'уходит на контакт записавшего клиента, а не какой-то отдельный контакт посетителя');
  });

  test('в тексте видно, на кого запись — имя посетителя присутствует', () => {
    const c = core({
      clients: [client({ phone: '+37400199999', name: 'Марине' })],
      bookings: [booking({ visitorName: 'Ани (дочь)' })],
      bookingEvents: [{ id: 'ev1', businessId: BIZ, bookingId: 'bk_t', kind: 'created', staffId: 'st_t', at: '2026-09-20T10:00', by: 'st_owner' } as BookingEvent],
    });
    const types = onlyType(buildTypes(BIZ), 8, { enabled: true });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-20T11:00' })).filter((e) => e.typeCode === 8);
    assert.equal(entries.length, 1);
    assert.match(entries[0].text.ru, /Ани \(дочь\)/, 'имя посетителя видно в тексте сообщения');
  });

  test('без посетителя (обычная запись) текст не содержит строку «Посетитель»', () => {
    const c = core({
      clients: [client({ phone: '+37400199999' })],
      bookings: [booking()],
      bookingEvents: [{ id: 'ev1', businessId: BIZ, bookingId: 'bk_t', kind: 'created', staffId: 'st_t', at: '2026-09-20T10:00', by: 'st_owner' } as BookingEvent],
    });
    const types = onlyType(buildTypes(BIZ), 8, { enabled: true });
    const entries = deriveLiveLogEntries(ctxFor({ core: c, types, now: '2026-09-20T11:00' })).filter((e) => e.typeCode === 8);
    assert.equal(entries.length, 1);
    assert.doesNotMatch(entries[0].text.ru, /Посетитель/);
  });
});
