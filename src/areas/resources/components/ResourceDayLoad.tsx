'use client';

/**
 * «Занятость» на карточке ресурса (F-16-019): день по экземплярам — кто, когда и на какой услуге занимает место.
 * Свой запрос и свой скелетон той же формы; смена дня держит прежний день на экране до ответа (keepPrevious),
 * без мигания скелетона.
 */
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { getResourceDayLoad } from '@/api/resources';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { addMinutes, today, timePart } from '@/lib/date';
import { pickText } from '@/lib/text';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/ui/ErrorState';
import { PeriodNav } from '@/ui/PeriodNav';
import { Reveal } from '@/ui/Reveal';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';

export interface ResourceDayLoadProps {
  resourceId: string;
  /** Сколько экземпляров — скелетон той же высоты, пока данных нет */
  instanceCount: number;
}

export function ResourceDayLoad({ resourceId, instanceCount }: ResourceDayLoadProps) {
  const t = useT('resources');
  const locale = useLocale();
  const [date, setDate] = useState(today());
  const q = useApiQuery(['resources', 'day-load', resourceId, date], () => getResourceDayLoad(resourceId, date));

  const skeleton = (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: Math.max(1, instanceCount) }, (_, i) => (
        <li key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </li>
      ))}
    </ul>
  );

  return (
    <SectionCard title={t('load.title')} description={t('load.hint')}>
      {/* День — первой строкой карточки: в шапке рядом с заголовком на телефоне стрелки переносились на новую строку */}
      <PeriodNav unit="day" value={date} onValueChange={setDate} className="mb-4" />
      {q.isError ? (
        <ErrorState compact onRetry={q.refetch} />
      ) : (
        <Reveal loading={q.isLoading} skeleton={skeleton}>
          <ul className={cn('flex flex-col gap-3 transition-opacity duration-150', q.isPlaceholderData && 'opacity-60')}>
            {(q.data?.instances ?? []).map((inst) => (
              <li key={inst.id} className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-fg">{inst.name}</span>
                {inst.items.length === 0 ? (
                  <p className="flex min-h-10 items-center rounded-lg bg-success-soft px-3 text-sm text-success">{t('load.free')}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {inst.items.map((it) => (
                      <li key={`${it.kind}-${it.id}`} className="flex min-h-10 items-center gap-3 rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
                        <span className="w-24 shrink-0 tabular-nums font-medium text-fg">
                          {timePart(it.start)}–{timePart(addMinutes(it.start, it.durationMin))}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-fg">
                          {it.kind === 'event' ? t('load.event') : it.services.map((n) => pickText(n, locale)).join(', ') || t('load.noServices')}
                        </span>
                        {it.staffName && <span className="hidden shrink-0 truncate text-muted sm:inline">{it.staffName}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </SectionCard>
  );
}
