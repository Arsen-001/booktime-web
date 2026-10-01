'use client';

/**
 * /biz/loyalty/certificates/types — список типов сертификатов (F-06-086). Форма создания/правки — b03
 * (/biz/loyalty/certificates/types/new, /biz/loyalty/certificates/types/[typeId]).
 *
 * F-06-104 «Архивирование: сертификаты нельзя»: в отличие от типов абонементов (у которых есть
 * setMembershipTypeArchived), у типа сертификата в api/loyalty.ts нет функции архивирования вовсе — только
 * deleteCertificateType (продажи истории не трогает). Ограничение выполняется тем, что действия просто
 * нет, а не блокировкой существующей кнопки.
 */
import Link from 'next/link';
import { Plus, Ticket } from 'lucide-react';
import { listCertificateTypes } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import { TypeListSkeleton } from '@/areas/loyalty/components/Skeletons';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function CertificateTypesScreen() {
  const t = useT('loyalty');
  const format = useFormat();
  const { ready, businessId } = useCurrent();

  const q = useApiQuery(['loyalty', 'certificateTypes', businessId], () => listCertificateTypes(businessId!), { enabled: ready && Boolean(businessId) });

  const items = q.data ?? [];
  // Скелетон — столько строк, сколько было в прошлый раз (в демо — два типа)
  const skeletonRows = useSkeletonCount('certificateTypes', { loading: q.isLoading, count: items.length, fallback: 2 });
  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  return (
    <div data-f="F-06-086 F-06-104" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('certificateTypes.title')}
        description={t('certificateTypes.subtitle')}
        actions={
          <LinkButton href="/biz/loyalty/certificates/types/new" leftIcon={<Plus aria-hidden />}>
            {t('certificateTypes.add')}
          </LinkButton>
        }
      />

      {q.isLoading ? (
        <TypeListSkeleton rows={skeletonRows} aside="9ch" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Ticket aria-hidden />}
          title={t('certificateTypes.emptyTitle')}
          description={t('certificateTypes.emptyText')}
          action={
            <LinkButton href="/biz/loyalty/certificates/types/new" leftIcon={<Plus aria-hidden />}>
              {t('certificateTypes.add')}
            </LinkButton>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <Link href={`/biz/loyalty/certificates/types/${c.id}`} className="min-h-10 min-w-0 flex-1 py-1 text-left">
                <span className="block truncate text-sm font-semibold text-fg underline decoration-border-strong underline-offset-2">{c.name}</span>
                <span className="block text-xs text-muted">{format.money(c.nominal)}</span>
              </Link>
              <span className="text-xs text-muted">{t('certificateTypes.soldCount', { count: c.soldCount })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
