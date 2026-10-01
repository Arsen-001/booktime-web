'use client';

/**
 * /platform/promocodes — промокоды (F-00-178, F-00-020) и бесплатные месяцы (F-00-019). Строка отвечает на главное без
 * перехода: код, условия, кому, статус. На телефоне одна главная кнопка у пальца, «Выдать месяц» — в меню «⋯».
 */
import { useState } from 'react';
import { CalendarPlus, MoreHorizontal, Plus, Ticket } from 'lucide-react';
import { TabCountSkeleton } from '@/areas/platform/components/TabCountSkeleton';
import { usePromoCodes } from '@/areas/platform/hooks/usePlatformData';
import { GrantFreeMonthSheet } from '@/areas/platform/promocodes/GrantFreeMonthSheet';
import { PromoCreateSheet } from '@/areas/platform/promocodes/PromoCreateSheet';
import { PromoDetailSheet } from '@/areas/platform/promocodes/PromoDetailSheet';
import { usePromoText } from '@/areas/platform/promocodes/promoText';
import { PROMO_TONE } from '@/areas/platform/lib/tones';
import { isPromoActive, type PromoStatus, type PromoView } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { ExitHold } from '@/ui/ExitHold';

type PromoTab = 'active' | 'used' | 'closed';
/** Счётчики вкладок в демо — по ним ширина скелетона счётчика */
const TYPICAL_COUNTS: Record<PromoTab, number> = { active: 5, used: 1, closed: 2 };
const TAB_OF = (s: PromoStatus): PromoTab => (isPromoActive(s) ? 'active' : s === 'used' ? 'used' : 'closed');

export function PromocodesScreen() {
  const t = useT('platform');
  const text = usePromoText();
  const q = usePromoCodes();
  const [tab, setTab] = useState<PromoTab>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [granting, setGranting] = useState(false);

  const all = q.data ?? [];
  const rows = all.filter((p) => TAB_OF(p.status) === tab);
  const open = all.find((p) => p.id === openId);
  const count = (tb: PromoTab) => all.filter((p) => TAB_OF(p.status) === tb).length;

  const columns: TableColumn<PromoView>[] = [
    // В строке — только текст: строка списка сама кнопка, копирование — в карточке промокода
    {
      id: 'code',
      header: t('promocodes.code'),
      mobile: 'title',
      width: '12rem',
      cell: (p) => <span className="block truncate font-mono text-base font-semibold tracking-wide text-fg">{p.code}</span>,
      skeleton: (
        <span className="block truncate font-mono text-base font-semibold tracking-wide text-fg">
          <SkeletonText width="10ch" />
        </span>
      ),
    },
    {
      id: 'terms',
      header: t('promocodes.terms'),
      mobile: 'subtitle',
      width: '22rem',
      skeletonWidth: '26ch',
      cell: (p) => <span className="block truncate text-muted">{[text.terms(p), text.until(p)].filter(Boolean).join(' · ')}</span>,
    },
    { id: 'who', header: t('promocodes.who'), mobile: 'meta', width: '14rem', skeletonWidth: '14ch', cell: (p) => <span className="block truncate">{text.used(p) ?? text.who(p)}</span> },
    {
      id: 'status',
      header: t('promocodes.statusLabel'),
      mobile: 'badge',
      align: 'right',
      width: '9rem',
      cell: (p) => <Badge tone={PROMO_TONE[p.status]}>{t(`promocodes.status.${p.status}`)}</Badge>,
      skeleton: (
        <Badge tone="neutral">
          <SkeletonText width="7ch" />
        </Badge>
      ),
    },
  ];

  const newButton = (className?: string) => (
    <Button className={className} leftIcon={<Plus aria-hidden />} onClick={() => setCreating(true)}>
      {t('promocodes.add')}
    </Button>
  );

  return (
    <div data-f="F-00-178 F-00-020 F-00-019" className="flex flex-col gap-6">
      <PageHeader
        title={t('promocodes.title')}
        description={t('promocodes.subtitle')}
        actions={
          <>
            {/* Телефон: «Выдать месяц» — в меню «⋯», новый код — плавающей кнопкой у пальца */}
            <DropdownMenu
              label={t('promocodes.more')}
              trigger={(p) => <IconButton {...p} icon={<MoreHorizontal />} label={t('promocodes.more')} variant="outline" className="md:hidden" />}
              items={[{ id: 'grant', label: t('promocodes.grantFreeMonth'), icon: <CalendarPlus aria-hidden />, onSelect: () => setGranting(true) }]}
            />
            <Button variant="outline" className="max-md:hidden" leftIcon={<CalendarPlus aria-hidden />} onClick={() => setGranting(true)}>
              {t('promocodes.grantFreeMonth')}
            </Button>
            {newButton('max-md:hidden')}
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as PromoTab)}
        items={(['active', 'used', 'closed'] as const).map((tb) => ({
          value: tb,
          label: t(`promocodes.tab.${tb}`),
          badge: q.data ? <Badge size="sm" tone="neutral">{count(tb)}</Badge> : <TabCountSkeleton typical={TYPICAL_COUNTS[tb]} />,
        }))}
      />

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <Table
          label={t('promocodes.title')}
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          loading={q.isLoading}
          onRowClick={(p) => setOpenId(p.id)}
          empty={
            tab === 'active' ? (
              <EmptyState icon={<Ticket aria-hidden />} title={t('promocodes.empty')} description={t('promocodes.emptyHint')} action={newButton()} />
            ) : (
              <EmptyState icon={<Ticket aria-hidden />} title={t(`promocodes.emptyTab.${tab}`)} />
            )
          }
        />
      )}

      <Fab icon={<Plus />} label={t('promocodes.add')} extended onClick={() => setCreating(true)} />
      <ExitHold value={creating}>{() => <PromoCreateSheet onClose={() => setCreating(false)} />}</ExitHold>
      <ExitHold value={granting}>{() => <GrantFreeMonthSheet onClose={() => setGranting(false)} />}</ExitHold>
      <ExitHold value={open}>{(open) => <PromoDetailSheet key={open.id} promo={open} onClose={() => setOpenId(null)} />}</ExitHold>
    </div>
  );
}
