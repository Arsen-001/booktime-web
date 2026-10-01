'use client';

/** Визиты клиента: история, прошлый визит, сводка по клиентам, отметка «пришёл / не пришёл». */
import type { ClientFile, ClientRow, ClientVisit, CrmSummary, PastVisitInput, PendingMark, StaffSummaryRow } from '@/domain/clients';
import { clientMoney, emptyProfile, visitPaid } from '@/domain/clients';
import type { Booking, BookingStatus, Id, ISODate, ISODateTime, Money } from '@/domain/core';
import { readArea, readCore, mutateArea } from '@/api/area';
import { assertCan, canNow, coreCreate, coreTx, currentActor } from '@/api/core';
import { ApiError, request } from '@/api/request';
import { isApiMode } from '@/api/http';
import * as S from '@/api/journal.server';
import * as C from '@/api/clients/clients.server';
import { ACTIVE_STATUSES, FINAL_STATUSES, isCancelled } from '@/domain/rules';
import { newId } from '@/lib/id';
import { addDays, nowDateTime } from '@/lib/date';
import { recalcClientLoyaltyImpl } from '@/api/clients/loyalty';
import { bizSettings, DuplicatePhoneError, validatePhone, staffName } from '@/api/clients/shared';

// ─────────────────────────── История визитов (F-04-075…077, 156, 167, 179, 226) ───────────────────────────

/** В историю визитов попадают итоговые статусы визита (пришёл / не пришёл); отменённые — нет (F-04-226) */
const VISIT_HISTORY_STATUSES: readonly BookingStatus[] = FINAL_STATUSES.filter((st) => !isCancelled(st));

/**
 * Визиты клиента, объединённые по visitId (F-01-041). Отменённые/удалённые не включаем — они пропадают
 * из истории по нашему решению 1:1 с Altegio (F-04-226); их видно в «Отчётах → Записи» (раздел reports).
 */
