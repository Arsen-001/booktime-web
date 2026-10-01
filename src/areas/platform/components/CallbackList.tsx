'use client';

/**
 * «Перезвонить сегодня» — кому именно, с телефоном и кнопкой «Открыть» (одна плашка вместо цифры и тоста, V-1).
 * На обзоре ведёт в визиты с открытой карточкой, в визитах — открывает карточку на месте.
 */
import { Phone, PhoneCall } from 'lucide-react';
import type { CallbackItem } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { telLink } from '@/lib/phone';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton, buttonClasses } from '@/ui/Button';
import { usePagedList } from '@/ui/Pagination';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

/** Сколько «перезвонить» обычно в демо-данных — столько строк у скелетона, пока нет памяти о прошлом разе */
const TYPICAL_CALLBACKS = 2;

interface CallbackListProps {
  items: CallbackItem[];
  /** Первая загрузка — та же плашка со строками-скелетонами (DESIGN.md «The skeleton IS the page») */
  loading?: boolean;
  /** Открыть визит на месте; без него — ссылка в /platform/visits?open=<id> */
  onOpen?: (visitId: string) => void;
}

export function CallbackList({ items, loading, onOpen }: CallbackListProps) {
  const t = useT('platform');
  const fmt = useFormat();
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager, pageSize } = usePagedList(items);
  const skeletonRows = useSkeletonCount('callbacks', { loading: !!loading, count: pageItems.length, fallback: TYPICAL_CALLBACKS, max: pageSize });
  if (loading) {
    if (!skeletonRows) return null;
    return (
      <section aria-busy className="rounded-2xl border border-warning/60 bg-warning-soft p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
          <PhoneCall aria-hidden className="size-5 text-warning" />
          <SkeletonText width="22ch" />
        </h2>
        <ul className="mt-3 flex flex-col divide-y divide-warning/30">
          {Array.from({ length: skeletonRows }, (_, i) => (
            <CallbackRowSkeleton key={i} />
          ))}
        </ul>
      </section>
    );
  }
  if (!items.length) return null;
  return (
    <section aria-label={t('visits.callbacksTitle', { n: items.length })} className="rounded-2xl border border-warning/60 bg-warning-soft p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
        <PhoneCall aria-hidden className="size-5 text-warning" />
        {t('visits.callbacksTitle', { n: items.length })}
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-warning/30">
        {pageItems.map((c) => (
          <li key={c.visitId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            {/* w-full на телефоне: имя не делит строку с кнопками (иначе flex ужимает его до «…» вместо переноса на 390px) */}
            <div className="w-full min-w-0 sm:w-auto sm:flex-1">
              <p className="truncate font-medium text-fg">
                {c.placeName}
                {c.contactName ? <span className="font-normal text-muted"> · {c.contactName}</span> : null}
              </p>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                {c.phone && <span className="tabular-nums">{fmt.phone(c.phone)}</span>}
                <Badge size="sm" tone={c.overdueDays > 0 ? 'danger' : 'warning'}>
                  {c.overdueDays > 0 ? t('visits.overdueDays', { n: c.overdueDays }) : t('visits.callbackToday')}
                </Badge>
              </p>
            </div>
            {c.phone && (
              <a href={telLink(c.phone)} aria-label={t('visits.call', { phone: fmt.phone(c.phone) })} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                <Phone aria-hidden />
                <span className="max-sm:sr-only">{t('visits.callShort')}</span>
              </a>
            )}
            {onOpen ? (
              <Button size="sm" variant="outline" onClick={() => onOpen(c.visitId)}>
                {t('visits.open')}
              </Button>
            ) : (
              <LinkButton size="sm" variant="outline" href={`/platform/visits?open=${c.visitId}`}>
                {t('visits.open')}
              </LinkButton>
            )}
          </li>
        ))}
      </ul>
      {pager}
    </section>
  );
}

/** Строка «перезвонить» до данных: те же обёртки, строки текста, бейдж и две кнопки размера sm */
function CallbackRowSkeleton() {
  const t = useT('platform');
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <div className="w-full min-w-0 sm:w-auto sm:flex-1">
        <p className="truncate font-medium text-fg">
          <SkeletonText width="24ch" />
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <SkeletonText width="16ch" />
          <Badge size="sm" tone="warning">
            <SkeletonText width="9ch" />
          </Badge>
        </p>
      </div>
      <span aria-hidden className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
        <Phone aria-hidden />
        <span className="max-sm:sr-only">{t('visits.callShort')}</span>
      </span>
      <span aria-hidden className={buttonClasses({ variant: 'outline', size: 'sm' })}>
        {t('visits.open')}
      </span>
    </li>
  );
}
