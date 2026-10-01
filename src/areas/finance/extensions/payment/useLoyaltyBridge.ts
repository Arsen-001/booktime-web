'use client';

/**
 * Мост вкладки «Оплата» (finance) к разделу «Лояльность» (loyalty-review, 27.09):
 *  - «Личный счёт клиента» — один источник: счета лояльности (listClientAccounts), а не старый баланс finance;
 *    списание — chargeAccount там, возврат/отмена — topupAccount туда же;
 *  - после каждой оплаты, отмены и возврата деньгами — сверка кэшбэка визита (syncBookingCashback идемпотентен).
 */
import { getBookingExtras } from '@/api/journal';
import { chargeAccount, listClientAccounts, syncBookingCashback, topupAccount, visitPaymentsForCashback } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import type { Booking } from '@/domain/core';

export interface LoyaltyBridge {
  /** Сумма остатков всех счетов клиента */
  balance: number;
  /** Сколько можно списать одним счётом (остаток + разрешённый минус) — у самого «богатого» счёта */
  maxCharge: number;
  hasAccounts: boolean;
  /** Списать со счёта лояльности; вернёт счёт и ушёл ли он в минус */
  charge: (amount: number) => Promise<{ accountId: string; debt: boolean }>;
  /** Вернуть на счёт лояльности (отмена или возврат оплаты со счёта) */
  giveBack: (accountId: string, amount: number) => Promise<void>;
  /** Сверить кэшбэк визита с текущей оплатой (ошибка — молча: досчитает следующая оплата) */
  syncCashback: (booking: Booking | undefined) => Promise<void>;
  refetch: () => void;
}

export function useLoyaltyBridge(businessId: string, clientId: string | undefined, staffId: string | undefined, bookingId?: string): LoyaltyBridge {
  const accountsQ = useApiQuery(['loyalty', 'clientAccounts', businessId, clientId], () => listClientAccounts(businessId, clientId!), { enabled: Boolean(clientId) });
  const accounts = accountsQ.data ?? [];
  const available = (a: (typeof accounts)[number]) => a.balance + (a.allowNegative ? a.negativeLimit : 0);
  const best = [...accounts].sort((a, b) => available(b) - available(a))[0];

  return {
    balance: accounts.reduce((sum, a) => sum + a.balance, 0),
    maxCharge: best ? Math.max(0, available(best)) : 0,
    hasAccounts: accounts.length > 0,
    charge: async (amount) => {
      if (!best) throw new Error('no_account');
      // bookingId — списание видно в истории счёта как оплата этого визита (loyalty.md)
      const updated = await chargeAccount(businessId, best.id, amount, staffId, bookingId);
      return { accountId: best.id, debt: updated.balance < 0 };
    },
    giveBack: async (accountId, amount) => {
      if (amount > 0) await topupAccount(businessId, accountId, amount, staffId);
    },
    syncCashback: async (booking) => {
      if (!booking?.clientId) return;
      try {
        const extras = await getBookingExtras(booking.id);
        const payments = await visitPaymentsForCashback(businessId, booking.id, extras.payments ?? []);
        await syncBookingCashback(businessId, booking.locationId, booking.clientId, booking.id, payments, {
          lines: booking.services.map((l) => ({ serviceId: l.serviceId, price: Math.round(l.price * l.qty), listPrice: Math.round((l.unitPrice ?? l.price) * l.qty) })),
          locationId: booking.locationId,
          bookingId: booking.id,
        });
      } catch {
        // сверка фоновая
      }
    },
    refetch: () => void accountsQ.refetch(),
  };
}
