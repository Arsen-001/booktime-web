'use client';

/**
 * Лист ожидания бизнеса — ОДИН (владелец, 30.09.2026), и вид у него один: этот компонент — и экран /biz/waitlist
 * (variant="page"), и панель «Лист ожидания» в журнале (variant="panel", вклад journalWaitlist ← resources).
 * Заявки — от сотрудника, из приложения клиента («Сообщить, когда освободится») и из виджета онлайн-записи.
 *
 * F-16-149…168 + F-01-156…162: фильтры (статус с числами, день, сортировка, поиск), карточка с раскрытием, форма заявки,
 * «Записать» (окно записи с клиентом, услугой, мастером и ближайшим свободным временем, которое ждёт заявка; после
 * сохранения заявка «Закрытая»), «Уведомить лист ожидания», правка и удаление с «Отменить» в тосте.
 */
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Hourglass, ListChecks, Plus } from 'lucide-react';
import { findClientByPhone, useCoreList } from '@/api/core';
import {
  computeWaitlistStatus,
  filterWaitlist,
  notifyWaitlistForFreedSlot,
  removeWaitlistEntry,
  suggestWaitlistSlot,
  upcomingWish,
  useWaitlist,
  type WaitlistEntry,
  type WaitlistFilter,
  type WaitlistRow,
  type WaitlistStatus,
} from '@/api/resources';
import { useApiMutation } from '@/api/request';
import { useCan } from '@/demo/hooks';
import type { Id, ISODate } from '@/domain/core';
import { isScheduleStaff } from '@/domain/schedule';
import type { WaitlistRecordRequest } from '@/extensions/types';
import { normalizePhone } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { DEFAULT_PAGE_SIZE, usePagedList } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useToast } from '@/ui/Toast';
import { useTodayTick } from '@/areas/resources/waitlist/useTodayTick';
import { WaitlistEntryCard } from '@/areas/resources/waitlist/WaitlistEntryCard';
import { WaitlistForm } from '@/areas/resources/waitlist/WaitlistForm';
import { WaitlistRowSkeleton } from '@/areas/resources/waitlist/WaitlistRowSkeleton';

type DateMode = NonNullable<WaitlistFilter['dateMode']>;
type SortMode = NonNullable<WaitlistFilter['sort']>;

export interface WaitlistBoardProps {
  variant: 'page' | 'panel';
  businessId: Id | undefined;
  locationId: Id | undefined;
  /** День журнала: панель — день сетки, экран — ?date= из журнала. Есть — фильтр «На день журнала» по умолчанию */
  journalDate?: ISODate;
  /** Мастера журнала (панель передаёт видимых); нет — все мастера журнала бизнеса */
  staffIds?: Id[];
  /** «Записать» у хозяина (панель журнала открывает окно записи у себя); нет — переход в журнал */
  onRecord?: (request: WaitlistRecordRequest) => void;
}

