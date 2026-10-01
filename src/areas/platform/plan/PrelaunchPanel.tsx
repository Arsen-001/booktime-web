'use client';

/** Что решить до постройки (F-00-207): «решено 0 из 6» и раскрывающиеся пункты — без стены пустых полей. */
import { useLocale } from 'next-intl';
import { ClipboardList } from 'lucide-react';
import { usePrelaunchItems } from '@/areas/platform/hooks/usePlatformData';
import { PrelaunchItemForm } from '@/areas/platform/plan/PrelaunchItemForm';
import type { LocaleCode } from '@/domain/core';
import type { PrelaunchStatus } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Accordion } from '@/ui/Accordion';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { SkeletonList } from '@/ui/Skeleton';

const TONE: Record<PrelaunchStatus, BadgeTone> = { open: 'neutral', decided: 'info', done: 'success' };

export function PrelaunchPanel() {
  const t = useT('platform');
  const locale = useLocale() as LocaleCode;
  const q = usePrelaunchItems();
  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (q.isLoading) return <SkeletonList rows={6} avatar={false} />;
  const items = q.data ?? [];
  if (!items.length) return <EmptyState framed icon={<ClipboardList aria-hidden />} title={t('plan.prelaunchEmpty')} />;
  const decided = items.filter((i) => i.status !== 'open').length;

  return (
    <div data-f="F-00-207" className="flex flex-col gap-4">
      <p className="text-base font-medium text-fg">{t('plan.prelaunchProgress', { decided, total: items.length })}</p>
      <Accordion
        items={items.map((item) => ({
          id: item.id,
          title: (
            <span className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2">
              <span className="min-w-0">
                <span className="font-medium text-fg">{item.order}. {pickText(item.title, locale)}</span>
                {item.decision && <span className="block truncate text-sm font-normal text-muted">{item.decision}</span>}
              </span>
              <Badge tone={TONE[item.status]} size="sm">{t(`plan.prelaunchStatus.${item.status}`)}</Badge>
            </span>
          ),
          content: <PrelaunchItemForm item={item} hint={pickText(item.hint, locale)} />,
        }))}
      />
    </div>
  );
}
