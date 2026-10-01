'use client';

/** «Завтра N клиентов без приложения» — мастер сам напоминает из своего WhatsApp (F-00-121). */
import { MessageCircle, Phone, Users } from 'lucide-react';
import { listNoAppRemindersTomorrow } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useLocale } from 'next-intl';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/text';
import { buttonClasses } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function RemindersScreen() {
  const t = useT('client');
  const locale = useLocale();
  const fmt = useClientFormat();
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['no-app-reminders', businessId], () => listNoAppRemindersTomorrow(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const skeletonCount = useSkeletonCount('reminders', { loading: q.isLoading || !ready, count: q.data?.length, fallback: 10, max: 10 });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  return (
    <div data-f="F-00-121" className="flex flex-col gap-6">
      <PageHeader
        title={t('apps.reminders.title')}
        description={q.data ? t('apps.reminders.subtitle', { count: q.data.length }) : <SkeletonText width="32ch" />}
      />

      {q.isLoading || !ready ? (
        // Те же карточки до данных: имя, «услуга · время», кнопка «Напомнить» на месте
        <ul className="flex flex-col gap-3" aria-busy="true">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <li key={i}>
              <Card padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-fg">
                    <SkeletonText width="14ch" />
                  </p>
                  <p className="text-sm text-muted">
                    <SkeletonText width="22ch" />
                  </p>
                </div>
                <span aria-hidden className={cn(buttonClasses({ variant: 'primary', size: 'sm' }), 'pointer-events-none shrink-0 opacity-50')}>
                  <MessageCircle aria-hidden className="size-4" />
                  {t('apps.reminders.remind')}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={<Users aria-hidden className="size-8 text-muted" />} title={t('apps.reminders.empty')} />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {pageItems.map((row) => (
              <li key={row.bookingId}>
                <Card padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{row.clientName}</p>
                    <p className="text-sm text-muted">
                      {row.serviceTitle ? pickText(row.serviceTitle, locale) : row.serviceName} · {fmt.time(row.time)}
                    </p>
                  </div>
                  <a
                    href={row.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonClasses({ variant: 'primary', size: 'sm' }), 'shrink-0')}
                  >
                    <MessageCircle aria-hidden className="size-4" />
                    {t('apps.reminders.remind')}
                  </a>
                </Card>
              </li>
            ))}
          </ul>
          {pager}
        </>
      )}

      <Card padding="sm" className="flex items-start gap-2 bg-surface-2 text-sm text-muted">
        <Phone aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{t('apps.reminders.hint')}</span>
      </Card>
    </div>
  );
}
