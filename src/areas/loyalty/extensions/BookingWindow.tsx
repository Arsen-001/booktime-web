'use client';

/**
 * Вклад раздела «loyalty» в окно записи (хост «bookingWindow»). Файл принадлежит разделу «loyalty».
 * Посмотреть вклад без хозяина хоста: /dev/ext/bookingWindow/loyalty
 *
 * F-06-061/F-06-193: чем владелец номера (клиент из draft.clientId — лояльность посетителя, записанного
 * «за другого», всегда берётся из блока клиента) может заплатить за визит. F-06-066: без клиента блока нет.
 *
 * Л1/Л6 (27.09.2026): оплата лояльностью — строки платежей визита, как у окна «Оплата»; кэшбэк считается от
 * оплаченного деньгами и пересчитывается после каждой оплаты/отмены на ЛЮБОЙ вкладке. Шаг «после сохранения»
 * лишь досчитывает его для оплат, проведённых мимо обоих окон (мгновенная оплата из карточки на сетке).
 */
import { getBookingExtras } from '@/api/journal';
import { syncBookingCashback, visitPaymentsForCashback, type VisitServiceLine } from '@/api/loyalty';
import { useT } from '@/i18n/useT';
import type { BookingDraft, BookingWindowExtProps } from '@/extensions/types';
import { useAfterSaveStep } from '@/extensions/saveHooks';
import { LoyaltyPaymentPanel } from '@/areas/loyalty/components/LoyaltyPaymentPanel';

/** Услуги черновика для движка: к оплате — итог строки, по прайсу — цена × количество до личной скидки */
function visitLinesOf(draft: BookingDraft): VisitServiceLine[] {
  return (draft.services ?? []).map((s) => ({
    serviceId: s.serviceId,
    price: s.price,
    listPrice: s.unitPrice !== undefined ? Math.round(s.unitPrice * s.qty) : s.price,
  }));
}

export default function LoyaltyBookingWindow({ businessId, locationId, bookingId, draft, onDraftChange, registerAfterSave }: BookingWindowExtProps) {
  const t = useT('loyalty');
  const clientId = draft.clientId;

  useAfterSaveStep(registerAfterSave, async (savedBookingId, savedDraft) => {
    if (!savedDraft.clientId) return;
    const extras = await getBookingExtras(savedBookingId);
    const payments = await visitPaymentsForCashback(businessId, savedBookingId, extras.payments ?? []);
    await syncBookingCashback(businessId, locationId, savedDraft.clientId, savedBookingId, payments, { lines: visitLinesOf(savedDraft), locationId });
  });

  // F-06-066: без клиента в записи блока лояльности в оплате нет — все виды лояльности привязаны к клиенту
  if (!clientId) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('bookingWindow.title')}</p>
      <LoyaltyPaymentPanel
        businessId={businessId}
        locationId={locationId}
        clientId={clientId}
        bookingId={bookingId}
        total={draft.total ?? 0}
        status={draft.status}
        visitLines={visitLinesOf(draft)}
        onDraftChange={onDraftChange}
        registerAfterSave={registerAfterSave}
      />
    </div>
  );
}
