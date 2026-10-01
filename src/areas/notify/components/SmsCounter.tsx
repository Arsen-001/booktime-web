'use client';

/**
 * Счётчик SMS-частей и цены под полем текста (Ув8, Ув13): кириллица и армянский — 70 символов в одной SMS и 67 в
 * части длинной, латиница — 160/153 (правила GSM 03.38, lib/sms.ts). Больше одной части — предупреждение: каждая
 * часть оплачивается отдельно.
 */
import { AlertTriangle } from 'lucide-react';
import { countSms, SMS_PART_PRICE_AMD } from '@/areas/notify/lib/sms';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';

export interface SmsCounterProps {
  /** Текст, как он уйдёт (с подставленными переменными) */
  text: string;
  /** Сколько получателей — цена умножается (рассылка); нет — цена одной SMS */
  recipients?: number;
  className?: string;
}

export function SmsCounter({ text, recipients, className }: SmsCounterProps) {
  const t = useT('notify');
  const format = useFormat();
  const c = countSms(text);
  const parts = Math.max(1, c.parts);
  const one = parts * SMS_PART_PRICE_AMD;
  return (
    <div data-f="F-05-017" className={cn('flex flex-col gap-1 text-xs', className)} aria-live="polite">
      <p className="text-muted tabular-nums">
        {t('sms.counter', { units: c.units, perPart: c.perPart, parts })}
        {' · '}
        {t(c.encoding === 'gsm7' ? 'sms.latin' : 'sms.unicode')}
        {' · '}
        {recipients !== undefined
          ? t('sms.priceTotal', { price: format.money(one), recipients, total: format.money(one * recipients) })
          : t('sms.price', { rate: format.money(SMS_PART_PRICE_AMD), parts, total: format.money(one) })}
      </p>
      {parts > 1 && (
        <p className="flex items-center gap-1.5 text-warning">
          <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
          {t('sms.multiPart', { parts })}
        </p>
      )}
    </div>
  );
}
