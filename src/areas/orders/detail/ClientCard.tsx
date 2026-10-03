'use client';

import { Phone } from 'lucide-react';
import { useCan } from '@/demo/hooks';
import { isOrderOverdue, type Order } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { Avatar } from '@/ui/Avatar';
import { buttonClasses } from '@/ui/Button';
import { KeyValueList } from '@/ui/KeyValueList';
import { SectionCard } from '@/ui/SectionCard';

export function ClientCard({ order, staffName }: { order: Order; staffName?: string }) {
  const t = useT('orders');
  const fmt = useFormat();
  const canPhones = useCan('clients.phones');
  const overdue = isOrderOverdue(order, today());
  return (
    <SectionCard title={t('detail.client')}>
      <div className="flex items-center gap-3">
        <Avatar name={order.clientName} size="md" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-fg">{order.clientName}</span>
          <span className="truncate text-sm text-muted">{canPhones ? fmt.phone(order.clientPhone) : fmt.maskedPhone(order.clientPhone)}</span>
        </span>
        {canPhones && (
          <a href={`tel:${order.clientPhone}`} className={buttonClasses({ variant: 'secondary' })} aria-label={t('detail.call')}>
            <Phone aria-hidden />
            <span className="max-sm:sr-only">{t('detail.call')}</span>
          </a>
        )}
      </div>
      <KeyValueList
        dense
        columns={2}
        className="mt-4 border-t border-border pt-4"
        items={[
          { label: t('detail.staff'), value: staffName ?? <span className="text-muted">{t('form.staffNone')}</span> },
          {
            label: t('detail.due'),
            value: order.dueDate ? (
              <span className={cn(overdue && 'font-semibold text-warning')}>
                {fmt.relativeDay(order.dueDate)}
                {overdue && ` · ${t('list.overdue')}`}
              </span>
            ) : (
              <span className="text-muted">{t('list.noDue')}</span>
            ),
          },
        ]}
      />
    </SectionCard>
  );
}
