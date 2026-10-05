'use client';

/**
 * ⭐ Запись на сдачу по времени (05.10.2026) на публичной странице мастерской, у которой есть и обычные услуги (детейлинг):
 * «Сдать по времени» — короткое окно приёма вещи, без очереди. Мастерская только с заказами показывает ту же кнопку
 * в «Как сдать вещь» (OrdersPlaceInfo). Файл раздела online.
 */
import { PackagePlus } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';

export function DropOffCard({ href, slotMin }: { href: string; slotMin: number }) {
  const t = useT('online');
  return (
    <div data-f="orders-dropoff-cta">
      <Card padding="md" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
            <PackagePlus aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-fg">{t('public.dropOff.title')}</p>
            <p className="text-sm text-muted">{t('public.dropOff.description', { min: slotMin })}</p>
          </div>
        </div>
        <LinkButton href={href} variant="secondary" className="shrink-0">
          {t('public.dropOff.button')}
        </LinkButton>
      </Card>
    </div>
  );
}