export function WaitlistBoard({ variant, businessId, locationId, journalDate, staffIds, onRecord }: WaitlistBoardProps) {
  const t = useT('resources');
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const canSeePhones = useCan('clients.phones');
  // Вести лист: администратор и владелец (resources.manage) и тот, кто записывает в журнал (мастер в панели журнала)
  const canManageResources = useCan('resources.manage');
  const canCreateBookings = useCan('journal.create');
  const canManage = canManageResources || canCreateBookings;
  const panel = variant === 'panel';
  const day = useTodayTick();

  const listQ = useWaitlist(businessId);
  const servicesQ = useCoreList('services', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });
  const services = servicesQ.data ?? [];
  const serviceNameById = new Map(services.map((s) => [s.id, pickText(s.name, locale)]));
  const staffNameById = new Map((staffQ.data ?? []).map((s) => [s.id, s.name]));
  // F-16-151: групповую и пакетную услугу в заявку не добавить — только индивидуальные
  const serviceOptions = services.filter((s) => s.kind !== 'group' && !s.servicePackage).map((s) => ({ id: s.id, label: pickText(s.name, locale) }));
  // Мастера формы и «Записать» — те, кто есть в журнале (без уволенных, приглашённых и скрытых из журнала)
  const journalStaff = (staffQ.data ?? []).filter((s) => isScheduleStaff(s) && !s.hiddenInJournal && (!staffIds || staffIds.includes(s.id)));
  const staffOptions = journalStaff.map((s) => ({ id: s.id, label: s.name, serviceIds: services.filter((sv) => sv.staffIds.includes(s.id)).map((sv) => sv.id) }));

  const [expandedId, setExpandedId] = useState<Id | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WaitlistEntry | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<Id | null>(null);
  const [planningId, setPlanningId] = useState<Id | null>(null);
  const [notifyingId, setNotifyingId] = useState<Id | null>(null);
  const [status, setStatus] = useState<WaitlistStatus>('active');
  const [dateMode, setDateMode] = useState<DateMode>(journalDate ? 'selected' : 'all');
  const [sort, setSort] = useState<SortMode>('soonest');
  const [query, setQuery] = useState('');

  const remove = useApiMutation((id: Id) => removeWaitlistEntry(id));
  // F-16-166: «Уведомить лист ожидания» — отметка «Уведомлён» всем, кто ждёт эту услугу в этот день (не только этой заявке)
  const notify = useApiMutation((args: { serviceId: Id; date: string; staffId?: Id }) => notifyWaitlistForFreedSlot(businessId ?? '', args.serviceId, args.date, args.staffId));

  const allEntries = listQ.data ?? [];
  const statusCounts: Record<WaitlistStatus, number> = { active: 0, expired: 0, closed: 0 };
  for (const e of allEntries) statusCounts[computeWaitlistStatus(e, day)]++;
  const rows = filterWaitlist(allEntries, { status, dateMode, selectedDate: journalDate, sort, query }, day).filter((r) => r.id !== pendingDeleteId);
  const { pageItems, pager } = usePagedList(rows, { resetKey: `${status}|${dateMode}|${sort}|${query}|${journalDate ?? ''}` });
  const loading = listQ.isLoading;
  const skeletonRows = useSkeletonCount('waitlist', { loading, count: listQ.data ? pageItems.length : undefined, fallback: 2, max: DEFAULT_PAGE_SIZE });

  const openForm = (entry: WaitlistEntry | null) => {
    setEditing(entry);
    setFormOpen(true);
  };

  // ⭐ F-00-061: вместо «Вы уверены?» — заявка сразу скрывается, «Отменить» 5 секунд возвращает её
  const doDelete = (entry: WaitlistRow) => {
    setPendingDeleteId(entry.id);
    const timer = setTimeout(() => {
      remove
        .mutate(entry.id)
        .catch(() => toast.error(t('form.saveFailed')))
        .finally(() => setPendingDeleteId((id) => (id === entry.id ? null : id)));
    }, 5000);
    toast.show({
      title: t('waitlist.deletePending'),
      tone: 'success',
      durationMs: 5000,
      action: {
        label: t('waitlist.undo'),
        onClick: () => {
          clearTimeout(timer);
          setPendingDeleteId((id) => (id === entry.id ? null : id));
          toast.info(t('waitlist.undone'));
        },
      },
    });
  };

  const doNotify = async (entry: WaitlistRow) => {
    setNotifyingId(entry.id);
    try {
      const res = await notify.mutate({ serviceId: entry.serviceIds[0], date: upcomingWish(entry, day)?.date ?? journalDate ?? day, staffId: entry.staffIds[0] });
      if (res.notifiedIds.length > 0) toast.success(t('waitlist.notified'));
      else toast.info(t('waitlist.notifiedNobody'));
    } catch {
      toast.error(t('form.saveFailed'));
    } finally {
      setNotifyingId(null);
    }
  };

  // F-16-161/162, F-01-159: окно записи с клиентом, услугами, мастером и ближайшим свободным временем, которое ждёт заявка
  const doRecord = async (entry: WaitlistRow) => {
    setPlanningId(entry.id);
    try {
      const service = services.find((sv) => entry.serviceIds.includes(sv.id));
      const phone = normalizePhone(entry.clientPhone);
      const [client, plan] = await Promise.all([
        phone && businessId ? findClientByPhone(businessId, phone).catch(() => undefined) : undefined,
        suggestWaitlistSlot(entry, service, journalStaff.map((s) => s.id)).catch(() => undefined),
      ]);
      const wish = upcomingWish(entry, day);
      const request: WaitlistRecordRequest = {
        entryId: entry.id,
        clientId: client?.id,
        clientName: entry.clientName,
        clientPhone: entry.clientPhone,
        serviceIds: entry.serviceIds,
        comment: entry.comment,
        // «Любой специалист» — мастер, который делает услугу заявки (иначе окно открывалось на владельце без услуг)
        staffId: plan?.staffId ?? entry.staffIds[0] ?? service?.staffIds[0],
        date: plan?.date ?? wish?.date ?? day,
        // Желаемое занято — план уже несёт ближайшее свободное; занятое желание в окно не подставляем
        time: plan ? plan.time : (wish?.intervals?.[0]?.from ?? wish?.time),
      };
      if (plan?.wishBusy) toast.warning(t('waitlist.wishBusy'));
      if (onRecord) onRecord(request);
      else router.push(`/biz/journal?${journalQuery(request).toString()}`);
    } finally {
      setPlanningId(null);
    }
  };

  const addButton = (
    <Button data-f="F-16-149 F-01-157" leftIcon={<Plus aria-hidden />} onClick={() => openForm(null)}>
      {t('waitlist.add')}
    </Button>
  );
  const countText = loading ? <SkeletonText width="10ch" /> : t('waitlist.count', { count: rows.length });
  const inlineForm = panel && formOpen;

  return (
    <div data-f="F-16-033 F-16-135 F-16-149 F-16-163 F-04-104 F-01-156 F-01-162" className={panel ? 'flex flex-col gap-4' : 'mx-auto flex w-full max-w-2xl flex-col gap-6'}>
      {panel ? (
        !inlineForm && (
          <div className="flex flex-wrap items-center gap-2">
            {canManage && addButton}
            {canManageResources && (
              <LinkButton href="/biz/waitlist" variant="ghost" leftIcon={<ListChecks aria-hidden className="size-4" />} className="ml-auto">
                {t('waitlist.openFull')}
              </LinkButton>
            )}
          </div>
        )
      ) : (
        <PageHeader
          title={t('waitlist.title')}
          description={t('waitlist.subtitle')}
          // Счётчик и кнопка на месте уже при загрузке — шапка не перестраивается, когда заявки пришли
          meta={!listQ.isError ? <span className="text-sm text-muted">{countText}</span> : undefined}
          actions={canManage && (loading || allEntries.length > 0) ? <span className="max-md:hidden">{addButton}</span> : undefined}
        />
      )}

      <WaitlistForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        entry={editing}
        businessId={businessId}
        locationId={locationId}
        serviceOptions={serviceOptions}
        staffOptions={staffOptions}
        layout={panel ? 'inline' : 'sheet'}
        // ⭐ F-01-156: новая заявка видна сразу, даже если фильтр открыт на другом дне
        onSaved={() => setDateMode((m) => (editing ? m : 'all'))}
      />

      {inlineForm ? null : listQ.isError ? (
        <ErrorState onRetry={listQ.refetch} />
      ) : !loading && allEntries.length === 0 ? (
        <EmptyState icon={<Hourglass aria-hidden />} title={t('waitlist.emptyTitle')} description={t('waitlist.emptyText')} action={canManage && !panel ? addButton : undefined} />
      ) : (
        <>
          {/* F-16-155…158: поиск и статус — в строке; день и сортировка — за «Фильтры» (DESIGN.md: не стена фильтров) */}
          <div data-f="F-16-158" className="flex flex-col gap-3">
            <FilterBar
              search={{ value: query, onValueChange: setQuery, placeholder: t('waitlist.searchPlaceholder') }}
              filters={[
                {
                  id: 'date',
                  label: t('waitlist.filters.date'),
                  node: (
                    <div data-f="F-16-156">
                      <Select
                        value={dateMode}
                        onValueChange={(v) => setDateMode(v as DateMode)}
                        // «Все» первым — это «без фильтра» (FilterBar не считает его включённым фильтром)
                        options={[
                          { value: 'all', label: t('waitlist.filters.dateAll') },
                          { value: 'today', label: t('waitlist.filters.dateToday') },
                          ...(journalDate ? [{ value: 'selected', label: t('waitlist.filters.dateSelected') }] : []),
                        ]}
                      />
                    </div>
                  ),
                },
                {
                  id: 'sort',
                  label: t('waitlist.filters.sort'),
                  node: (
                    <div data-f="F-16-157">
                      <Select
                        value={sort}
                        onValueChange={(v) => setSort(v as SortMode)}
                        options={[
                          { value: 'soonest', label: t('waitlist.filters.sortSoonest') },
                          { value: 'newest', label: t('waitlist.filters.sortNewest') },
                          { value: 'oldest', label: t('waitlist.filters.sortOldest') },
                        ]}
                      />
                    </div>
                  ),
                },
              ]}
            />
            <div data-f="F-16-155" className="flex flex-wrap gap-1.5">
              {(['active', 'expired', 'closed'] as const).map((s) => (
                <Chip key={s} selected={status === s} count={loading ? undefined : statusCounts[s]} countLoading={loading} onClick={() => setStatus(s)}>
                  {t(`waitlist.status.${s}`)}
                </Chip>
              ))}
            </div>
            {panel && (loading || rows.length > 0) && <p className="text-xs text-muted">{countText}</p>}
          </div>

          {loading ? (
            <ul className="flex flex-col gap-2" aria-busy>
              {Array.from({ length: skeletonRows }, (_, i) => (
                <WaitlistRowSkeleton key={i} wide={i % 2 === 0} />
              ))}
            </ul>
          ) : rows.length === 0 ? (
            // Заявки есть, но не под этот фильтр — так и говорим, и одна кнопка показывает все (не «Заявок пока нет»)
            <EmptyState
              kind={query.trim() ? 'search' : 'default'}
              icon={<Hourglass aria-hidden />}
              title={dateMode !== 'all' ? t('waitlist.emptyFiltered') : t('waitlist.emptyTitle')}
              description={dateMode !== 'all' ? t('waitlist.emptyFilteredText') : undefined}
              action={
                dateMode !== 'all' ? (
                  <Button variant="outline" onClick={() => setDateMode('all')}>
                    {t('waitlist.showAll')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {pageItems.map((row) => (
                <WaitlistEntryCard
                  key={row.id}
                  row={row}
                  today={day}
                  serviceNameById={serviceNameById}
                  staffNameById={staffNameById}
                  expanded={expandedId === row.id}
                  onToggle={() => setExpandedId((id) => (id === row.id ? null : row.id))}
                  canManage={canManage}
                  canSeePhones={canSeePhones}
                  recording={planningId === row.id}
                  notifying={notifyingId === row.id}
                  onRecord={() => void doRecord(row)}
                  onNotify={() => void doNotify(row)}
                  onEdit={() => openForm(row)}
                  onDelete={() => doDelete(row)}
                />
              ))}
            </ul>
          )}
          {pager}
        </>
      )}

      {/* Телефон: главное действие — на большом пальце (Fab), не полоса на всю ширину под заголовком */}
      {!panel && canManage && allEntries.length > 0 && <Fab icon={<Plus aria-hidden />} label={t('waitlist.add')} onClick={() => openForm(null)} />}
    </div>
  );
}

/** «Записать» с экрана листа — окно записи журнала по адресу (?new=1&waitlist=…); сохранение закрывает заявку */
function journalQuery(r: WaitlistRecordRequest): URLSearchParams {
  const qs = new URLSearchParams({ new: '1', waitlist: r.entryId, name: r.clientName, phone: r.clientPhone, date: r.date });
  if (r.serviceIds.length) qs.set('services', r.serviceIds.join(','));
  if (r.time) qs.set('start', r.time);
  if (r.staffId) qs.set('staff', r.staffId);
  return qs;
}
