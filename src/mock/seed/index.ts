import type { Booking, Client, CoreData } from '@/domain/core';
import { buildBookings } from '@/mock/seed/bookings';
import { buildBusinesses } from '@/mock/seed/businesses';
import { buildClients } from '@/mock/seed/clients';
import { addFixpointDropOff } from '@/mock/seed/dropoff';
import { makeClock } from '@/mock/seed/helpers';
import { Rng } from '@/mock/seed/random';
import { buildResources } from '@/mock/seed/resources';
import { buildMarks, buildSchedules } from '@/mock/seed/schedules';
import { buildServices } from '@/mock/seed/services';
import { buildStaff } from '@/mock/seed/staff';
import { BIZ } from '@/mock/seed/ids';

export { BIZ, LOC, NET, ST } from '@/mock/seed/ids';

/** Поднимите, если меняется сид ядра: сохранённые в браузере данные пересоздадутся. */
// 27.09.2026 (owner): «сегодня» в браузерах, засеянных несколько дней назад, уже не самый плотный день сида
// (fillChance(0) даёт максимум именно вокруг даты сида) — плюс новый шаг 4.5 в bookings.ts. Поднято, чтобы
// каждый браузер пересчитал сегодняшний день заново от РЕАЛЬНОГО текущего числа, а не от даты старого сида.
// 27.09.2026, второй раз (owner, «Ани без записей»): sv_nuri_gel теперь бронируется и «на дому» — её воскресная
// смена иначе не находит ни одной услуги-кандидата и держит 0 записей. Старый браузерный кеш bookings/services
// сам это не подхватит.
// 27.09.2026, третий раз (ресурсы): сидовые записи и события держат ЭКЗЕМПЛЯР ресурса (res_…_1), а не id ресурса —
// иначе движок занятости их не видел и журнал ставил вторую запись на занятое кресло/кабинет.
// 28.09.2026: ещё три барбера Kaytsak (Ваге, Самвел, Геворг) и 7 кресел вместо 4.
// 28.09.2026, ещё раз: полный пересев теперь стирает старые ключи bp-mock-db:* (db.ts) — версия 12 их не стирала.
// 28.09.2026: ещё 8 барберов Kaytsak — 15 мастеров, по субботам работают все; 15 кресел.
// 01.10.2026 (network, F-11-040): один человек ходит в оба филиала сети Manana — linkNetworkClient.
// 01.10.2026 (seed): noShowCount считается из записей, а не задаётся случайно.
// 03.10.2026 (заказы): демо-мастерская FixPoint (сфера repair) — владелец, два мастера, филиал, восемь клиентов.
// 05.10.2026 (запись на сдачу): у FixPoint услуга «Приём заказа», график мастеров и четыре записи на сдачу (dropoff.ts).
export const SEED_VERSION = 18;

/** Зерно ГПСЧ: одинаковое → одинаковые люди, услуги и расписание при каждом сиде */
const SEED = 20260924;

/**
 * Демо-данные ядра. Всё выдумано: бизнесы, люди, номера (бизнесы и сотрудники — +374 00 1XX XXX, кода 00 нет;
 * клиенты — выдуманные номера с мобильными кодами). Даты считаются от now: записи на ±30 дней от «сегодня» плюс
 * давняя история до 18 месяцев назад (сегменты «новые / постоянные / потерянные»), поэтому демо всегда живое.
 * Два пустых бизнеса-черновика (BIZ.empty, BIZ.emptySolo) — для проверки пустых состояний.
 */
export function seedCore(now: Date): CoreData {
  const clock = makeClock(now);
  const { networks, businesses, locations } = buildBusinesses(clock);
  const staff = buildStaff(clock);
  const { categories, services } = buildServices();
  staff.forEach((s) => {
    s.serviceIds = services.filter((x) => x.staffIds.includes(s.id)).map((x) => x.id);
  });
  const resources = buildResources();
  const { appUsers, clients } = buildClients(new Rng(SEED), clock);
  const schedules = buildSchedules(staff, clock);
  const calendarMarks = buildMarks(staff, schedules, new Rng(SEED + 1), clock);
  const { bookings, groupEvents } = buildBookings({
    rng: new Rng(SEED + 2),
    clock,
    businesses,
    staff,
    services,
    clients,
    resources,
    schedules,
    marks: calendarMarks,
  });

  // Карточка клиента появляется вместе с его первой записью (история уходит до 18 месяцев назад): иначе
  // «новый» клиент с первым визитом на прошлой неделе числился бы в базе с прошлого года
  const firstSeen = new Map<string, string>();
  bookings.forEach((b) => {
    if (!b.clientId) return;
    const prev = firstSeen.get(b.clientId);
    if (!prev || b.createdAt < prev) firstSeen.set(b.clientId, b.createdAt);
  });
  clients.forEach((c) => {
    const first = firstSeen.get(c.id);
    if (first) c.createdAt = first;
  });
  linkNetworkClient(clients, bookings);
  // Счётчик «Не пришёл» считается из самих записей (раньше задавался случайно и расходился с историей клиента)
  const noShows = new Map<string, number>();
  bookings.forEach((b) => {
    if (b.status === 'no_show' && b.clientId && !b.deletedAt) noShows.set(b.clientId, (noShows.get(b.clientId) ?? 0) + 1);
  });
  clients.forEach((c) => {
    c.noShowCount = noShows.get(c.id) ?? 0;
  });
  addFixpointDropOff(clock, staff, services, schedules, bookings);

  return {
    networks,
    businesses,
    locations,
    staff,
    serviceCategories: categories,
    services,
    resources,
    clients,
    appUsers,
    bookings,
    groupEvents,
    schedules,
    calendarMarks,
  };
}

/**
 * F-11-040 «клиент, ходивший в два филиала, — одна строка сети с числом филиалов 2»: в сиде такого не было.
 * Без нового расхода ГПСЧ (иначе сдвинулись бы все люди и записи): клиенту Шенгавита с визитами даём имя и
 * телефон клиентки Нор-Норка с визитами того же пола — в базе сети это один человек из двух филиалов.
 */
function linkNetworkClient(clients: Client[], bookings: Booking[]): void {
  const visited = new Set(bookings.filter((b) => b.status === 'arrived' && b.clientId).map((b) => b.clientId!));
  const pick = (businessId: string, gender?: string) =>
    clients.find((c) => c.businessId === businessId && !c.appUserId && !c.blocked && visited.has(c.id) && (!gender || c.gender === gender));
  const nn = pick(BIZ.mananaNN);
  const sh = nn && pick(BIZ.mananaSH, nn.gender);
  if (!nn || !sh) return;
  sh.name = nn.name;
  sh.phone = nn.phone;
  sh.birthday = nn.birthday;
}