export function listClientVisits(businessId: Id, clientId: Id): Promise<ClientVisit[]> {
  if (isApiMode()) return apiListClientVisits(businessId, clientId);
  return request(() => {
    const core = readCore();
    const state = readArea('clients');
    // Долг считается тем же правилом, что и «Баланс» в карточке и списке (domain/clients/money)
    const client = core.clients.find((c) => c.id === clientId);
    const profile = state.profiles[clientId] ?? emptyProfile();
    const arrivedAll = core.bookings.filter((b) => b.clientId === clientId && b.status === 'arrived' && !b.deletedAt);
    const balance = client ? clientMoney(arrivedAll, state.manualVisitPayments, profile.paidAmount, profile.importedSold ?? 0).balance : 0;

    const bookings = core.bookings.filter(
      (b) => b.clientId === clientId && b.businessId === businessId && !b.deletedAt && VISIT_HISTORY_STATUSES.includes(b.status),
    );
    const groups = new Map<string, Booking[]>();
    bookings.forEach((b) => {
      const key = b.visitId ?? b.id;
      groups.set(key, [...(groups.get(key) ?? []), b]);
    });

    const rows: ClientVisit[] = [];
    groups.forEach((list, key) => {
      const first = list[0];
      const total = list.reduce((sum, b) => sum + b.total, 0);
      const services = list.flatMap((b) =>
        b.services.map((line) => ({
          serviceId: line.serviceId,
          price: line.price * line.qty,
        })),
      );
      const payment = state.manualVisitPayments[key];
      const isArrived = first.status === 'arrived';
      const paid = visitPaid(total, first.status, payment);
      let paymentStatus: 'paid' | 'unpaid' | 'debt' = 'paid';
      if (!isArrived) paymentStatus = 'unpaid';
      else if (paid >= total) paymentStatus = 'paid';
      else paymentStatus = balance < 0 ? 'debt' : 'unpaid';

      rows.push({
        id: key,
        clientId,
        date: first.start,
        staffId: first.staffId,
        services,
        total,
        paid,
        paymentStatus,
        method: payment?.method,
        status: first.status,
        manual: Boolean(payment) && first.source === 'phone',
        groupEvent: Boolean(first.groupEventId),
        photoIds: (state.files[clientId] ?? []).filter((f) => f.visitId === key).map((f) => f.id),
        note: first.comment,
      });
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  });
}

/**
 * Этап 21 (лейн services+rest): `listClientVisits` в режиме api — те же записи, но живые (`S.listBookings`,
 * не то, что уже случайно осело в зеркале), и «Оплачено» — то же правило, что бэкенд уже считает сам
 * (`clients.visits.ts::withVisits` бэкенда, 1:1 с `domain/clients/money.ts::visitPaid`): визит «Пришёл» без явной
 * оплаты (`BookingExtras.paidAmount` — единый счётчик, `booking-payments.service.ts`, в т.ч. из finance) считается
 * оплаченным полностью; явная оплата — как есть. «Баланс» — из уже готовой карточки клиента (`getClientRow`,
 * этап 5), а не пересчитан заново: одно и то же число должно совпадать в карточке и в истории визитов.
 * `method` — честно `undefined` (в отличие от мока): по одному только `paidAmount` способ оплаты не восстановить,
 * а платёжные строки (`BookingPaymentLine.method`) сюда не отданы (были бы по запросу на визит — не в счёте этого
 * этапа, см. PROGRESS.md).
 */
async function apiListClientVisits(businessId: Id, clientId: Id): Promise<ClientVisit[]> {
  const [bookings, row] = await Promise.all([
    S.listBookings({ businessId, clientId, statuses: [...VISIT_HISTORY_STATUSES] }),
    C.getClientRow(businessId, clientId).catch(() => undefined as ClientRow | undefined),
  ]);
  const balance = row?.balance ?? 0;
  const extras = bookings.length ? await S.listExtrasByIds(bookings.map((b) => b.id)) : {};

  const groups = new Map<string, Booking[]>();
  bookings.forEach((b) => {
    const key = b.visitId ?? b.id;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  });

  const rows: ClientVisit[] = [];
  groups.forEach((list, key) => {
    const first = list[0];
    const total = list.reduce((sum, b) => sum + b.total, 0);
    const services = list.flatMap((b) =>
      b.services.map((line) => ({
        serviceId: line.serviceId,
        price: line.price * line.qty,
      })),
    );
    const isArrived = first.status === 'arrived';
    // Тот же приём, что бэкенд (clients.visits.ts::withVisits): явная оплата есть — берём её сумму, иначе
    // «Пришёл» считается оплаченным полностью целиком по визиту.
    const explicitPaid = list.reduce((sum, b) => sum + (extras[b.id]?.paidAmount ?? 0), 0);
    const paid = explicitPaid > 0 ? explicitPaid : isArrived ? total : 0;
    let paymentStatus: 'paid' | 'unpaid' | 'debt' = 'paid';
    if (!isArrived) paymentStatus = 'unpaid';
    else if (paid >= total) paymentStatus = 'paid';
    else paymentStatus = balance < 0 ? 'debt' : 'unpaid';

    rows.push({
      id: key,
      clientId,
      date: first.start,
      staffId: first.staffId,
      services,
      total,
      paid,
      paymentStatus,
      method: undefined,
      status: first.status,
      manual: explicitPaid > 0 && first.source === 'phone',
      groupEvent: Boolean(first.groupEventId),
      photoIds: (readArea('clients').files[clientId] ?? []).filter((f) => f.visitId === key).map((f) => f.id),
      note: first.comment,
    });
  });
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/** F-04-167: только визиты, оплаченные счётом клиента в минус */
export function listDebtVisits(businessId: Id, clientId: Id): Promise<ClientVisit[]> {
  return listClientVisits(businessId, clientId).then((rows) => rows.filter((r) => r.paymentStatus === 'debt'));
}

/**
 * Мастер вносит прошлый визит без записи в календаре (F-00-129): клиент любой, не только из приложения.
 * Проверок слотов нет (createBooking «как есть») — это ретроактивная запись факта, не бронь времени.
 */
export function addPastVisit(input: PastVisitInput): Promise<ClientVisit> {
  if (isApiMode()) return apiAddPastVisit(input);
  return request(() => {
    assertCan('clients.edit');
    const lines = input.services.filter((l) => (l.customName?.trim() || l.serviceId) && l.price >= 0);
    if (lines.length === 0) throw new ApiError('no_services', 'Укажите хотя бы одну услугу');
    const total = lines.reduce((sum, l) => sum + l.price, 0);
    const start = `${input.date}T${input.time}` as ISODateTime;
    if (start > nowDateTime()) throw new ApiError('future_visit', 'Прошлый визит не может быть в будущем');
    const core = readCore();
    const locationId = input.locationId ?? core.businesses.find((b) => b.id === input.businessId)?.locationIds[0];
    if (!locationId) throw new ApiError('no_location', 'У бизнеса нет филиала');

    // Одна операция (arch-a1 №6): новый клиент и его визит — в одном запросе, упало — не останется ни того, ни другого
    let clientId = input.clientId;
    if (!clientId && input.newClient) {
      const name = input.newClient.name.trim();
      if (!name) throw new ApiError('name_required', 'Укажите имя клиента');
      const phone = validatePhone(input.newClient.phone);
      const existing = core.clients.find((c) => c.businessId === input.businessId && c.phone === phone && !c.deletedAt);
      if (existing) throw new DuplicatePhoneError(existing.id);
      clientId = coreTx.create('clients', {
        businessId: input.businessId,
        phone,
        name,
        gender: 'unknown',
        tags: [],
        noShowCount: 0,
        createdAt: nowDateTime(),
      }).id;
    }
    if (!clientId) throw new ApiError('client_required', 'Укажите клиента');
    const cid: Id = clientId;

    const booking = coreTx.createBooking({
      businessId: input.businessId,
      locationId,
      staffId: input.staffId,
      clientId: cid,
      start,
      status: 'arrived',
      services: lines.map((l) => ({
        serviceId: l.serviceId ?? newId('svcline'),
        staffId: input.staffId,
        price: l.price,
        durationMin: 30,
        qty: 1,
      })),
      resourceIds: [],
      workplace: 'salon',
      source: 'phone',
      createdBy: 'business',
      forWhom: 'self',
      comment: input.note?.trim() || undefined,
    });

    mutateArea('clients', (s) => {
      s.manualVisitPayments[booking.id] = {
        paidAmount: input.paidAmount,
        method: input.method,
      };
      if (input.photos?.length) {
        const files: ClientFile[] = input.photos.map((p) => ({
          id: newId('file'),
          clientId: cid,
          name: p.name,
          ext: p.ext,
          size: p.size,
          dataUrl: p.dataUrl,
          uploadedAt: nowDateTime(),
          uploadedBy: staffName(input.staffId),
          visitId: booking.id,
        }));
        s.files[cid] = [...(s.files[cid] ?? []), ...files];
      }
    });

    return {
      id: booking.id,
      clientId: cid,
      date: booking.start,
      staffId: booking.staffId,
      services: lines.map((l) => ({
        serviceId: l.serviceId,
        customName: l.customName,
        price: l.price,
      })),
      total,
      paid: input.paidAmount,
      paymentStatus: input.paidAmount >= total ? 'paid' : 'unpaid',
      method: input.method,
      status: 'arrived',
      manual: true,
      groupEvent: false,
      photoIds: [],
      note: input.note,
    };
  });
}

// ─────────────────────────── Сводка CRM (F-00-126, F-00-131) ───────────────────────────

export interface SummaryPeriod {
  from: ISODate;
  to: ISODate;
}

/**
 * Кто вообще считается клиентом в этих цифрах (F-04-222): только записи «Клиент пришел», и только если у
 * клиента есть номер телефона — «посетитель» на чужом номере не даёт отдельного клиента, запись без клиента
 * (F-04-065) в клиентскую аналитику не попадает вовсе (наш вывод по F-00-128).
 */
function isCountedArrival(core: ReturnType<typeof readCore>, b: Booking): boolean {
  if (b.status !== 'arrived' || b.deletedAt || !b.clientId) return false;
  return Boolean(core.clients.find((c) => c.id === b.clientId)?.phone);
}

/** F-04-123/124/185: «потерян» — был хотя бы один визит когда-либо, и от последнего визита до `asOf` прошло больше `afterDays` */
function countLost(arrivalsByClient: Map<Id, Booking[]>, asOf: ISODate, afterDays: number): number {
  const cutoff = addDays(asOf, -afterDays);
  let count = 0;
  arrivalsByClient.forEach((list) => {
    const last = list.reduce((max, b) => (b.start > max ? b.start : max), list[0].start);
    if (last.slice(0, 10) < cutoff) count += 1;
  });
  return count;
}

export function getCrmSummary(businessId: Id, period: SummaryPeriod): Promise<CrmSummary> {
  if (isApiMode()) return apiGetCrmSummary(businessId, period);
  return request(() => {
    const core = readCore();
    // ux-r5 №10, F-00-132: без права на отчёты сотрудник видит только свои визиты — не выручку всего салона
    const actor = currentActor();
    const ownOnly = !canNow('reports.view') && Boolean(actor.staffId);

    // F-04-185: локация смотрит только свои визиты — весь расчёт «потерянных» локации идёт по одному businessId
    const arrivedAllTime = core.bookings.filter((b) => b.businessId === businessId && isCountedArrival(core, b));
    const bookings = arrivedAllTime.filter(
      (b) => b.start.slice(0, 10) >= period.from && b.start.slice(0, 10) <= period.to && (!ownOnly || b.staffId === actor.staffId),
    );

    const revenue = bookings.reduce((sum, b) => sum + b.total, 0);
    const clientIds = new Set(bookings.map((b) => b.clientId).filter(Boolean) as Id[]);

    const byStaffMap = new Map<Id, StaffSummaryRow>();
    bookings.forEach((b) => {
      const row = byStaffMap.get(b.staffId) ?? {
        staffId: b.staffId,
        name: staffName(b.staffId),
        revenue: 0,
        hoursBooked: 0,
        visits: 0,
      };
      row.revenue += b.total;
      row.hoursBooked += b.durationMin / 60;
      row.visits += 1;
      byStaffMap.set(b.staffId, row);
    });

    // F-04-125: «Новые» — первый визит клиента (когда-либо, в этой локации) попал в период; иначе «не новый»
    const arrivalsByClientLocal = new Map<Id, Booking[]>();
    arrivedAllTime.forEach((b) => {
      const id = b.clientId as Id;
      arrivalsByClientLocal.set(id, [...(arrivalsByClientLocal.get(id) ?? []), b]);
    });
    let newClients = 0;
    let repeatClients = 0;
    clientIds.forEach((id) => {
      const list = arrivalsByClientLocal.get(id) ?? [];
      const first = list.reduce((min, b) => (b.start < min ? b.start : min), list[0]?.start ?? '');
      if (first.slice(0, 10) >= period.from) newClients += 1;
      else repeatClients += 1;
    });

    // F-04-123: срок этой локации (ClientsBizSettings.lostAfterDays), считаем «на конец периода»
    const lostAfterDays = bizSettings(businessId).lostAfterDays;
    const lostClients = countLost(arrivalsByClientLocal, period.to, lostAfterDays);

    // F-04-124/185 ⭐: та же формула по всей сети (все businessId с тем же networkId) — свой филиал не в счёт «потерянных» сети
    const networkId = core.businesses.find((b) => b.id === businessId)?.networkId;
    let networkLostClients: number | undefined;
    if (networkId) {
      const networkBusinessIds = new Set(core.businesses.filter((b) => b.networkId === networkId).map((b) => b.id));
      const arrivedNetwork = core.bookings.filter((b) => networkBusinessIds.has(b.businessId) && isCountedArrival(core, b));
      const arrivalsByClientNetwork = new Map<Id, Booking[]>();
      arrivedNetwork.forEach((b) => {
        const id = b.clientId as Id;
        arrivalsByClientNetwork.set(id, [...(arrivalsByClientNetwork.get(id) ?? []), b]);
      });
      networkLostClients = countLost(arrivalsByClientNetwork, period.to, lostAfterDays);
    }

    // F-04-163: клиент со статусом «Не пришёл» в бизнесе, кого в этом же периоде перезаписали и он дошёл
    const noShowClientIds = new Set(
      core.bookings.filter((b) => b.businessId === businessId && b.status === 'no_show' && !b.deletedAt && b.clientId).map((b) => b.clientId as Id),
    );
    const rebookedNoShows = new Set(bookings.filter((b) => b.clientId && noShowClientIds.has(b.clientId)).map((b) => b.clientId)).size;

    return {
      revenue,
      clientsCount: clientIds.size,
      visitsCount: bookings.length,
      byStaff: Array.from(byStaffMap.values()).sort((a, b) => b.revenue - a.revenue),
      ownOnly,
      newClients,
      repeatClients,
      lostClients,
      networkLostClients,
      rebookedNoShows,
    };
  });
}

function groupByClient(bookings: Booking[]): Map<Id, Booking[]> {
  const map = new Map<Id, Booking[]>();
  bookings.forEach((b) => {
    const id = b.clientId as Id;
    map.set(id, [...(map.get(id) ?? []), b]);
  });
  return map;
}

/**
 * Этап 21 (лейн services+rest): `getCrmSummary` в режиме api — те же данные, но по-настоящему живые записи
 * (`S.listBookings`) вместо того, что уже случайно осело в зеркале браузера (правило K7 не про мгновенные
 * подборки — про честные суммы отчёта). «Есть ли телефон» (F-04-222) — по настоящему списку клиентов бизнеса
 * (`listClientRows`, этап 5), а не по зеркалу: клиенты сознательно НЕ входят в общий снимок `/core` (K8).
 * Сетевой «потерянный» (F-04-124/185) — best-effort: сеть уже есть в зеркале (этап 3, `/core`), но список
 * клиентов и записи соседних филиалов запрашиваются отдельно и требуют членства во всех них; нет доступа —
 * `networkLostClients` остаётся `undefined` (честнее выдуманного нуля), как и у мока без сети.
 */
async function apiGetCrmSummary(businessId: Id, period: SummaryPeriod): Promise<CrmSummary> {
  const actor = currentActor();
  const ownOnly = !canNow('reports.view') && Boolean(actor.staffId);

  const [clientRows, allTime] = await Promise.all([
    C.listClientRows(businessId),
    S.listBookings({ businessId, statuses: ['arrived', 'no_show'] }),
  ]);
  const phoneClientIds = new Set(clientRows.filter((c) => c.phone).map((c) => c.id));
  const isCounted = (b: Booking) => b.status === 'arrived' && !b.deletedAt && Boolean(b.clientId) && phoneClientIds.has(b.clientId as Id);

  // F-04-185: локация смотрит только свои визиты — весь расчёт «потерянных» локации идёт по одному businessId
  const arrivedAllTime = allTime.filter(isCounted);
  const bookings = arrivedAllTime.filter(
    (b) => b.start.slice(0, 10) >= period.from && b.start.slice(0, 10) <= period.to && (!ownOnly || b.staffId === actor.staffId),
  );

  const revenue = bookings.reduce((sum, b) => sum + b.total, 0);
  const clientIds = new Set(bookings.map((b) => b.clientId).filter(Boolean) as Id[]);

  const byStaffMap = new Map<Id, StaffSummaryRow>();
  bookings.forEach((b) => {
    const row = byStaffMap.get(b.staffId) ?? { staffId: b.staffId, name: staffName(b.staffId), revenue: 0, hoursBooked: 0, visits: 0 };
    row.revenue += b.total;
    row.hoursBooked += b.durationMin / 60;
    row.visits += 1;
    byStaffMap.set(b.staffId, row);
  });

  // F-04-125: «Новые» — первый визит клиента (когда-либо, в этой локации) попал в период; иначе «не новый»
  const arrivalsByClientLocal = groupByClient(arrivedAllTime);
  let newClients = 0;
  let repeatClients = 0;
  clientIds.forEach((id) => {
    const list = arrivalsByClientLocal.get(id) ?? [];
    const first = list.reduce((min, b) => (b.start < min ? b.start : min), list[0]?.start ?? '');
    if (first.slice(0, 10) >= period.from) newClients += 1;
    else repeatClients += 1;
  });

  // F-04-123: срок этой локации (ClientsBizSettings.lostAfterDays), считаем «на конец периода»
  const lostAfterDays = bizSettings(businessId).lostAfterDays;
  const lostClients = countLost(arrivalsByClientLocal, period.to, lostAfterDays);

  // F-04-124/185 ⭐: та же формула по всей сети — best-effort, см. докстринг функции
  const network = readCore().networks.find((n) => n.businessIds.includes(businessId));
  let networkLostClients: number | undefined;
  if (network) {
    try {
      const peerIds = network.businessIds.filter((id) => id !== businessId);
      if (!peerIds.length) {
        networkLostClients = lostClients;
      } else {
        const [networkBookings, peerClientRows] = await Promise.all([
          S.listBookings({ businessId, businessIds: network.businessIds, statuses: ['arrived'] }),
          Promise.all(peerIds.map((id) => C.listClientRows(id))),
        ]);
        const networkPhoneIds = new Set(phoneClientIds);
        peerClientRows.flat().forEach((c) => {
          if (c.phone) networkPhoneIds.add(c.id);
        });
        const arrivedNetwork = networkBookings.filter((b) => b.status === 'arrived' && !b.deletedAt && b.clientId && networkPhoneIds.has(b.clientId));
        networkLostClients = countLost(groupByClient(arrivedNetwork), period.to, lostAfterDays);
      }
    } catch {
      networkLostClients = undefined;
    }
  }

  // F-04-163: клиент со статусом «Не пришёл» в бизнесе, кого в этом же периоде перезаписали и он дошёл
  const noShowClientIds = new Set(allTime.filter((b) => b.status === 'no_show' && !b.deletedAt && b.clientId).map((b) => b.clientId as Id));
  const rebookedNoShows = new Set(bookings.filter((b) => b.clientId && noShowClientIds.has(b.clientId)).map((b) => b.clientId)).size;

  return { revenue, clientsCount: clientIds.size, visitsCount: bookings.length, byStaff: Array.from(byStaffMap.values()).sort((a, b) => b.revenue - a.revenue), ownOnly, newClients, repeatClients, lostClients, networkLostClients, rebookedNoShows };
}

/** Прошедшие по времени записи без отметки «пришёл/не пришёл» (F-00-127) */
export function listPendingMarks(businessId: Id): Promise<PendingMark[]> {
  if (isApiMode()) return apiListPendingMarks(businessId);
  return request(() => {
    const core = readCore();
    const now = nowDateTime();
    const actor = currentActor();
    const seeOthers = canNow('journal.others') || !actor.staffId;
    return (
      core.bookings
        // Прошедшие по времени, но ещё не итоговые (ядро: ACTIVE_STATUSES); без права на чужие записи — только свои
        .filter(
          (b) =>
            b.businessId === businessId && !b.deletedAt && ACTIVE_STATUSES.includes(b.status) && b.start < now && (seeOthers || b.staffId === actor.staffId),
        )
        .map((b) => ({
          bookingId: b.id,
          clientId: b.clientId,
          clientName: core.clients.find((c) => c.id === b.clientId)?.name ?? b.visitorName ?? '—',
          staffId: b.staffId,
          staffName: staffName(b.staffId),
          start: b.start,
          services: b.services.map((l) => core.services.find((s) => s.id === l.serviceId)?.id ?? l.serviceId).join(', '),
          total: b.total,
        }))
        .sort((a, b) => a.start.localeCompare(b.start))
    );
  });
}

/**
 * Этап 21 (лейн services+rest): `listPendingMarks` в режиме api — живые записи (`S.listBookings`, ACTIVE_STATUSES
 * уже бывшие/будущие, а не история — набор небольшой) + имена клиентов из `listClientRows` (клиенты не в `/core`,
 * K8). `services` — как у мока: `l.serviceId` ровно то же значение, что и `core.services.find(...)?.id`, найден
 * сервис или нет (совпадает по построению), так что подставлять каталог не нужно.
 */
async function apiListPendingMarks(businessId: Id): Promise<PendingMark[]> {
  const now = nowDateTime();
  const actor = currentActor();
  const seeOthers = canNow('journal.others') || !actor.staffId;
  const [bookings, clientRows] = await Promise.all([
    S.listBookings({ businessId, statuses: [...ACTIVE_STATUSES], staffId: seeOthers ? undefined : actor.staffId }),
    C.listClientRows(businessId),
  ]);
  const nameById = new Map(clientRows.map((c) => [c.id, c.name]));
  return bookings
    .filter((b) => !b.deletedAt && b.start < now)
    .map((b) => ({
      bookingId: b.id,
      clientId: b.clientId,
      clientName: (b.clientId && nameById.get(b.clientId)) || b.visitorName || '—',
      staffId: b.staffId,
      staffName: staffName(b.staffId),
      start: b.start,
      services: b.services.map((l) => l.serviceId).join(', '),
      total: b.total,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Отметка «пришёл · сумма» (F-00-127, F-04-156): статус + при необходимости правка итоговой суммы */
export function markVisitArrived(bookingId: Id, amount: Money): Promise<Booking> {
  if (isApiMode()) {
    return S.markArrived(bookingId, amount).then(async (b) => {
      if (b.clientId) await request(() => recalcClientLoyaltyImpl(b.businessId, b.clientId!, 'statusArrived'));
      return b;
    });
  }
  return request(async () => {
    const booking = coreTx.changeBookingStatus(bookingId, 'arrived');
    const result = amount !== booking.total ? coreTx.update('bookings', bookingId, { total: amount }) : booking;
    // F-04-121: один из трёх моментов пересчёта автоправил — сохранение записи в статусе «Клиент пришел»
    if (result.clientId) await recalcClientLoyaltyImpl(result.businessId, result.clientId, 'statusArrived');
    return result;
  });
}

/** Отметка «не пришёл» (F-00-127, F-04-156): счётчик неявок ставит ядро (changeBookingStatus) */
export function markVisitNoShow(bookingId: Id): Promise<Booking> {
  if (isApiMode()) {
    return S.changeBookingStatus(bookingId, 'no_show').then(async (b) => {
      if (b.clientId) await request(() => recalcClientLoyaltyImpl(b.businessId, b.clientId!, 'statusNoShow'));
      return b;
    });
  }
  return request(async () => {
    const booking = coreTx.changeBookingStatus(bookingId, 'no_show');
    // F-04-158: авто-категория за неявку — тоже момент пересчёта
    if (booking.clientId) await recalcClientLoyaltyImpl(booking.businessId, booking.clientId, 'statusNoShow');
    return booking;
  });
}

/**
 * «Внести прошлый визит» в режиме api (этап 7): визит — запись «Пришёл» на сервере задним числом (занятость прошлое
 * время не держит), новый клиент — карточка на сервере; внесённая сумма — оплата визита (строка оплаты записи).
 * Фото визита пока остаются файлами карточки в браузере (раздел clients, файлы визита — этап 20).
 */
async function apiAddPastVisit(input: PastVisitInput): Promise<ClientVisit> {
  const lines = input.services.filter((l) => (l.customName?.trim() || l.serviceId) && l.price >= 0);
  if (lines.length === 0) throw new ApiError('no_services', 'Укажите хотя бы одну услугу');
  const total = lines.reduce((sum, l) => sum + l.price, 0);
  const start = `${input.date}T${input.time}` as ISODateTime;
  if (start > nowDateTime()) throw new ApiError('future_visit', 'Прошлый визит не может быть в будущем');
  const locationId = input.locationId ?? (await request(() => readCore().businesses.find((b) => b.id === input.businessId)?.locationIds[0]));
  if (!locationId) throw new ApiError('no_location', 'У бизнеса нет филиала');
  let clientId = input.clientId;
  if (!clientId && input.newClient) {
    const name = input.newClient.name.trim();
    if (!name) throw new ApiError('name_required', 'Укажите имя клиента');
    const phone = validatePhone(input.newClient.phone);
    clientId = (await coreCreate('clients', { businessId: input.businessId, phone, name, gender: 'unknown', tags: [], noShowCount: 0, createdAt: nowDateTime() })).id;
  }
  if (!clientId) throw new ApiError('client_required', 'Укажите клиента');
  const booking = await S.createBooking({
    businessId: input.businessId,
    locationId,
    staffId: input.staffId,
    clientId,
    start,
    status: 'arrived',
    services: lines.map((l) => ({ serviceId: l.serviceId ?? newId('svcline'), staffId: input.staffId, price: l.price, durationMin: 30, qty: 1 })),
    resourceIds: [],
    workplace: 'salon',
    source: 'phone',
    createdBy: input.staffId,
    forWhom: 'self',
    comment: input.note?.trim() || undefined,
  });
  if (input.paidAmount > 0) await S.payLines(booking.id, [{ method: input.method ?? 'cash', amount: input.paidAmount, label: input.method ?? 'cash' }]);
  const cid: Id = clientId;
  await request(() =>
    mutateArea('clients', (s) => {
      s.manualVisitPayments[booking.id] = { paidAmount: input.paidAmount, method: input.method };
      if (input.photos?.length) {
        const files: ClientFile[] = input.photos.map((p) => ({
          id: newId('file'),
          clientId: cid,
          name: p.name,
          ext: p.ext,
          size: p.size,
          dataUrl: p.dataUrl,
          uploadedAt: nowDateTime(),
          uploadedBy: staffName(input.staffId),
          visitId: booking.id,
        }));
        s.files[cid] = [...(s.files[cid] ?? []), ...files];
      }
    }),
  );
  return {
    id: booking.id,
    clientId: cid,
    date: booking.start,
    staffId: booking.staffId,
    services: lines.map((l) => ({ serviceId: l.serviceId, customName: l.customName, price: l.price })),
    total,
    paid: input.paidAmount,
    paymentStatus: input.paidAmount >= total ? 'paid' : 'unpaid',
    method: input.method,
    status: 'arrived',
    manual: true,
    groupEvent: false,
    photoIds: [],
    note: input.note,
  };
}
