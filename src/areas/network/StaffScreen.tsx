'use client';

/**
 * /biz/network/staff — «Сотрудники сети» (F-11-097): список фильтруется по должности, удалённым, уволенным;
 * порядок — перетаскиванием (F-11-100). Ссылки на форму (F-11-098/099/101), должности, нерабочие дни, зарплаты
 * и миграцию (F-11-102…109).
 */
import { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, UserCog } from 'lucide-react';
import { getNetworkStaffOrder, listNetworkPositions, listNetworkStaff, reorderNetworkStaffOrder, type NetworkStaffFilters } from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import type { Staff } from '@/domain/core';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { pickText } from '@/lib/text';
import { useLocale } from 'next-intl';
import { NetworkPageActions } from '@/areas/network/NetworkPageHelp';
import { useNetwork } from '@/areas/network/lib/useNetwork';

function staffKeyOf(s: Staff) {
  return s.name;
}

function SortableStaffRow({ s, locale, isNetworked }: { s: Staff; locale: 'ru' | 'en' | 'hy'; isNetworked: boolean }) {
  const t = useT('network');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: staffKeyOf(s) });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-2.5">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-11 w-11 shrink-0 items-center justify-center text-muted"
        aria-label={t('staff.dragHandle')}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <LinkButton
        href={`/biz/network/staff/${encodeURIComponent(staffKeyOf(s))}`}
        variant="ghost"
        className="h-auto min-h-11 flex-1 justify-start gap-3 px-0 py-1.5 text-left md:h-auto"
      >
        <Avatar src={s.avatarUrl} name={s.name} size="sm" />
        <span className="min-w-0 flex-1">
          {/* h-6 — под значок сети: строки со значком и без одной высоты */}
          <span className="flex h-6 items-center gap-1.5">
            <span className="block truncate text-sm font-medium text-fg">{s.name}</span>
            {isNetworked && (
              <span data-f="F-11-102 F-10-139">
                <Badge tone="accent" size="sm">
                  {t('services.networkMark')}
                </Badge>
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted">{s.position ? pickText(s.position, locale) : t('staff.noPosition')}</span>
        </span>
        {s.status === 'fired' && (
          <Badge tone="warning" size="sm">
            {t('staff.firedFired')}
          </Badge>
        )}
        {s.status === 'disabled' && (
          <Badge tone="neutral" size="sm">
            {t('staff.statusDeleted')}
          </Badge>
        )}
      </LinkButton>
    </li>
  );
}

/** Скелетон строки сотрудника — та же разметка: ручка, аватар, имя и должность */
function StaffRowSkeleton({ i }: { i: number }) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-2.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted">
        <GripVertical className="size-4" aria-hidden />
      </span>
      <span className="flex min-h-11 flex-1 items-center justify-start gap-3 px-0 py-1.5">
        <Skeleton variant="circle" className="size-8 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex h-6 items-center gap-1.5">
            <span className="block truncate text-sm font-medium text-fg">
              <SkeletonText width={i % 2 ? '14ch' : '17ch'} />
            </span>
          </span>
          <span className="block truncate text-xs text-muted">
            <SkeletonText width="9ch" />
          </span>
        </span>
      </span>
    </li>
  );
}

