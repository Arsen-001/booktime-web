/**
 * ⭐ «Закрыт день» — уведомление владельцу в колокольчик кабинета (владелец, 01.10.2026).
 *
 * Администратор закрывает кассовую смену («Закрыть день» в «Итогах дня» журнала или «Кассовая смена» финансов) —
 * владельцам бизнеса (роль «Владелец» или роль-шаблон «Владелец», владелец сети), кроме закрывшего, в ленту колокольчика
 * приходит строка «День закрыт · Лилит — выручка, наличные, излишек/недостача»; нажатие открывает «Итоги дня» за эту дату.
 * Снимок пишет закрытие смены (мок — closeCashShift в src/api/finance.ts, сервер — CashShiftsService.close), ленту
 * читает центр уведомлений (src/api/notify.ts → inboxEvents). Правила снимка и дедупликации — src/domain/journalWorkday.ts.
 * Выключается галочкой «Закрытие дня» в «Уведомления в Web-версии» (WebPopupSettings.dayClose, по умолчанию включено).
 *
 * Только мок: всё синхронно, внутри request() вызывающего. Режим api — сервер (booktime-backend src/modules/notify/day-close-notice.ts).
 */
import { mutateArea, readArea, readCore } from '@/api/area';
import type { ISODateTime, Id } from '@/domain/core';
import { dayCloseFingerprint, dayMoneyOf, upsertDayCloseNotice, type DayCloseNotice } from '@/domain/journalWorkday';

/** Кому приходит «Закрыт день»: владельцы бизнеса и сети, сотрудники с ролью-шаблоном «Владелец» — кроме закрывшего */
export function dayCloseRecipientsSync(businessId: Id, closedBy: Id): Id[] {
  const core = readCore();
  const business = core.businesses.find((b) => b.id === businessId);
  const access = readArea('staff').access ?? {};
  const ids = new Set<Id>();
  for (const s of core.staff) {
    if (s.businessId !== businessId || s.status === 'fired' || s.status === 'disabled') continue;
    if (s.role === 'owner' || access[s.id]?.roleTemplateId === 'owner') ids.add(s.id);
  }
  if (business?.ownerStaffId) ids.add(business.ownerStaffId);
  const network = business?.networkId ? core.networks.find((n) => n.id === business.networkId) : undefined;
  if (network?.ownerStaffId) ids.add(network.ownerStaffId);
  ids.delete(closedBy);
  return [...ids].sort();
}

/**
 * Снимок итога дня после закрытия смены (мок). Дата — день закрытия; излишек/недостача — сумма по сменам бизнеса,
 * закрытым в этот день. Тот же день без изменений — ничего не пишет; получателей нет — тоже.
 */
export function recordDayCloseNoticeSync(businessId: Id, at: ISODateTime, closedBy: Id): void {
  const date = at.slice(0, 10);
  const recipientStaffIds = dayCloseRecipientsSync(businessId, closedBy);
  if (!recipientStaffIds.length) return;
  const fin = readArea('finance');
  const shifts = (fin.cashShifts ?? []).filter((sh) => sh.businessId === businessId);
  const money = dayMoneyOf(fin.operations, {
    date,
    accountIds: new Set(fin.accounts.filter((a) => a.businessId === businessId).map((a) => a.id)),
    refundItemId: fin.itemBySystemKey[businessId]?.refund,
    adjustmentIds: new Set(shifts.flatMap((sh) => sh.adjustmentOperationIds ?? [])),
  });
  const discrepancy = shifts
    .filter((sh) => sh.status === 'closed' && sh.closedAt?.startsWith(date) && sh.countedCash !== undefined && sh.expectedAtClose !== undefined)
    .reduce((sum, sh) => sum + (sh.countedCash! - sh.expectedAtClose!), 0);
  // Выручка — «Оказано услуг» итогов дня: визиты «Пришёл» этого дня (без групповых событий)
  const revenue = readCore()
    .bookings.filter((b) => b.businessId === businessId && !b.deletedAt && !b.groupEventId && b.status === 'arrived' && b.start.startsWith(date))
    .reduce((sum, b) => sum + b.total, 0);
  const closer = readCore().staff.find((s) => s.id === closedBy);
  const base = { closedBy, revenue, cash: money.cash, discrepancy };
  const notice: DayCloseNotice = {
    businessId,
    date,
    at,
    closedByName: closer?.name.trim().split(/\s+/)[0] ?? '',
    recipientStaffIds,
    fingerprint: dayCloseFingerprint(base),
    ...base,
  };
  const { list, changed } = upsertDayCloseNotice(readArea('notify').dayCloseNotices ?? [], notice);
  if (!changed) return;
  mutateArea('notify', (s) => {
    s.dayCloseNotices = list;
  });
}

/** Снимки дня, адресованные этому сотруднику (мок) */
export function dayCloseNoticesForSync(businessId: Id, viewerStaffId: Id | undefined): DayCloseNotice[] {
  if (!viewerStaffId) return [];
  return (readArea('notify').dayCloseNotices ?? []).filter((n) => n.businessId === businessId && n.recipientStaffIds.includes(viewerStaffId));
}
