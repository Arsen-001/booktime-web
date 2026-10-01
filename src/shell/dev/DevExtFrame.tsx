'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { coreList, listBookings } from '@/api/core';
import type { BookingSource } from '@/domain/core';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { findExtension } from '@/extensions/registry';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import { HOST_OWNERS, type HostId, type HostProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { today } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { KeyValueList } from '@/ui/KeyValueList';
import { Skeleton } from '@/ui/Skeleton';

/** Подобрать пропсы хоста из демо-данных текущей персоны */
/** Образцы записи для окна записи: вклад online, например, виден только у записей «по ссылке» и «из виджета» */
const SAMPLE_SOURCES: BookingSource[] = ['journal', 'app', 'link', 'widget'];

/** ?sample=<источник записи> в адресе витрины */
function useSample(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get('sample'),
    () => null,
  );
}

async function buildProps(
  host: HostId,
  ctx: ReturnType<typeof useCurrent>,
  sample: string | null,
): Promise<HostProps[HostId] | null> {
  const businessId = ctx.businessId;
  switch (host) {
    case 'bookingWindow': {
      if (!businessId) return null;
      const bookings = await listBookings({ businessId, from: today() });
      const bySource = sample ? bookings.find((x) => x.source === sample) : undefined;
      const b = bySource ?? bookings.find((x) => x.clientId) ?? bookings[0];
      if (!b) return null;
      const { id, locationId, ...rest } = b;
      return { mode: 'edit', bookingId: id, businessId, locationId, draft: { ...rest } };
    }
    case 'clientCard': {
      if (!businessId) return null;
      const [c] = await coreList('clients', { businessId });
      return c ? { clientId: c.id, businessId } : null;
    }
    case 'staffCard': {
      if (!businessId) return null;
      const staff = await coreList('staff', { businessId });
      const s = staff.find((x) => x.role === 'master') ?? staff[0];
      return s ? { staffId: s.id, businessId } : null;
    }
    case 'serviceCard': {
      if (!businessId) return null;
      const [s] = await coreList('services', { businessId });
      return s ? { mode: 'edit', serviceId: s.id, businessId } : null;
    }
    case 'settingsHub':
      return businessId ? { businessId } : null;
    case 'clientProfile': {
      const users = await coreList('appUsers');
      const id = ctx.appUserId ?? users[0]?.id;
      return id ? { appUserId: id } : null;
    }
    case 'journalWaitlist': {
      if (!businessId) return null;
      const staff = await coreList('staff', { businessId });
      return { businessId, locationId: ctx.locationId && ctx.locationId !== 'all' ? ctx.locationId : '', date: today(), staffIds: staff.map((s) => s.id), onRecord: () => undefined };
    }
  }
}

/** Плоский список «ключ → значение» для показа контекста (вложенный черновик — draft.*) */
function flattenContext(obj: Record<string, unknown>, prefix = ''): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) out.push([`${prefix}${k}`, `[${v.length}]`]);
    else if (typeof v === 'object') out.push(...flattenContext(v as Record<string, unknown>, `${prefix}${k} › `));
    else out.push([`${prefix}${k}`, String(v)]);
  }
  return out;
}

export function DevExtFrame({ host, area }: { host: string; area: string }) {
  const t = useT('common');
  const tDyn = useTDynamic();
  const ctx = useCurrent();
  const entry = findExtension(host, area);
  const pathname = usePathname();
  const sample = useSample();

  const q = useApiQuery(
    ['dev-ext', host, ctx.businessId, ctx.appUserId, sample],
    () => buildProps(host as HostId, ctx, sample),
    {
      enabled: Boolean(entry) && ctx.ready,
    },
  );

  if (!entry) return <EmptyState title={t('dev.extUnknown')} description={`${host} / ${area}`} />;

  const hostName = tDyn(`common.ext.hosts.${entry.host}`);
  const areaName = t(`areas.${entry.area}`);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          {t('dev.extTitle', { area: areaName, host: hostName })}
        </h1>
        <p className="mt-1 text-muted">{t('dev.extHint')}</p>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 px-4 py-3">
          <span className="font-semibold text-fg">{hostName}</span>
          <Badge tone="neutral" variant="outline">
            {t(`areas.${HOST_OWNERS[entry.host]}`)}
          </Badge>
        </div>
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="border-b border-dashed border-border p-4 md:border-b-0 md:border-r">
            <p className="mb-3 text-sm font-medium text-muted">{t('dev.extContext')}</p>
            {entry.host === 'bookingWindow' && (
              // Образец записи по источнику (?sample=link): чтобы увидеть вклад, который рисуется не у всех записей
              <div className="mb-3 flex flex-wrap gap-1.5">
                {SAMPLE_SOURCES.map((src) => (
                  <Link key={src} href={`${pathname}?sample=${src}`} replace>
                    <Chip selected={sample === src}>{t(`bookingSource.${src}`)}</Chip>
                  </Link>
                ))}
              </div>
            )}
            {/* Постоянная высота с прокруткой: число полей контекста у хостов разное, и блок не толкает вклад под ним,
                когда контекст приходит (DESIGN.md → «The skeleton IS the page») */}
            <div className="h-44 overflow-y-auto">
            {q.isLoading ? (
              <Skeleton lines={4} />
            ) : q.data ? (
              <KeyValueList
                dense
                items={flattenContext(q.data as unknown as Record<string, unknown>).map(([k, v]) => ({
                  label: k,
                  value: <code className="text-xs">{v}</code>,
                }))}
              />
            ) : null}
            </div>
          </div>
          <div className="p-4">
            {/* Вкладка хоста — только изображение: в настоящем хосте вкладки рисует хозяин */}
            <div className="mb-4 flex gap-2 border-b border-border">
              <span className="-mb-px inline-flex min-h-10 items-center border-b-2 border-primary px-3 text-sm font-semibold text-primary-text">
                {tDyn(entry.labelKey)}
              </span>
            </div>
            {q.isLoading || !ctx.ready ? (
              <Skeleton variant="rect" className="h-40 w-full" />
            ) : q.isError ? (
              <ErrorState onRetry={q.refetch} />
            ) : q.data ? (
              <ExtensionSlot entry={entry} props={q.data as never} />
            ) : (
              <EmptyState title={t('dev.noData')} />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