export function StaffScreen() {
  const t = useT('network');
  const locale = useLocale() as 'ru' | 'en' | 'hy';
  const { ready, networkId, isError, refetch } = useNetwork();
  const [positionId, setPositionId] = useState('');
  const [status, setStatus] = useState<NonNullable<NetworkStaffFilters['status']>>('active');
  const [fired, setFired] = useState<NonNullable<NetworkStaffFilters['fired']>>('working');

  const positionsQ = useApiQuery(['network', 'positions', networkId], () => listNetworkPositions(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  const filters: NetworkStaffFilters = { positionId: positionId || undefined, status, fired };
  const staffQ = useApiQuery(['network', 'staff', networkId, positionId, status, fired], () => listNetworkStaff(networkId!, filters), {
    enabled: ready && Boolean(networkId),
  });
  const orderQ = useApiQuery(['network', 'staffOrder', networkId], () => getNetworkStaffOrder(networkId!), { enabled: ready && Boolean(networkId) });
  const reorderMutation = useApiMutation((keys: string[]) => reorderNetworkStaffOrder(networkId!, keys));

  const [order, setOrder] = useState<Staff[] | null>(null);
  const [networkCounts, setNetworkCounts] = useState<Map<string, number>>(new Map());
  const [seenSource, setSeenSource] = useState<{ staff?: Staff[]; order?: string[] }>({});
  if (staffQ.data && (seenSource.staff !== staffQ.data || seenSource.order !== orderQ.data)) {
    // F-11-100/102: сетевой сотрудник — одна карточка на человека (F-11-102 «значок сети»), хотя записей
    // в core.staff по числу филиалов несколько; первую запись показываем, остальные считаем в бейдж.
    const counts = new Map<string, number>();
    const deduped = new Map<string, Staff>();
    for (const s of staffQ.data) {
      const key = staffKeyOf(s);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!deduped.has(key)) deduped.set(key, s);
    }
    const savedOrder = orderQ.data ?? [];
    const ordered = savedOrder.map((k) => deduped.get(k)).filter((s): s is Staff => Boolean(s));
    const rest = [...deduped.values()].filter((s) => !savedOrder.includes(staffKeyOf(s)));
    setOrder([...ordered, ...rest]);
    setNetworkCounts(counts);
    setSeenSource({ staff: staffQ.data, order: orderQ.data });
  }

  const staffLoading = !ready || staffQ.isLoading || !order;
  const skeletonRows = useSkeletonCount('networkStaff', { loading: staffLoading, count: order?.length, fallback: 9, max: 20 });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !order) return;
    const from = order.findIndex((s) => staffKeyOf(s) === active.id);
    const to = order.findIndex((s) => staffKeyOf(s) === over.id);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    void reorderMutation.mutate(next.map(staffKeyOf));
  };

  if (isError || staffQ.isError) return <ErrorState onRetry={() => (isError ? refetch() : staffQ.refetch())} />;

  return (
    <div data-f="F-11-097" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('staff.title')}
        description={t('staff.subtitle')}
        actions={
          <NetworkPageActions
            titleKey="help.staff.title"
            bodyKey="help.staff.body"
            extra={
              <div className="flex flex-wrap items-center gap-2">
                <LinkButton href="/biz/network/staff/new" size="sm" leftIcon={<Plus aria-hidden />}>
                  {t('staff.add')}
                </LinkButton>
              </div>
            }
          />
        }
      />

      <div className="flex flex-wrap gap-2">
        <LinkButton href="/biz/network/staff/positions" variant="secondary" size="sm">
          {t('staff.openPositions')}
        </LinkButton>
        <LinkButton href="/biz/network/staff/off-days" variant="secondary" size="sm">
          {t('staff.openOffDays')}
        </LinkButton>
        <LinkButton href="/biz/network/staff/payroll" variant="secondary" size="sm">
          {t('staff.openPayroll')}
        </LinkButton>
        <LinkButton href="/biz/network/staff/migration" variant="secondary" size="sm">
          {t('staff.openMigration')}
        </LinkButton>
      </div>

      <SectionCard title={t('staff.filtersTitle')}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-56">
            <Select
              options={[{ value: '', label: t('staff.allPositions') }, ...(positionsQ.data ?? []).map((p) => ({ value: p, label: p }))]}
              value={positionId}
              onValueChange={setPositionId}
              placeholder={positionsQ.data?.length ? undefined : t('staff.noPositionsHint')}
            />
          </div>
          <SegmentedControl
            options={[
              { value: 'active', label: t('staff.statusActive') },
              { value: 'deleted', label: t('staff.statusDeleted') },
              { value: 'all', label: t('staff.statusAll') },
            ]}
            value={status}
            onValueChange={(v) => setStatus(v as typeof status)}
          />
          <SegmentedControl
            options={[
              { value: 'working', label: t('staff.firedWorking') },
              { value: 'fired', label: t('staff.firedFired') },
              { value: 'all', label: t('staff.statusAll') },
            ]}
            value={fired}
            onValueChange={(v) => setFired(v as typeof fired)}
          />
        </div>
      </SectionCard>

      {staffLoading ? (
        <div aria-hidden>
          <p className="text-xs text-muted">{t('staff.reorderHint')}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {Array.from({ length: skeletonRows }, (_, i) => (
              <StaffRowSkeleton key={i} i={i} />
            ))}
          </ul>
        </div>
      ) : !order.length ? (
        <EmptyState
          icon={<UserCog aria-hidden />}
          kind="search"
          onReset={() => {
            setPositionId('');
            setStatus('active');
            setFired('working');
          }}
          title={t('staff.empty')}
        />
      ) : (
        <div data-f="F-11-100 F-10-138">
          <p className="text-xs text-muted">{t('staff.reorderHint')}</p>
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <SortableContext items={order.map(staffKeyOf)} strategy={verticalListSortingStrategy}>
              <ul className="mt-2 flex flex-col gap-2">
                {order.map((s) => (
                  <SortableStaffRow key={s.id} s={s} locale={locale} isNetworked={(networkCounts.get(staffKeyOf(s)) ?? 1) > 1} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <div data-f="F-11-074 F-11-107 F-11-110">
        <SectionCard title={t('staff.rulesTitle')}>
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            <li>{t('staff.rules.occupancy')}</li>
            <li>{t('staff.rules.positionReadonly')}</li>
            <li>{t('staff.rules.multiLocationSchedule')}</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
