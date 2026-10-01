'use client';

/**
 * /platform/moderation — очередь проверки (F-00-179): всё новое ждёт ручной проверки (F-00-168), решения с причинами
 * и возвратом монет (F-00-170), «без проверки» — шаблон, визит, повтор одобренного (F-00-169, F-00-171).
 * Материал виден в строке (миниатюра), решение — в строке на десктопе, шторкой «по одному» или пачкой: галочки →
 * «Одобрить N» / «Отклонить N» (клавиши A / R, ⌘A — все, Esc — снять выбор). Решённая строка уходит одна, с анимацией.
 */
import { useEffect, useState } from 'react';
import { Check, CircleCheck, ListX, ShieldCheck, X } from 'lucide-react';
import { useLocale } from 'next-intl';
import { TabCountSkeleton } from '@/areas/platform/components/TabCountSkeleton';
import { BulkRejectSheet } from '@/areas/platform/moderation/BulkRejectSheet';
import { ModerationReviewSheet } from '@/areas/platform/moderation/ModerationReviewSheet';
import { ModerationThumb } from '@/areas/platform/moderation/ModerationThumb';
import { ReasonsSheet } from '@/areas/platform/moderation/ReasonsSheet';
import { useModerationDecisions } from '@/areas/platform/moderation/useModerationDecisions';
import { useModerationCounts, useModerationItems, useRejectReasons } from '@/areas/platform/hooks/usePlatformData';
import type { LocaleCode } from '@/domain/core';
import type { ModerationKind, ModerationStatus, ModerationView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { BulkActionBar } from '@/ui/BulkActionBar';
import { Button } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';

const TABS: ModerationStatus[] = ['pending', 'approved', 'rejected', 'auto'];
/** Счётчики вкладок в демо — по ним ширина скелетона счётчика */
const TYPICAL_COUNTS: Record<ModerationStatus, number> = { pending: 9, approved: 17, rejected: 2, auto: 5 };
const KINDS: ModerationKind[] = ['staffPhoto', 'salonPhoto', 'servicePhoto', 'service', 'text', 'review', 'diploma', 'story', 'complaint'];
/** Решённая строка уходит: только opacity и сдвиг (DESIGN.md → «Скорость»), нажать на неё уже нельзя */
const LEAVING = 'pointer-events-none translate-x-3 opacity-0 transition-[opacity,transform,background-color] duration-150 motion-reduce:transition-none';

export function ModerationScreen() {
  const t = useT('platform');
  const fmt = useFormat();
  const locale = useLocale() as LocaleCode;
  const [tab, setTab] = useState<ModerationStatus>('pending');
  const [kind, setKind] = useState<ModerationKind | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const q = useModerationItems(tab, kind);
  const countsQ = useModerationCounts();
  const reasonsQ = useRejectReasons();
  const decisions = useModerationDecisions();
  const all = q.data ?? [];
  // Очередь бывает в сотни материалов: в таблице — страница (замер 28.09: 409 строк — одобрение одной 12,6 с при CPU×4)
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  const current = Math.min(page, pages);
  const rows = all.slice((current - 1) * pageSize, current * pageSize);
  const onPage = new Set(rows.map((m) => m.id));
  const canPick = tab === 'pending';
  // Выбор — только среди строк, что сейчас в очереди (решённые кем-то ещё уходят из выбора сами)
  const selected = canPick ? picked.filter((id) => onPage.has(id) && !decisions.leaving.has(id)) : [];
  const selectedPaid = rows.filter((m) => selected.includes(m.id)).reduce((sum, m) => sum + (m.paidCoins ?? 0), 0);

  const approveSelected = async () => {
    const ids = selected;
    if (await decisions.approveMany(ids)) setPicked([]);
  };
  const rejectSelected = async (reasonId: string, note?: string) => {
    const ids = selected;
    setBulkRejectOpen(false);
    if (await decisions.rejectMany(ids, reasonId, note)) setPicked([]);
  };

  // Клавиши очереди (шторка «по одному» закрыта): A — одобрить выбранные, R — отклонить, ⌘A/Ctrl+A — выбрать все, Esc — снять
  useEffect(() => {
    if (!canPick || openId || bulkRejectOpen || reasonsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.closest('[role="dialog"],[role="menu"],[role="listbox"]'))) return;
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && (key === 'a' || key === 'ф')) {
        if (!rows.length) return;
        e.preventDefault();
        setPicked(rows.map((m) => m.id));
      } else if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      } else if (key === 'escape' && selected.length) {
        setPicked([]);
      } else if ((key === 'a' || key === 'ф') && selected.length && !decisions.bulkPending) {
        e.preventDefault();
        void approveSelected();
      } else if ((key === 'r' || key === 'к') && selected.length && !decisions.bulkPending) {
        e.preventDefault();
        setBulkRejectOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const titleOf = (m: ModerationView) => (m.label && m.kind !== 'service' ? `${t(`moderation.kind.${m.kind}`)} · ${m.label}` : m.kind === 'service' && m.label ? `${t('moderation.kind.service')}: ${m.label}` : t(`moderation.kind.${m.kind}`));

  const columns: TableColumn<ModerationView>[] = [
    { id: 'media', header: '', mobile: 'media', width: '72px', cell: (m) => <ModerationThumb kind={m.kind} imageUrl={m.imageUrl} />, skeleton: <Skeleton variant="rect" className="size-14 rounded-lg" /> },
    {
      id: 'what',
      header: t('moderation.columnWhat'),
      mobile: 'title',
      width: '22rem',
      cell: (m) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">{titleOf(m)}</span>
          <span className="truncate text-sm font-normal text-muted md:hidden">{m.businessName} · {fmt.ago(m.submittedAt)}</span>
        </span>
      ),
      // Те же две строки (вторая — только на телефоне), что у материала с данными
      skeleton: (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">
            <SkeletonText width="22ch" />
          </span>
          <span className="truncate text-sm font-normal text-muted md:hidden">
            <SkeletonText width="20ch" />
          </span>
        </span>
      ),
    },
    { id: 'business', header: t('moderation.businessLabel'), mobile: 'hidden', width: '14rem', skeletonWidth: '14ch', cell: (m) => <span className="block truncate">{m.businessName}</span> },
    {
      id: 'submitted',
      header: t('moderation.submittedAt'),
      mobile: 'hidden',
      sortable: true,
      sortValue: (m) => m.submittedAt,
      width: '10rem',
      skeletonWidth: '10ch',
      cell: (m) => <span className="whitespace-nowrap text-muted">{fmt.ago(m.submittedAt)}</span>,
    },
    ...(tab === 'auto' || tab === 'rejected'
      ? [
          {
            id: 'why',
            header: tab === 'auto' ? t('moderation.columnWhyAuto') : t('moderation.columnReason'),
            mobile: 'badge' as const,
            width: '14rem',
            cell: (m: ModerationView) =>
              tab === 'auto' ? <Badge tone="info">{t(`moderation.source.${m.source}`)}</Badge> : <span className="text-sm text-muted">{m.reasonLabel ? pickText(m.reasonLabel, locale) : '—'}</span>,
          },
        ]
      : []),
    // Быстрые решения в строке — пока не открыта шторка «по одному» (под ней кнопки строки всё равно закрыты)
    ...(tab === 'pending' && !openId && !selected.length
      ? [
          {
            id: 'actions',
            header: <span className="sr-only">{t('moderation.columnActions')}</span>,
            mobile: 'hidden' as const,
            align: 'right' as const,
            width: '7rem',
            // Те же две кнопки, пока очередь грузится (нажать нечего — выключены)
            skeleton: (
              <span className="inline-flex gap-1">
                <IconButton icon={<X />} label={t('moderation.rejectWithReason')} variant="outline" size="sm" disabled />
                <IconButton icon={<Check />} label={t('moderation.approve')} variant="primary" size="sm" disabled />
              </span>
            ),
            cell: (m: ModerationView) => (
              // Решение прямо в строке (десктоп): клик по кнопке не открывает шторку
              <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu
                  label={t('moderation.rejectWithReason')}
                  trigger={(p) => <IconButton {...p} icon={<X />} label={t('moderation.rejectWithReason')} variant="outline" size="sm" />}
                  items={(reasonsQ.data ?? []).map((r) => ({ id: r.id, label: pickText(r.label, locale), onSelect: () => void decisions.reject(m.id, r.id, undefined, m.paidCoins) }))}
                />
                <IconButton icon={<Check />} label={t('moderation.approve')} variant="primary" size="sm" onClick={() => void decisions.approve(m.id)} />
              </span>
            ),
          },
        ]
      : []),
  ];

  const counts = countsQ.data;
  return (
    <div data-f="F-00-179 F-00-168 F-00-169" className="flex flex-col gap-6">
      <PageHeader
        title={t('moderation.title')}
        description={t('moderation.subtitle')}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as ModerationStatus);
          setOpenId(null);
          setPicked([]);
          setPage(1);
        }}
        items={TABS.map((s) => ({ value: s, label: t(`moderation.tab.${s}`), badge: counts ? <Badge size="sm" tone={s === 'pending' && counts.pending > 0 ? 'warning' : 'neutral'}>{counts[s]}</Badge> : <TabCountSkeleton typical={TYPICAL_COUNTS[s]} /> }))}
      />

      <div className="flex items-center gap-2">
        <Select
          aria-label={t('moderation.filterKind')}
          value={kind}
          onValueChange={(v) => {
            setKind(v as ModerationKind | 'all');
            setPicked([]);
            setPage(1);
          }}
          options={[{ value: 'all', label: t('moderation.allKinds') }, ...KINDS.map((k) => ({ value: k, label: t(`moderation.kind.${k}`) }))]}
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        {/* Справочник причин — настройка, а не вкладка очереди */}
        <Button variant="ghost" leftIcon={<ListX aria-hidden />} onClick={() => setReasonsOpen(true)} className="ml-auto shrink-0">
          {t('moderation.reasonsTitle')}
        </Button>
      </div>

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <Table
          label={t('moderation.title')}
          columns={columns}
          rows={rows}
          // Страницы — свои (выбор строк завязан на страницу), встроенные у таблицы выключены
          pagination={false}
          rowKey={(m) => m.id}
          loading={q.isLoading}
          // В демо в очереди девять материалов
          loadingRows={9}
          onRowClick={(m) => setOpenId(m.id)}
          selectable={canPick}
          selected={selected}
          onSelectedChange={setPicked}
          rowClassName={(m) => (decisions.leaving.has(m.id) ? LEAVING : undefined)}
          empty={
            kind !== 'all' ? (
              <EmptyState kind="search" title={t('moderation.emptyFilter')} onReset={() => setKind('all')} />
            ) : tab === 'pending' ? (
              <EmptyState icon={<CircleCheck aria-hidden className="text-success" />} title={t('moderation.emptyPending')} description={t('moderation.emptyPendingHint')} />
            ) : (
              <EmptyState icon={<ShieldCheck aria-hidden />} title={t('moderation.emptyTab')} />
            )
          }
        />
      )}

      {canPick && (q.isLoading || rows.length > 1) && !selected.length && <p className="-mt-3 hidden text-sm text-muted md:block">{t('moderation.bulkHint')}</p>}

      <BulkActionBar
        count={selected.length}
        onClear={() => setPicked([])}
        actions={
          <>
            <Button size="sm" variant="secondary" leftIcon={<X aria-hidden />} onClick={() => setBulkRejectOpen(true)} disabled={decisions.bulkPending}>
              {t('moderation.bulkReject')}
            </Button>
            <Button size="sm" leftIcon={<Check aria-hidden />} onClick={() => void approveSelected()} loading={decisions.bulkPending}>
              {t('moderation.bulkApprove', { n: selected.length })}
            </Button>
          </>
        }
      />
      <BulkRejectSheet
        open={bulkRejectOpen}
        count={selected.length}
        paidCoins={selectedPaid}
        pending={decisions.bulkPending}
        onOpenChange={setBulkRejectOpen}
        onConfirm={(reasonId, note) => void rejectSelected(reasonId, note)}
      />
      {!q.isError && all.length > DEFAULT_PAGE_SIZE && (
        <Pagination
          page={current}
          pageSize={pageSize}
          total={all.length}
          onPageChange={(n) => {
            setPage(n);
            setPicked([]);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setPicked([]);
          }}
        />
      )}
      <ModerationReviewSheet items={all} openId={openId} onOpenId={setOpenId} decisions={decisions} />
      <ReasonsSheet open={reasonsOpen} onOpenChange={setReasonsOpen} />
    </div>
  );
}
