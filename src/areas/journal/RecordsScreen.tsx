'use client';

/**
 * Экран «Записи» (F-01-119, F-01-120, F-01-181…183): полный отчёт «Записи» — рабочий список визитов
 * с мягко удалёнными строками, массовыми действиями и импортом/выгрузкой в Excel, плюс фильтры по
 * источнику/статусу оплаты/категории записи (F-01-181 «Поля и варианты»).
 */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import styles from '@/areas/journal/records.module.css';
import { Ban, Info, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { Booking } from '@/domain/core';
import { listBookings, coreList } from '@/api/core';
import {
  bulkDeleteBookings,
  createExternalBooking,
  exportBookingsToEmail,
  getBookingCategories,
  listBookingExtrasByIds,
  getDataOpsLog,
  importBookingRows,
  logBookingHistory,
  restoreDeletedBooking,
  type ImportRow,
} from '@/api/journal';
import { bookingCategoryLabel } from '@/areas/journal/lib/bookingCategoryLabel';
import { listBookingPaymentSummaries } from '@/api/finance';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { canDeleteBooking, isBeyondHistoryLimit, maskPhone, useJournalBlockRights, useWindowRights } from '@/areas/journal/lib/rights';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { combine, today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { Select } from '@/ui/Select';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { cn } from '@/lib/cn';
import { SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';
import { Textarea } from '@/ui/Textarea';
import { TimePicker } from '@/ui/TimePicker';
import { Tooltip } from '@/ui/Tooltip';
import { useConfirm, useToast } from '@/ui/Toast';
import { startNavPending } from '@/ui/navigation/navPending';

type CancelFilter = 'all' | 'cancelled' | 'notCancelled' | 'deleted';
type SourceFilter = 'all' | 'online' | 'offline';
type PaidFilter = 'all' | 'paid' | 'unpaid';
const ONLINE_SOURCES = new Set(['app', 'link', 'widget']);

const CANCELLED_STATUSES = new Set(['no_show', 'cancelled_by_client', 'cancelled_by_master']);

/**
 * Ширины колонок (они же минимальные): колонка не растягивается под длинный текст и не сжимается под полосой
 * скелетона — длинное режется многоточием, строка всегда одной высоты (DESIGN.md → «The skeleton IS the page»).
 */
const COL = {
  client: '13rem',
  when: '10rem',
  staff: '10rem',
  service: '13rem',
  total: '7rem',
  creator: '10rem',
  source: '8.5rem',
  status: '10rem',
  edit: '4rem',
} as const;
/** Место под текст в ячейке ширины w: минус отступы ячейки px-4 */
const fit = (w: string) => `calc(${w} - 2rem)`;
/** Текст ячейки в одну строку с многоточием */
const clip = (w: string, text: string) => (
  <span className="block truncate" style={{ maxWidth: fit(w) }}>
    {text}
  </span>
);

export function RecordsScreen() {
  const t = useT('journal');
  const router = useRouter();
  // Переход в журнал из кода (строка, карандаш, «создать заново»): полоска загрузки и скелет — сразу, как у ссылок
  // (NavPendingFeedback), а не тишина на секунду-две, пока журнал грузится
  const openJournal = (href: string) => {
    startNavPending(href);
    router.push(href);
  };
  const tc = useT('common');
  const locale = useLocale();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const { ready, businessId, staffId: ownStaffId, activeLocationIds } = useCurrent();
  const toast = useToast();
  const confirm = useConfirm();
  // F-01-178: без права «видеть чужие записи» отчёт «Записи» сужается до своих строк — тем же
  // правилом, что уже применяет сетка журнала (JournalScreen: canSeeOthers && viewStaffScope==='all').
  const canSeeOthers = useCan('journal.others');
  const journalRights = useJournalBlockRights();
  const canSeeOtherStaffRecords = canSeeOthers && journalRights.viewStaffScope === 'all';
  // qa/full-test-0930/journal-perms.md: те же права, что у окна записи и сетки — телефоны, «Показывать статистику»,
  // окно истории, удаление, загрузка (заводит клиентов — clients.edit) и выгрузка (clients.export)
  const windowRights = useWindowRights();
  const canImport = useCan('clients.edit') && windowRights.createBookings;
  const canExport = useCan('clients.export');
  const canCreateAny = useCan('journal.create') && canSeeOtherStaffRecords;
  const todayIso = today();
  const [cancelFilter, setCancelFilter] = useState<CancelFilter>('all');
  // F-01-181 «Поля и варианты»: источник (все/онлайн/офлайн), статус оплаты, категория записи
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  // F-16-025: «У нас: 1:1 + фильтр по ресурсу в списке записей делаем» — своё решение раздела resources,
  // так как Altegio показывает такой фильтр только в обзоре отчётов, не в самой статье/кабинете.
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportEmail, setExportEmail] = useState('');
  const [importResult, setImportResult] = useState<{ createdCount: number; errorCount: number } | undefined>(undefined);
  // F-01-036: демо-точка входа «как у бота/CRM» — интеграций в проекте нет (раздел «Интеграции» —
  // не наш, qa/requests/journal.md), но настоящий бот вызовет ровно createExternalBooking(); форма
  // здесь только показывает, что этот путь реально создаёт запись, а не ограничивается типом в ядре.
  const [externalOpen, setExternalOpen] = useState(false);
  const [externalName, setExternalName] = useState('');
  const [externalPhone, setExternalPhone] = useState('');
  const [externalServiceId, setExternalServiceId] = useState('');
  const [externalStaffId, setExternalStaffId] = useState('');
  const [externalDate, setExternalDate] = useState(today());
  const [externalTime, setExternalTime] = useState('10:00');
  const [externalError, setExternalError] = useState<string | null>(null);

  const bookingsQuery = useApiQuery(['journal', 'records', businessId], () => listBookings({ businessId, includeDeleted: true }), {
    enabled: ready && Boolean(businessId),
  });
  const clientsQuery = useApiQuery(['journal', 'records-clients', businessId], () => coreList('clients', { businessId: businessId! }), {
    enabled: ready && Boolean(businessId),
  });
  const staffQuery = useApiQuery(['journal', 'records-staff', businessId], () => coreList('staff', { businessId: businessId! }), {
    enabled: ready && Boolean(businessId),
  });
  const servicesQuery = useApiQuery(['journal', 'records-services', businessId], () => coreList('services', { businessId: businessId! }), {
    enabled: ready && Boolean(businessId),
  });
  const categoriesQuery = useApiQuery(['journal', 'records-categories'], getBookingCategories);
  const resourcesQuery = useApiQuery(['journal', 'records-resources', businessId], () => coreList('resources', { businessId: businessId! }), {
    enabled: ready && Boolean(businessId),
  });
  // F-01-119: карточка удаления (автор, время), оплата и категории записи хранятся у нас — одним запросом на весь
  // список (listBookingExtrasByIds), а не отдельным запросом на каждую из ~2000 записей, как было
  const extrasQuery = useApiQuery(
    ['journal', 'records-extras', bookingsQuery.data?.map((b) => b.id).join(',')],
    () => listBookingExtrasByIds((bookingsQuery.data ?? []).map((b) => b.id)),
    { enabled: Boolean(bookingsQuery.data) },
  );
  // «Оплачено» — из финансов (тот же источник, что окно оплаты и касса; journal.md), одним запросом на весь список
  const paymentsQuery = useApiQuery(
    ['journal', 'records-payments', businessId, bookingsQuery.data?.map((b) => b.id).join(',')],
    () => listBookingPaymentSummaries(businessId!, (bookingsQuery.data ?? []).map((b) => b.id)),
    { enabled: Boolean(bookingsQuery.data) && Boolean(businessId) },
  );
  /** Оплачено по записи: сумма записи − остаток к оплате (предоплата переводом уже учтена) */
  const paidOf = (b: Booking) => {
    const brief = paymentsQuery.data?.[b.id];
    return brief ? Math.max(0, b.total - brief.due) : 0;
  };

  const clientsById = useMemo(() => Object.fromEntries((clientsQuery.data ?? []).map((c) => [c.id, c])), [clientsQuery.data]);
  const bulkDeleteMutation = useApiMutation((input: { items: { id: string; status: Booking['status']; paidAmount: number }[]; authorName: string }) =>
    bulkDeleteBookings(input.items, input.authorName),
  );
  const importMutation = useApiMutation((rows: ImportRow[]) => importBookingRows(businessId!, activeLocationIds[0] ?? '', ownStaffId ?? '', rows));
  const exportMutation = useApiMutation((count: number) => exportBookingsToEmail(businessId!, ownStaffId ?? '', exportEmail, count));
  const externalMutation = useApiMutation(createExternalBooking);
  // F-01-121: восстановление удалённой записи (окно/занятость проверяет сам api, коды ошибок —
  // 'restore_expired' (срок вышел) и 'restore_slot_taken' (время заняли) — records.restoreErrors.*
  const restoreMutation = useApiMutation((id: string) => restoreDeletedBooking(id));
  const dataOpsLogQuery = useApiQuery(['journal', 'data-ops-log', ownStaffId], () => getDataOpsLog(ownStaffId ?? ''), {
    enabled: importOpen || exportOpen,
  });
  const staffById = useMemo(() => Object.fromEntries((staffQuery.data ?? []).map((s) => [s.id, s])), [staffQuery.data]);
  const servicesById = useMemo(() => Object.fromEntries((servicesQuery.data ?? []).map((s) => [s.id, s])), [servicesQuery.data]);

  const isLoading = bookingsQuery.isLoading || clientsQuery.isLoading || staffQuery.isLoading || servicesQuery.isLoading;
  const isError = bookingsQuery.isError || clientsQuery.isError || staffQuery.isError || servicesQuery.isError;

  // Первая загрузка — сама страница (DESIGN.md → «The skeleton IS the page»): шапка с кнопками, итоги StatCard
  // loading, фильтры, таблица со строками-скелетонами той же высоты; числа и строки — полосами
  const loading = !ready || isLoading || !journalRights.ready;
  if (!loading && isError) {
    return (
      <ErrorState
        onRetry={() => {
          bookingsQuery.refetch();
          clientsQuery.refetch();
          staffQuery.refetch();
          servicesQuery.refetch();
        }}
      />
    );
  }

  const allRaw = bookingsQuery.data ?? [];
  const all = allRaw.filter(
    (b) =>
      (canSeeOtherStaffRecords || b.staffId === ownStaffId) &&
      !isBeyondHistoryLimit(b.start.slice(0, 10), journalRights.historyLimit, todayIso),
  );
  const rows = all
    .filter((b) => {
      // F-01-181: «Удалённые» — только мягко удалённые (deletedAt), как в Altegio. «Отменённые» (01.10.2026) — ещё и
      // отменённые статусом («Отменил клиент/мастер»): иначе запись с «Верните клиенту …» не находилась никаким фильтром
      const isDeleted = Boolean(b.deletedAt);
      const isCancelled = isDeleted || b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master';
      if (cancelFilter === 'deleted' && !isDeleted) return false;
      if (cancelFilter === 'cancelled' && !isCancelled) return false;
      if (cancelFilter === 'notCancelled' && isCancelled) return false;
      if (sourceFilter !== 'all') {
        const isOnline = ONLINE_SOURCES.has(b.source);
        if (sourceFilter === 'online' && !isOnline) return false;
        if (sourceFilter === 'offline' && isOnline) return false;
      }
      if (paidFilter !== 'all') {
        const paidAmount = paidOf(b);
        const isPaid = paidAmount > 0 && paidAmount >= b.total;
        if (paidFilter === 'paid' && !isPaid) return false;
        if (paidFilter === 'unpaid' && isPaid) return false;
      }
      if (categoryFilter !== 'all') {
        const categoryIds = extrasQuery.data?.[b.id]?.categoryIds ?? [];
        if (!categoryIds.includes(categoryFilter)) return false;
      }
      if (resourceFilter !== 'all') {
        const resource = (resourcesQuery.data ?? []).find((r) => r.id === resourceFilter);
        const instanceIds = new Set(resource?.instances.map((i) => i.id) ?? []);
        if (!b.resourceIds.some((id) => instanceIds.has(id))) return false;
      }
      return true;
    })
    .sort((a, b) => b.start.localeCompare(a.start));

  // Сводка над таблицей (DESIGN.md «headline» карточки — крупное число): считается по уже
  // отфильтрованным `rows`, а не по всем записям бизнеса.
  const deletedCount = rows.filter((b) => b.deletedAt).length;
  const revenueTotal = rows.filter((b) => !b.deletedAt).reduce((sum, b) => sum + b.total, 0);
  const filtersActiveCount = [sourceFilter, paidFilter, categoryFilter, resourceFilter].filter((v) => v !== 'all').length;
  const resetFieldFilters = () => {
    setSourceFilter('all');
    setPaidFilter('all');
    setCategoryFilter('all');
    setResourceFilter('all');
  };

  const canDeleteRow = (b: Booking) =>
    !b.deletedAt &&
    b.status !== 'arrived' &&
    paidOf(b) <= 0 &&
    canDeleteBooking(b, paidOf(b), windowRights);

  const handleBulkDelete = async () => {
    const items = selectedIds
      .map((id) => all.find((b) => b.id === id))
      .filter((b): b is Booking => Boolean(b))
      .map((b) => ({ id: b.id, status: b.status, paidAmount: paidOf(b) }));
    const ok = await confirm({
      title: t('records.bulkDeleteConfirmTitle'),
      description: t('records.bulkDeleteConfirmText', { count: items.length }),
      tone: 'danger',
      confirmLabel: tc('actions.delete'),
    });
    if (!ok) return;
    const authorName = staffById[ownStaffId ?? '']?.name ?? t('window.deleteAuthorFallback');
    const result = await bulkDeleteMutation.mutate({ items, authorName });
    if (result.skippedIds.length > 0) toast.info(t('records.bulkDeleteSkipped', { count: result.skippedIds.length }));
    else toast.success(t('records.bulkDeleteDone', { count: result.deletedIds.length }));
    setSelectedIds([]);
    bookingsQuery.refetch();
  };

  // F-01-121: «Создать заново» с подставленными клиентом/мастером/услугами/временем — используется
  // и карандашом удалённой строки, и подтверждением «время занято» после неудачной попытки восстановить.
  const recreateFromBooking = (b: Booking) => {
    const serviceIds = b.services.map((s) => s.serviceId).join(',');
    const qs = new URLSearchParams({ new: '1', staff: b.staffId, start: b.start });
    if (b.clientId) qs.set('client', b.clientId);
    if (serviceIds) qs.set('services', serviceIds);
    toast.info(t('records.recreateToast'));
    openJournal(`/biz/journal?${qs.toString()}`);
  };

  const handleRestore = async (b: Booking) => {
    const authorName = staffById[ownStaffId ?? '']?.name ?? t('window.deleteAuthorFallback');
    try {
      await restoreMutation.mutate(b.id);
      await logBookingHistory(b.id, authorName, 'restored', t('records.historyRestored'));
      toast.success(t('records.restoreDone'));
      bookingsQuery.refetch();
      extrasQuery.refetch();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'failed';
      if (code === 'restore_slot_taken') {
        const ok = await confirm({
          title: t('records.restoreErrors.restore_slot_taken'),
          description: t('records.restoreSlotTakenConfirm'),
          confirmLabel: t('records.recreateRow'),
        });
        if (ok) recreateFromBooking(b);
        return;
      }
      toast.error(t(`records.restoreErrors.${code}` as never));
    }
  };

  const columns: TableColumn<Booking>[] = [
    {
      id: 'client',
      header: t('records.columns.client'),
      mobile: 'title',
      width: COL.client,
      skeleton: (
        <span className="flex flex-col">
          <span className="font-medium text-fg">
            <SkeletonText width="14ch" />
          </span>
          <span className="text-xs text-muted">
            <SkeletonText width="14ch" />
          </span>
        </span>
      ),
      cell: (b) => {
        const client = b.clientId ? clientsById[b.clientId] : undefined;
        const name = client?.name || b.visitorName || t('block.noClient');
        return (
          <span className="flex flex-col">
            {/* F-01-119: маркер для CSS `:has()` (records.module.css) — красит всю строку/карточку
                удалённой записи, не только этот текст; ничего не показывает и не читается вслух. */}
            {b.deletedAt && <span aria-hidden data-row-danger className="hidden" />}
            <span className={cn('max-w-44 truncate', b.deletedAt ? 'font-medium text-danger' : 'font-medium text-fg')}>
              {name}
            </span>
            {client?.phone && <span className={b.deletedAt ? 'text-xs text-danger/80' : 'text-xs text-muted'}>{journalRights.showPhones ? format.phone(client.phone) : maskPhone(client.phone)}</span>}
          </span>
        );
      },
    },
    {
      id: 'when',
      header: t('records.columns.when'),
      mobile: 'subtitle',
      sortValue: (b) => b.start,
      width: COL.when,
      skeletonWidth: '16ch',
      cell: (b) => (
        <span className={cn('whitespace-nowrap', b.deletedAt ? 'text-danger' : 'text-fg')}>
          {format.date(b.start.slice(0, 10), 'short')}, {format.time(b.start)}
        </span>
      ),
    },
    {
      id: 'staff',
      header: t('records.columns.staff'),
      mobile: 'meta',
      width: COL.staff,
      skeletonWidth: '13ch',
      cell: (b) => clip(COL.staff, staffById[b.staffId]?.name ?? '—'),
    },
    {
      id: 'service',
      header: t('records.columns.service'),
      mobile: 'meta',
      width: COL.service,
      skeletonWidth: '15ch',
      cell: (b) => {
        const svc = b.services[0] ? servicesById[b.services[0].serviceId] : undefined;
        return clip(COL.service, svc ? pickText(svc.name, locale) : t('block.noService'));
      },
    },
    {
      id: 'total',
      header: t('records.columns.total'),
      align: 'right',
      mobile: 'aside',
      sortValue: (b) => b.total,
      width: COL.total,
      skeletonWidth: '8ch',
      cell: (b) => <span className="whitespace-nowrap">{format.money(b.total)}</span>,
    },
    {
      id: 'creator',
      header: t('records.columns.creator'),
      mobile: 'meta',
      width: COL.creator,
      skeleton: (
        <span className="flex flex-col text-xs">
          <span className="text-sm text-fg">
            <SkeletonText width="12ch" />
          </span>
          <span className="text-muted">
            <SkeletonText width="16ch" />
          </span>
        </span>
      ),
      cell: (b) => {
        const label = b.createdBy === 'client' ? t('window.right.authorClient') : (staffById[b.createdBy]?.name ?? t('window.right.authorUnknown'));
        return (
          <span className="flex flex-col text-xs">
            <span className="truncate text-sm text-fg" style={{ maxWidth: fit(COL.creator) }}>
              {label}
            </span>
            <span className="whitespace-nowrap text-muted">
              {format.date(b.createdAt.slice(0, 10), 'short')}, {format.time(b.createdAt)}
            </span>
          </span>
        );
      },
    },
    {
      id: 'source',
      header: t('records.columns.source'),
      mobile: 'meta',
      width: COL.source,
      skeletonWidth: '10ch',
      cell: (b) => clip(COL.source, tc(`bookingSource.${b.source}`)),
    },
    {
      id: 'status',
      header: t('records.columns.status'),
      // Телефон: статус — полем карточки, а не значком рядом с именем: длинный значок («Клиент подтвердил») переносился
      // под имя, и высота карточки зависела от статуса (скелетон не мог её знать)
      mobile: 'meta',
      width: COL.status,
      skeleton: (
        <Badge tone="neutral" size="sm">
          <SkeletonText width="8ch" />
        </Badge>
      ),
      cell: (b) => {
        if (b.deletedAt) {
          const deletion = extrasQuery.data?.[b.id]?.deletion;
          const info = deletion
            ? deletion.byClient
              ? t('records.deletedByClient')
              : t('records.deletedBy', { name: deletion.byName, time: format.dateTime(deletion.at) })
            : undefined;
          return (
            <div data-f="F-01-119 F-01-120" className="flex flex-col gap-0.5">
              <Badge tone="danger" size="sm">
                {t('records.deletedBadge')}
              </Badge>
              {info && (
                <Tooltip content={info}>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Info aria-hidden className="size-3" />
                    <span className="max-w-40 truncate">{info}</span>
                  </span>
                </Tooltip>
              )}
            </div>
          );
        }
        return (
          <Badge tone={CANCELLED_STATUSES.has(b.status) ? 'neutral' : 'success'} size="sm">
            {tc(`bookingStatus.${b.status}`)}
          </Badge>
        );
      },
    },
    {
      id: 'edit',
      header: '',
      align: 'right',
      width: COL.edit,
      skeleton: <IconButton icon={<Pencil aria-hidden />} label={t('records.editRow')} size="sm" variant="ghost" disabled />,
      // Карточка на телефоне сама открывается нажатием (Table оборачивает её в <button> раз есть
      // onRowClick) — вложенный <button> карандаша внутри неё невалиден (React же и предупреждает:
      // «<button> cannot contain a nested <button>»); на телефоне карандаш просто не нужен.
      mobile: 'hidden',
      cell: (b) =>
        b.deletedAt ? (
          // F-01-121: «Восстановить» пробует вернуть запись целиком — api сам решает по сроку
          // (JournalSettings.deletionRestoreWindowDays) и по занятости времени, отказ показывает
          // почему и предлагает «Создать заново» (карандаш — тот же путь напрямую, без попытки).
          <div className="flex items-center justify-end gap-1">
            <IconButton
              data-f="F-01-121"
              icon={<RotateCcw aria-hidden />}
              label={t('records.restoreRow')}
              size="sm"
              variant="ghost"
              disabled={restoreMutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                handleRestore(b);
              }}
            />
            <IconButton
              data-f="F-01-121"
              icon={<Pencil aria-hidden />}
              label={t('records.recreateRow')}
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                recreateFromBooking(b);
              }}
            />
          </div>
        ) : (
          <IconButton
            data-f="F-01-181"
            icon={<Pencil aria-hidden />}
            label={t('records.editRow')}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              openJournal(`/biz/journal?booking=${b.id}`);
            }}
          />
        ),
    },
  ];

  return (
    <div data-f="F-01-181 F-01-219" className="flex flex-col gap-6">
      <PageHeader
        title={t('records.title')}
        description={t('records.subtitle')}
        actions={
          <div data-f="F-01-122 F-01-182 F-01-183" className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 && (
              <Button
                type="button"
                variant="danger"
                leftIcon={<Trash2 aria-hidden />}
                onClick={handleBulkDelete}
                loading={bulkDeleteMutation.isPending}
              >
                {t('records.bulkDelete', { count: selectedIds.length })}
              </Button>
            )}
            {(canImport || canExport) && (
              <DropdownMenu
                label={t('records.excelOps')}
                trigger={(p) => (
                  <Button {...p} type="button" variant="outline">
                    {t('records.excelOps')}
                  </Button>
                )}
                items={[
                  ...(canImport ? [{ id: 'import', label: t('records.uploadExcel'), onSelect: () => setImportOpen(true) }] : []),
                  ...(canExport ? [{ id: 'export', label: t('records.downloadExcel'), onSelect: () => setExportOpen(true) }] : []),
                ]}
              />
            )}
            {canCreateAny && (
              <Button
                data-f="F-01-036 F-13-108"
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setExternalError(null);
                  setExternalOpen(true);
                }}
              >
                {t('records.externalDemo.button')}
              </Button>
            )}
          </div>
        }
      />

      {/* Телефон: выручка — во всю ширину сверху, «Показано» и «Удалено» — парой под ней (три плитки столбиком занимали экран) */}
      <div className={cn('grid grid-cols-2 gap-3', journalRights.showStatistics ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        <StatCard label={t('records.stats.count')} value={format.number(rows.length)} loading={loading} />
        {/* F-01-178 «Показывать статистику»: без права — без выручки */}
        {journalRights.showStatistics && <StatCard className="max-sm:order-first max-sm:col-span-2" label={t('records.stats.revenue')} value={format.money(revenueTotal)} loading={loading} />}
        <StatCard label={t('records.stats.deleted')} value={format.number(deletedCount)} loading={loading} />
      </div>

      <div className="flex flex-col gap-3">
        <SegmentedControl
          value={cancelFilter}
          onValueChange={(v) => setCancelFilter(v as CancelFilter)}
          options={[
            { value: 'all', label: t('records.filter.all') },
            { value: 'notCancelled', label: t('records.filter.notCancelled') },
            { value: 'cancelled', label: t('records.filter.cancelled') },
            { value: 'deleted', label: t('records.filter.deletedOnly') },
          ]}
        />
        <div data-f="F-01-181">
          <FilterBar
            activeCount={filtersActiveCount}
            onReset={resetFieldFilters}
            filters={[
              {
                id: 'source',
                label: t('records.filter.sourceLabel'),
                node: (
                  <Select
                    aria-label={t('records.filter.sourceLabel')}
                    value={sourceFilter}
                    onValueChange={(v) => setSourceFilter(v as SourceFilter)}
                    options={[
                      { value: 'all', label: t('records.filter.sourceAll') },
                      { value: 'online', label: t('records.filter.sourceOnline') },
                      { value: 'offline', label: t('records.filter.sourceOffline') },
                    ]}
                  />
                ),
              },
              {
                id: 'paid',
                label: t('records.filter.paidLabel'),
                node: (
                  <Select
                    aria-label={t('records.filter.paidLabel')}
                    value={paidFilter}
                    onValueChange={(v) => setPaidFilter(v as PaidFilter)}
                    options={[
                      { value: 'all', label: t('records.filter.paidAll') },
                      { value: 'paid', label: t('records.filter.paidFull') },
                      { value: 'unpaid', label: t('records.filter.unpaid') },
                    ]}
                  />
                ),
              },
              {
                id: 'category',
                label: t('records.filter.categoryLabel'),
                node: (
                  <Select
                    aria-label={t('records.filter.categoryLabel')}
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                    options={[
                      { value: 'all', label: t('records.filter.categoryAll') },
                      ...(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: bookingCategoryLabel(t, c) })),
                    ]}
                  />
                ),
              },
              ...((resourcesQuery.data ?? []).length > 0
                ? [
                    {
                      id: 'resource',
                      label: t('records.filter.resourceLabel'),
                      node: (
                        <Select
                          data-f="F-16-025"
                          aria-label={t('records.filter.resourceLabel')}
                          value={resourceFilter}
                          onValueChange={setResourceFilter}
                          options={[
                            { value: 'all', label: t('records.filter.resourceAll') },
                            ...(resourcesQuery.data ?? []).map((r) => ({ value: r.id, label: pickText(r.name, locale) })),
                          ]}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>

      <Table
        className={styles.table}
        label={t('records.title')}
        columns={columns}
        // Постранично (owner 29.09.2026: «почему вся дата сразу грузится») — встроенный вывод Table: 10 на странице,
        // выбор 10/20/50/100, а не все ~2000 записей за полтора года разом
        rows={rows}
        defaultSort={{ columnId: 'when', dir: 'desc' }}
        rowKey={(b) => b.id}
        loading={loading}
        loadingRows={10}
        // ux-r5.md №3: строка (и карточка на телефоне) сама открывает запись — раньше работал
        // только маленький карандаш, хотя это единственное, зачем на этот экран заходят.
        onRowClick={(b) => {
          if (b.deletedAt) {
            const serviceIds = b.services.map((s) => s.serviceId).join(',');
            const qs = new URLSearchParams({ new: '1', staff: b.staffId, start: b.start });
            if (b.clientId) qs.set('client', b.clientId);
            if (serviceIds) qs.set('services', serviceIds);
            openJournal(`/biz/journal?${qs.toString()}`);
            return;
          }
          openJournal(`/biz/journal?booking=${b.id}`);
        }}
        selectable={windowRights.deleteBookings}
        selected={selectedIds}
        onSelectedChange={(ids) => setSelectedIds(ids.filter((id) => canDeleteRow(all.find((b) => b.id === id)!)))}
        empty={
          cancelFilter === 'all' && filtersActiveCount === 0 ? (
            <EmptyState icon={<Ban aria-hidden />} title={t('records.emptyTitle')} description={t('records.emptyText')} />
          ) : (
            <EmptyState
              kind="search"
              onReset={() => {
                setCancelFilter('all');
                resetFieldFilters();
              }}
            />
          )
        }
      />

      <Modal open={importOpen} onOpenChange={setImportOpen} title={t('records.importModal.title')} size="md">
        <div data-f="F-01-182 F-07-180 F-04-131" className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('records.importModal.help')}</p>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder="04.01.2022 10:30;+37493350369;Тест Тестов;Стрижка;15000;0;пришел"
          />
          {importResult && (
            <p className="text-sm text-fg">
              {t('records.importModal.result', { created: importResult.createdCount, errors: importResult.errorCount })}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              {tc('actions.close')}
            </Button>
            <Button
              type="button"
              loading={importMutation.isPending}
              onClick={async () => {
                const rows: ImportRow[] = importText
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => {
                    const [dateTime, clientPhone, clientName, serviceName, price, discountPct, statusRaw] = line.split(';').map((x) => x.trim());
                    return {
                      dateTime,
                      staffId: staffQuery.data?.[0]?.id ?? '',
                      clientPhone,
                      clientName,
                      serviceName: serviceName || t('records.importModal.defaultService'),
                      price: Number(price) || 0,
                      discountPct: Number(discountPct) || 0,
                      statusRaw: statusRaw || '0',
                    };
                  });
                const result = await importMutation.mutate(rows);
                setImportResult(result);
                bookingsQuery.refetch();
              }}
            >
              {t('records.importModal.submit')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={exportOpen} onOpenChange={setExportOpen} title={t('records.exportModal.title')} size="sm">
        <div data-f="F-01-183" className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('records.exportModal.help', { count: rows.length })}</p>
          <Input
            type="email"
            value={exportEmail}
            onChange={(e) => setExportEmail(e.target.value)}
            placeholder={t('records.exportModal.emailPlaceholder')}
          />
          {dataOpsLogQuery.data && dataOpsLogQuery.data.length > 0 && (
            <div className="flex flex-col gap-1 text-xs text-muted">
              <p className="font-medium text-fg">{t('records.exportModal.logTitle')}</p>
              {dataOpsLogQuery.data.slice(0, 5).map((e) => (
                <p key={e.id}>
                  {format.date(e.at.slice(0, 10), 'short')}, {format.time(e.at)} — {t(`records.exportModal.logKind.${e.kind}` as never)} ({e.count})
                </p>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={() => setExportOpen(false)}>
              {tc('actions.close')}
            </Button>
            <Button
              type="button"
              disabled={!exportEmail}
              loading={exportMutation.isPending}
              onClick={async () => {
                await exportMutation.mutate(rows.length);
                toast.success(t('records.exportModal.sentToast', { email: exportEmail }));
                setExportOpen(false);
              }}
            >
              {t('records.exportModal.submit')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={externalOpen}
        onOpenChange={setExternalOpen}
        title={t('records.externalDemo.title')}
        description={t('records.externalDemo.hint')}
        size="sm"
      >
        <div data-f="F-01-036" className="flex flex-col gap-3">
          <FormField label={t('records.externalDemo.name')}>
            <Input value={externalName} onChange={(e) => setExternalName(e.target.value)} placeholder={t('records.externalDemo.namePlaceholder')} />
          </FormField>
          <FormField label={t('window.phone')} error={externalError === 'phone_required' ? t('records.externalDemo.phoneRequired') : undefined}>
            <PhoneInput value={externalPhone} onValueChange={setExternalPhone} />
          </FormField>
          <FormField label={t('records.columns.service')}>
            <Select
              value={externalServiceId}
              onValueChange={setExternalServiceId}
              placeholder={t('records.externalDemo.servicePlaceholder')}
              options={(servicesQuery.data ?? []).map((s) => ({ value: s.id, label: pickText(s.name, locale) }))}
            />
          </FormField>
          <FormField label={t('records.columns.staff')}>
            <Select
              value={externalStaffId}
              onValueChange={setExternalStaffId}
              placeholder={t('records.externalDemo.anyFreeStaff')}
              options={(staffQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          </FormField>
          <div className="flex gap-2">
            <FormField label={t('records.externalDemo.date')} className="flex-1">
              <DatePicker value={externalDate} onValueChange={(d) => d && setExternalDate(d)} />
            </FormField>
            <FormField label={t('records.externalDemo.time')} className="flex-1">
              <TimePicker value={externalTime} onValueChange={setExternalTime} />
            </FormField>
          </div>
          {externalError && externalError !== 'phone_required' && (
            <p className="text-sm text-danger">{t(`records.externalDemo.errors.${externalError}` as never)}</p>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={() => setExternalOpen(false)}>
              {tc('actions.close')}
            </Button>
            <Button
              type="button"
              loading={externalMutation.isPending}
              disabled={!externalName.trim() || !externalServiceId}
              onClick={async () => {
                if (!businessId) return;
                setExternalError(null);
                try {
                  const booking = await externalMutation.mutate({
                    businessId,
                    locationId: activeLocationIds[0],
                    name: externalName,
                    phone: externalPhone,
                    serviceId: externalServiceId,
                    staffId: externalStaffId || undefined,
                    start: combine(externalDate, externalTime),
                  });
                  toast.success(t('records.externalDemo.createdToast'));
                  setExternalOpen(false);
                  setExternalName('');
                  setExternalPhone('');
                  setExternalServiceId('');
                  setExternalStaffId('');
                  bookingsQuery.refetch();
                  openJournal(`/biz/journal?booking=${booking.id}`);
                } catch (e) {
                  setExternalError(e instanceof ApiError ? e.code : 'failed');
                }
              }}
            >
              {t('records.externalDemo.submit')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
