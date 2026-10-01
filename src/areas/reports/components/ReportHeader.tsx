'use client';

/**
 * F-12-003: шапка любого отчёта — переключатель «▾» на все 24 + «Основные показатели» и «Визиты»,
 * «i» «Помощь по разделу» (панель справа, без ухода со страницы), звёздочка «Избранное» (F-12-003 готово-когда).
 * F-12-123: название берётся из ОДНОГО источника (REPORT_CATALOG + reports.json) — совпадает с витриной
 * (F-12-002) и с заголовком страницы.
 */
import { HelpCircle, Star } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { toggleFavoriteReport, listFavoriteReports } from '@/api/reports';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { DASHBOARD_SLUG, REPORT_CATALOG, REPORT_GROUP_IDS, reportHref, type ReportGroupId } from '@/domain/reports';
import { useT } from '@/i18n/useT';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { Sheet } from '@/ui/Sheet';
import { DropdownChevron } from '@/ui/DropdownChevron';

export function reportTitleKey(slug: string): string {
  return slug === DASHBOARD_SLUG ? 'catalog.dashboard.title' : `catalog.items.${slug}.title`;
}

export interface ReportHeaderProps {
  slug: string;
  /** breadcrumbs: «Отчеты › Все отчеты» / «Финансы › Отчеты» и т.п. — по умолчанию «Отчеты › <группа>» */
  crumbGroup?: ReportGroupId;
  helpBody: string;
  actions?: ReactNode;
}

export function ReportHeader({ slug, crumbGroup, helpBody, actions }: ReportHeaderProps) {
  const t = useT('reports');
  const { staffId, ready } = useCurrent();
  const [helpOpen, setHelpOpen] = useState(false);

  const favQuery = useApiQuery(['reports', 'favorites', staffId], () => listFavoriteReports(staffId!), { enabled: ready && !!staffId, keepPrevious: true });
  const favMutation = useApiMutation((s: string) => toggleFavoriteReport(staffId!, s));
  const isFavorite = (favQuery.data ?? []).some((f) => f.slug === slug);

  const items: DropdownMenuItem[] = [
    { id: 'dashboard', label: t('catalog.dashboard.title'), href: '/biz/reports' },
    { id: 'visits-item', label: t('catalog.items.visits.title'), href: '/biz/reports/visits' },
    { id: 'sep-groups', separator: true },
    ...REPORT_GROUP_IDS.flatMap((group): DropdownMenuItem[] => [
      { id: `g-${group}`, groupLabel: t(`catalog.groups.${group}`) },
      ...REPORT_CATALOG.filter((r) => r.group === group && r.slug !== 'visits').map(
        (r): DropdownMenuItem => ({ id: r.slug, label: t(`catalog.items.${r.slug}.title` as never), href: reportHref(r.slug) }),
      ),
    ]),
  ];

  return (
    <div data-f="F-12-003" className="contents">
    <div data-f="F-12-018" className="contents">
    <div data-f="F-12-123" className="contents">
      <PageHeader
        breadcrumbs={[
          { label: t('nav.all'), href: '/biz/reports/all' },
          ...(crumbGroup ? [{ label: t(`catalog.groups.${crumbGroup}`) }] : []),
        ]}
        title={
          <span className="inline-flex items-center gap-1.5">
            <DropdownMenu
              trigger={(p) => (
                <button
                  {...p}
                  type="button"
                  className="-my-1.5 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 -mx-1 text-2xl font-semibold tracking-tight text-fg hover:bg-surface-2"
                >
                  {t(reportTitleKey(slug) as never)}
                  <DropdownChevron open={p['aria-expanded']} className="size-5" />
                </button>
              )}
              items={items}
              label={t('header.switcher')}
              className="max-h-[70vh] overflow-auto"
            />
          </span>
        }
        actions={
          <div className="flex items-center gap-1">
            {actions}
            <IconButton
              icon={<Star className={isFavorite ? 'fill-current text-warning' : undefined} />}
              label={isFavorite ? t('header.unfavorite') : t('header.favorite')}
              variant="ghost"
              onClick={() => favMutation.mutate(slug)}
            />
            <IconButton icon={<HelpCircle />} label={t('header.help')} variant="ghost" onClick={() => setHelpOpen(true)} />
          </div>
        }
      />
      <Sheet open={helpOpen} onOpenChange={setHelpOpen} title={t('header.help')} side="right" size="md">
        <div className="prose-sm flex flex-col gap-3 text-sm leading-relaxed whitespace-pre-line text-fg">{helpBody}</div>
        <p className="mt-4 text-xs text-muted">
          <Link href="/biz/reports/all" className="underline">
            {t('nav.all')}
          </Link>
        </p>
      </Sheet>
    </div>
    </div>
    </div>
  );
}
