'use client';

/**
 * Подтверждение быстрой оплаты (fin-review Ф9): одно нажатие по плитке больше не проводит деньги молча. Окно
 * показывает сумму и способ; для наличных — «Получено от клиента» и «Сдача», чтобы кассир не считал в уме.
 * Получено меньше суммы — кнопка не проводит оплату (частями — вкладка «Частями»).
 */
import { useState } from 'react';
import { Banknote } from 'lucide-react';
import type { PaymentMethodTile } from '@/domain/finance';
import { calcAcquiringFee } from '@/domain/finance';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';

export interface QuickPayModalProps {
  tile: PaymentMethodTile | null;
  amount: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: (methodKey: string) => void;
}

export function QuickPayModal({ tile, amount, pending, onClose, onConfirm }: QuickPayModalProps) {
  const t = useT('finance');
  const format = useFormat();
  const [received, setReceived] = useState<number | undefined>(undefined);
  const [forKey, setForKey] = useState<string | null>(null);
  // Новое окно — пустое «Получено» (без эффекта: сброс при смене плитки прямо в рендере)
  const tileKey = tile?.key ?? null;
  if (tileKey !== forKey) {
    setForKey(tileKey);
    setReceived(undefined);
  }

  const isCash = tile?.kind === 'cash';
  const short = isCash && received !== undefined && received < amount;
  const change = isCash && received !== undefined && received >= amount ? received - amount : 0;
  const fee = tile && tile.feePct > 0 ? calcAcquiringFee(amount, tile.feePct) : 0;

  return (
    <Modal
      open={tile !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t('bookingPayment.confirmPayTitle', { amount: format.money(amount) })}
      description={tile ? t('bookingPayment.confirmPayMethod', { method: tile.label }) : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('bookingPayment.confirmPayBack')}
          </Button>
          <Button loading={pending} disabled={short || !tile} onClick={() => tile && onConfirm(tile.key)}>
            {t('bookingPayment.confirmPay')}
          </Button>
        </>
      }
    >
      <div data-f="F-07-037" className="flex flex-col gap-3">
        {isCash && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('bookingPayment.received')}</span>
              <MoneyInput value={received} onValueChange={setReceived} placeholder={format.number(amount)} autoFocus invalid={short} />
            </label>
            <div className="flex min-h-11 items-center justify-between rounded-lg bg-surface-2 px-3 text-sm">
              <span className="flex items-center gap-2 text-muted">
                <Banknote aria-hidden className="size-4" />
                {short ? t('bookingPayment.receivedShort') : t('bookingPayment.change')}
              </span>
              <span className={short ? 'font-semibold tabular-nums text-danger' : 'font-semibold tabular-nums'}>
                {format.money(short ? amount - (received ?? 0) : change)}
              </span>
            </div>
          </>
        )}
        {fee > 0 && <p className="text-xs text-muted">{t('bookingPayment.feeNote', { amount: format.money(fee) })}</p>}
      </div>
    </Modal>
  );
}
