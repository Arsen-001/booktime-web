'use client';

/**
 * Экран «График работы»: таблица «Сотрудники × дни» (F-02-002), фильтры (F-02-003), вид (F-02-004),
 * панель настройки (F-02-005…015), правка поверх записей (F-02-106), массовая установка по датам (F-02-032).
 * Шапка → строка периода → фильтры → таблица → легенда; главное действие одно — «Настроить график» (§0).
 * Г4: клетки выбираются протягиванием, Shift, по дате и по имени; шторка открывается кнопкой «Настроить (N)» и не
 * закрывает выбор. М1: при смене недели/месяца прежняя таблица стоит как есть, пока не пришла новая.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, CalendarCog, Plane, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { Id, ISODate, Staff } from '@/domain/core';
import type { ScheduleFilters } from '@/domain/schedule';
import { activeFilterCount, DEFAULT_FILTERS, DEFAULT_VIEW_CONFIG } from '@/domain/schedule';
import { useCoreList } from '@/api/core';
import { prefetchApiQuery, useApiMutation, useApiQuery } from '@/api/request';
import {
  addWorkDayWithUndo,
  deleteCellsWithUndo,
  getFilters,
  getHistoryLimitDays,
  getPlanningPeriodYears,
  getScheduleTable,
  getViewConfig,
  isDateBeyondHistoryLimit,
  planningHorizonEnd,
  setFilters,
  setViewConfig,
  type PlanEntry,
} from '@/api/schedule';
import { AbsenceModal } from '@/areas/schedule/components/AbsenceModal';
import { CopyScheduleModal } from '@/areas/schedule/components/CopyScheduleModal';
import { PdfExportModal } from '@/areas/schedule/components/PdfExportModal';
import { RepeatWeekModal } from '@/areas/schedule/components/RepeatWeekModal';
import type { CellPreview } from '@/areas/schedule/components/ScheduleCellView';
import { ScheduleFiltersBar } from '@/areas/schedule/components/ScheduleFiltersBar';
import { ScheduleGrid } from '@/areas/schedule/components/ScheduleGrid';
import { ScheduleLegend } from '@/areas/schedule/components/ScheduleLegend';
import { ScheduleMoreMenu } from '@/areas/schedule/components/ScheduleMoreMenu';
import { SchedulePanel, type SelectedCell } from '@/areas/schedule/components/SchedulePanel';
import { useActorName } from '@/areas/schedule/lib/actor';
import { useCustomDayTypes } from '@/areas/schedule/lib/customDayTypes';
import { datesOf, rangeFor, shift, type ScheduleView } from '@/areas/schedule/lib/grid';
import { useSkeletonShape } from '@/areas/schedule/lib/useSkeletonShape';
import type { CellRef, SelectOp } from '@/areas/schedule/lib/useGridSelection';
import { useUndoToast } from '@/areas/schedule/lib/useUndoToast';
import { useCan, useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { addDays, today, weekStart } from '@/lib/date';
import { BulkActionBar } from '@/ui/BulkActionBar';
import { Button, LinkButton } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { PeriodNav } from '@/ui/PeriodNav';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { EmptyStateHint } from '@/ui/onboarding/EmptyStateHint';
import { useConfirm, useToast } from '@/ui/Toast';

const cellKey = (c: SelectedCell) => `${c.staffId}|${c.date}`;
/** Ширина боковой шторки настройки (Sheet size="md" = 30rem) — таблица отступает, чтобы выбор был виден (Г4) */
const SHEET_PX = 480;

type Overlay =
  | { kind: 'copy'; staff: Staff }
  | { kind: 'repeat'; staffIds: Id[]; who: string }
  | { kind: 'absence'; staffIds: Id[]; who: string; from: ISODate; to: ISODate }
  | { kind: 'holiday'; staffIds: Id[] };

export function ScheduleScreen() {
  const t = useT('schedule');
  const format = useFormat();
  const locale = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const undoToast = useUndoToast();
  const { ready, businessId, staffId: ownStaffId, activeLocationIds } = useCurrent();
  const customDayTypes = useCustomDayTypes(businessId);
  const canEdit = useCan('schedule.edit');
  // Чужие графики видит тот, у кого есть право на чужие записи; остальные (мастер) — только себя (arch-a1 №3)
  const canOthers = useCan('journal.others');
  const restrictedToSelf = !canOthers;
  // Кто ведёт график (владелец, администратор, индивидуал) — панель «Настроить график»; мастер салона — свой календарь
  const canSeeStaff = useCan('staff.view');
  const managesSchedule = canEdit && canSeeStaff;
  const actorName = useActorName();

  const [view, setView] = useState<ScheduleView>('week');
  const [anchor, setAnchor] = useState<ISODate>(today());
  const [selected, setSelected] = useState<SelectedCell[]>([]);
  const [preview, setPreview] = useState<PlanEntry[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelKey, setPanelKey] = useState(0);
  const [panelStaff, setPanelStaff] = useState<Id[]>([]);
  // М3: окна остаются смонтированными и закрываются анимацией; данные окна живут до следующего открытия
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayKey, setOverlayKey] = useState(0);
  const [pdfOpen, setPdfOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridPad, setGridPad] = useState(0);

  const enabled = ready && Boolean(businessId);
  const { from, to } = rangeFor(view, anchor);

  const filtersQuery = useApiQuery(['schedule', 'filters', businessId], () => getFilters(businessId ?? ''), { enabled });
  const filters = filtersQuery.data ?? DEFAULT_FILTERS;
  const saveFilters = useApiMutation((next: ScheduleFilters) => setFilters(businessId ?? '', next));
  const viewConfigQuery = useApiQuery(['schedule', 'viewConfig', businessId], () => getViewConfig(businessId ?? ''), { enabled });
  const viewConfig = viewConfigQuery.data ?? DEFAULT_VIEW_CONFIG;
  const saveViewConfig = useApiMutation((cfg: typeof viewConfig) => setViewConfig(businessId ?? '', cfg));

  const staffAllQuery = useCoreList('staff', { businessId: businessId ?? '' }, { enabled });
  const servicesQuery = useCoreList('services', { businessId: businessId ?? '' }, { enabled });
  const categoriesQuery = useCoreList('serviceCategories', { businessId: businessId ?? '' }, { enabled });
  // Г6: филиалы из переключателя в шапке — в сети они бывают и у соседнего бизнеса (мастер двух салонов)
  const locationsQuery = useCoreList('locations', undefined, { enabled });
  const staffHere = useMemo(
    () => (staffAllQuery.data ?? []).filter((s) => s.locationIds.some((l) => activeLocationIds.includes(l))),
    [staffAllQuery.data, activeLocationIds],
  );
  // Г6: правка идёт в выбранный филиал; при «Все филиалы» — выбор в шторке
  const editLocationId = activeLocationIds.length === 1 ? activeLocationIds[0] : undefined;
  const locations = useMemo(
    () => (locationsQuery.data ?? []).filter((l) => activeLocationIds.includes(l.id)).map((l) => ({ id: l.id, name: pickText(l.name, locale) })),
    [locationsQuery.data, activeLocationIds, locale],
  );
  const locationLabel = (id: Id | undefined) => {
    if (!id || locations.length < 2) return undefined;
    return locations.find((l) => l.id === id)?.name.slice(0, 2);
  };

  const planningPeriodQuery = useApiQuery(['schedule', 'planning-period', businessId], () => getPlanningPeriodYears(businessId ?? ''), { enabled });
  const horizonEnd = planningPeriodQuery.data ? planningHorizonEnd(planningPeriodQuery.data) : undefined;
  // F-02-085: «Ограничить доступ к истории расписания» — для самого сотрудника
  const historyLimitQuery = useApiQuery(['schedule', 'history-limit', ownStaffId], () => getHistoryLimitDays(ownStaffId ?? ''), {
    enabled: ready && Boolean(ownStaffId) && restrictedToSelf,
  });
  const historyMin = restrictedToSelf && historyLimitQuery.data !== undefined ? addDays(today(), -historyLimitQuery.data) : undefined;
  const beyondHistoryLimit = restrictedToSelf && isDateBeyondHistoryLimit(from, historyLimitQuery.data);

  const effectiveFilters = restrictedToSelf && ownStaffId ? { ...filters, staffIds: [ownStaffId] } : filters;
  const filterCount = restrictedToSelf ? 0 : activeFilterCount(filters);

  const tableKey = (f: ISODate, tt: ISODate) => ['schedule', 'table', businessId, activeLocationIds.join(','), f, tt, effectiveFilters] as const;
  const loadTable = (f: ISODate, tt: ISODate) => () =>
    getScheduleTable({ businessId: businessId ?? '', locationIds: activeLocationIds, from: f, to: tt, filters: effectiveFilters });
  const tableQuery = useApiQuery(tableKey(from, to), loadTable(from, to), { enabled: enabled && activeLocationIds.length > 0 });
  const rows = tableQuery.data ?? [];
  // М1: пока грузится новый период, на экране прежняя таблица со СВОИМИ датами (не новые даты над старыми клетками)
  const dates = useMemo(() => {
    const fromData = tableQuery.data?.[0]?.cells.map((c) => c.date);
    return fromData?.length ? fromData : datesOf(view, anchor);
  }, [tableQuery.data, view, anchor]);
  const shownView: ScheduleView = dates.length > 7 ? 'month' : 'week';

  // М1: соседний период — заранее в кэш, «‹ ›» листают без ожидания
  const prefetchKey = `${view}|${from}|${enabled}|${activeLocationIds.join(',')}|${JSON.stringify(effectiveFilters)}`;
  useEffect(() => {
    if (!enabled || activeLocationIds.length === 0) return;
    const id = window.setTimeout(() => {
      for (const dir of [1, -1] as const) {
        const r = rangeFor(view, shift(view, anchor, dir));
        prefetchApiQuery(tableKey(r.from, r.to), loadTable(r.from, r.to));
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [prefetchKey]);

  const skeleton = useSkeletonShape(businessId, staffHere, rows, tableQuery.isLoading);

  const addTomorrow = useApiMutation((staffId: Id) => addWorkDayWithUndo(staffId, addDays(today(), 1), actorName));
  const bulkDelete = useApiMutation(deleteCellsWithUndo);

  const positions = useMemo(() => {
    const set = new Map<string, string>();
    for (const s of staffHere) if (s.position) set.set(s.position.ru, pickText(s.position, locale));
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [staffHere, locale]);

  const specializations = useMemo(() => {
    const categoryOfService = new Map((servicesQuery.data ?? []).map((sv) => [sv.id, sv.categoryId]));
    const used = new Set<string>();
    for (const s of staffHere)
      for (const id of s.serviceIds) {
        const catId = categoryOfService.get(id);
        if (catId) used.add(catId);
      }
    return (categoriesQuery.data ?? []).filter((c) => used.has(c.id)).map((c) => ({ value: c.id, label: pickText(c.name, locale) }));
  }, [staffHere, servicesQuery.data, categoriesQuery.data, locale]);

  const selectedKeys = useMemo(() => new Set(selected.map(cellKey)), [selected]);
  const previewMap = useMemo(() => {
    const map = new Map<string, CellPreview>();
    for (const e of preview) map.set(`${e.staffId}|${e.date}`, e.hours ? 'work' : 'off');
    return map;
  }, [preview]);
  const staffIdsSelected = useMemo(() => Array.from(new Set(selected.map((c) => c.staffId))), [selected]);
  const datesSelected = useMemo(() => Array.from(new Set(selected.map((c) => c.date))).sort(), [selected]);

  // Г4: шторка справа не закрывает выбор — таблица отступает на ширину шторки, пока та открыта (только десктоп)
  useEffect(() => {
    const el = gridRef.current;
    if (!panelOpen || !el || window.innerWidth < 768) {
      setGridPad(0);
      return;
    }
    const right = el.getBoundingClientRect().right;
    setGridPad(Math.max(0, Math.round(right - (window.innerWidth - SHEET_PX) + 16)));
  }, [panelOpen]);

  const openPanel = (staffIds: Id[] = []) => {
    setPanelStaff(staffIds);
    setPanelKey((k) => k + 1);
    setPanelOpen(true);
  };
  const openOverlay = (next: Overlay) => {
    setOverlay(next);
    setOverlayKey((k) => k + 1);
    setOverlayOpen(true);
  };

  const onSelect = (cells: CellRef[], op: SelectOp) => {
    setSelected((prev) => {
      const keys = new Set(prev.map(cellKey));
      if (op === 'toggle') {
        const k = cellKey(cells[0]);
        return keys.has(k) ? prev.filter((c) => cellKey(c) !== k) : [...prev, cells[0]];
      }
      if (op === 'remove') {
        const drop = new Set(cells.map(cellKey));
        return prev.filter((c) => !drop.has(cellKey(c)));
      }
      return [...prev, ...cells.filter((c) => !keys.has(cellKey(c)))];
    });
  };
  // Мастер правит свой день в «Моём календаре», а не в панели администратора (speed-k3 №5)
  const onOpenDay = (_staffId: Id, date: ISODate) => router.push(`/biz/schedule/calendar?date=${date}`);

  const updatePreview = (next: PlanEntry[]) => setPreview((prev) => (prev.length === 0 && next.length === 0 ? prev : next));

  const clearSelection = () => {
    setSelected([]);
    setPreview([]);
  };

  const doBulkDelete = async () => {
    if (selected.length === 0) return;
    const input = { staffIds: staffIdsSelected, dates: datesSelected, actorName, locationId: editLocationId };
    try {
      let result = await bulkDelete.mutate(input);
      if (!result.ok) {
        const ok = await confirm({
          title: t('table.deleteWithBookingsTitle', { n: result.affected.length }),
          description: t('table.deleteWithBookingsText'),
          confirmLabel: t('table.deleteAnyway'),
          tone: 'danger',
        });
        if (!ok) return;
        result = await bulkDelete.mutate({ ...input, force: true });
      }
      if (result.ok) undoToast(t('panel.removedDays', { n: result.changedDays }), result.before);
      setPanelOpen(false);
      clearSelection();
    } catch {
      toast.error(t('panel.saveFailed'));
    }
  };

  const doAddTomorrow = async (staffId: Id) => {
    try {
      const result = await addTomorrow.mutate(staffId);
      const name = staffHere.find((s) => s.id === staffId)?.name ?? '';
      undoToast(
        t('table.addedTomorrow', {
          name,
          day: format.date(addDays(today(), 1), 'weekday'),
          hours: `${result.hours[0].from}–${result.hours[result.hours.length - 1].to}`,
        }),
        result.before,
      );
    } catch {
      toast.error(t('panel.saveFailed'));
    }
  };

  const nameOf = (id: Id) => staffHere.find((s) => s.id === id)?.name ?? '';
  const whoOf = (ids: Id[]) => (ids.length === 1 ? nameOf(ids[0]) : t('panel.staffCount', { n: ids.length }));
  const scheduledIds = rows.filter((r) => r.totalDays > 0).map((r) => r.staff.id);

  const noStaffAtAll = staffHere.length === 0 && !staffAllQuery.isLoading;
  const nobodyScheduled = rows.length > 0 && filterCount === 0 && rows.every((r) => r.totalDays === 0);
  // Первая загрузка: «Фильтры» уже на месте (у типичного салона мастеров больше одного) — ряд не вырастает после данных
  const tableLoading = tableQuery.isLoading || !ready;
  const showFilters = !restrictedToSelf && (staffAllQuery.isLoading || !ready || staffHere.length > 1 || filterCount > 0);

  const header = (
    <PageHeader
      title={t('title')}
      description={managesSchedule ? t('table.hint') : t('table.hintSelf')}
      actions={
        <div className="flex items-center gap-2">
          {!managesSchedule ? (
            <LinkButton href="/biz/schedule/calendar" leftIcon={<CalendarCheck aria-hidden />}>
              {t('nav.calendar')}
            </LinkButton>
          ) : (
            canEdit && (
              <Button leftIcon={<CalendarCog aria-hidden />} onClick={() => openPanel()} data-f="F-02-005">
                {t('table.configure')}
              </Button>
            )
          )}
          {!restrictedToSelf && (
            <ScheduleMoreMenu
              config={viewConfig}
              canConfigure={canEdit}
              canExport={rows.some((r) => r.totalDays > 0)}
              onExport={() => setPdfOpen(true)}
              onChange={(cfg) => void saveViewConfig.mutate(cfg).catch(() => toast.error(t('panel.saveFailed')))}
              onRepeatWeek={
                managesSchedule && scheduledIds.length > 0 ? () => openOverlay({ kind: 'repeat', staffIds: scheduledIds, who: t('repeat.whoAll') }) : undefined
              }
              onHoliday={managesSchedule && rows.length > 0 ? () => openOverlay({ kind: 'holiday', staffIds: rows.map((r) => r.staff.id) }) : undefined}
            />
          )}
        </div>
      }
    />
  );

  return (
    <div className="flex flex-col gap-6" data-f="F-02-085 F-02-086 F-00-198">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* Телефон: неделя на стыке месяцев («28 сентября – 4 октября») не влезала, и «›» уходила одна на новую строку */}
          <PeriodNav unit={view} value={anchor} onValueChange={setAnchor} min={historyMin} max={horizonEnd} className="max-sm:w-full max-sm:flex-nowrap" />
          <SegmentedControl
            size="sm"
            value={view}
            onValueChange={(v) => setView(v as ScheduleView)}
            options={[
              { value: 'week', label: t('table.viewWeek') },
              { value: 'month', label: t('table.viewMonth') },
            ]}
          />
        </div>
        {showFilters && (
          <ScheduleFiltersBar
            filters={filters}
            onChange={(next) => void saveFilters.mutate(next).catch(() => toast.error(t('panel.saveFailed')))}
            positions={positions}
            specializations={specializations}
          />
        )}
      </div>
      {beyondHistoryLimit && <p className="text-sm text-muted">{t('table.beyondHistoryLimit')}</p>}

      {nobodyScheduled && canEdit ? (
        // Первый вход: ни у кого нет графика — вместо семи прочерков одно действие (onboarding-k4 №1, empty-d1 №1)
        <EmptyStateHint
          icon={<CalendarCog aria-hidden />}
          title={t('table.noHoursTitle')}
          description={t('table.noHoursText')}
          steps={[t('templatesPage.step1'), t('templatesPage.step2'), t('table.noHoursStep3')]}
          action={
            <Button leftIcon={<CalendarCog aria-hidden />} onClick={() => openPanel(rows.map((r) => r.staff.id))}>
              {t('table.noHoursAction')}
            </Button>
          }
        />
      ) : null}

      <div ref={gridRef} className="transition-[padding] duration-200" style={gridPad ? { paddingRight: gridPad } : undefined}>
        {tableQuery.isError ? (
          <ErrorState onRetry={() => tableQuery.refetch()} />
        ) : nobodyScheduled && canEdit ? null : (
          <ScheduleGrid
            rows={rows}
            dates={dates}
            view={shownView}
            showTotals={viewConfig.showShiftTotals}
            showHeadcount={viewConfig.showHeadcount && !restrictedToSelf}
            selected={selectedKeys}
            preview={previewMap}
            interactive={canEdit}
            manages={managesSchedule}
            canEdit={canEdit && !restrictedToSelf}
            onSelect={onSelect}
            onOpenDay={onOpenDay}
            onCopy={(staffId) => {
              const staff = staffHere.find((s) => s.id === staffId);
              if (staff) openOverlay({ kind: 'copy', staff });
            }}
            onAddTomorrow={doAddTomorrow}
            onRepeatWeek={(staffId) => openOverlay({ kind: 'repeat', staffIds: [staffId], who: nameOf(staffId) })}
            customTypes={customDayTypes}
            loading={tableLoading}
            skeletonRows={skeleton.rows}
            skeletonIdleToggle={skeleton.idleToggle}
            refreshing={tableQuery.isPlaceholderData}
            locationLabel={locationLabel}
            emptyTitle={filterCount > 0 ? t('table.emptyFilteredTitle') : noStaffAtAll ? t('table.emptyNoStaffTitle') : t('table.emptyTitle')}
            emptyText={filterCount > 0 ? t('table.emptyFilteredText') : noStaffAtAll ? t('table.emptyNoStaffText') : t('table.emptyText')}
            emptyKind={filterCount > 0 ? 'search' : 'default'}
            onResetFilters={() => void saveFilters.mutate(DEFAULT_FILTERS).catch(() => toast.error(t('panel.saveFailed')))}
            emptyAction={
              filterCount === 0 && noStaffAtAll ? (
                <LinkButton href="/biz/staff" size="sm">
                  {t('table.addStaff')}
                </LinkButton>
              ) : undefined
            }
          />
        )}
      </div>

      {(tableLoading || rows.length > 0) && !tableQuery.isError && !nobodyScheduled && <ScheduleLegend rows={rows} loading={tableLoading} />}

      <BulkActionBar
        count={selected.length}
        // Шторка настройки на десктопе справа (30rem) — полоса выбора сдвигается влево, чтобы её «×» не пряталась под шторкой
        className={panelOpen ? 'md:-translate-x-60' : undefined}
        onClear={() => {
          setPanelOpen(false);
          clearSelection();
        }}
        actions={
          <>
            {!panelOpen && (
              <Button size="sm" onClick={() => openPanel()} data-f="F-02-032 F-02-034 F-14-110 F-14-112">
                {t('table.configureSelectedN', { n: selected.length })}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-bg hover:bg-bg/15"
              leftIcon={<Plane aria-hidden />}
              onClick={() =>
                openOverlay({ kind: 'absence', staffIds: staffIdsSelected, who: whoOf(staffIdsSelected), from: datesSelected[0], to: datesSelected[datesSelected.length - 1] })
              }
              data-f="F-02-010"
            >
              <span className="max-sm:sr-only">{t('absence.short')}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-bg hover:bg-bg/15"
              leftIcon={<Trash2 aria-hidden />}
              loading={bulkDelete.isPending}
              onClick={doBulkDelete}
              data-f="F-02-014"
            >
              <span className="max-sm:sr-only">{t('table.delete')}</span>
            </Button>
          </>
        }
      />

      {businessId && (
        <SchedulePanel
          // Префиксы: счётчики панели и окон оба начинаются с 0 — без них у соседей совпадал ключ «1»
          key={`panel-${panelKey}`}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          businessId={businessId}
          selected={selected}
          rows={rows}
          actorName={actorName}
          onSaved={clearSelection}
          onPreviewChange={updatePreview}
          defaultStaffIds={panelStaff}
          customTypes={customDayTypes}
          locations={locations}
          defaultLocationId={editLocationId ?? locations[0]?.id}
        />
      )}

      {overlay?.kind === 'copy' && (
        <CopyScheduleModal
          key={`overlay-${overlayKey}`}
          open={overlayOpen}
          onOpenChange={setOverlayOpen}
          fromStaff={overlay.staff}
          staffList={staffHere.filter((s) => s.status !== 'fired')}
          actorName={actorName}
          locationId={editLocationId}
        />
      )}
      {overlay?.kind === 'repeat' && (
        <RepeatWeekModal
          key={`overlay-${overlayKey}`}
          open={overlayOpen}
          onOpenChange={setOverlayOpen}
          staffIds={overlay.staffIds}
          whoLabel={overlay.who}
          weekStart={weekStart(anchor)}
          locationId={editLocationId}
          actorName={actorName}
          onPreviewChange={updatePreview}
        />
      )}
      {(overlay?.kind === 'absence' || overlay?.kind === 'holiday') && (
        <AbsenceModal
          key={`overlay-${overlayKey}`}
          open={overlayOpen}
          onOpenChange={setOverlayOpen}
          kind={overlay.kind}
          staffIds={overlay.staffIds}
          whoLabel={overlay.kind === 'absence' ? overlay.who : undefined}
          initialFrom={overlay.kind === 'absence' ? overlay.from : undefined}
          initialTo={overlay.kind === 'absence' ? overlay.to : undefined}
          locationId={editLocationId}
          actorName={actorName}
          customTypes={customDayTypes}
          onSaved={clearSelection}
        />
      )}

      <PdfExportModal open={pdfOpen} onOpenChange={setPdfOpen} rows={rows} from={from} to={to} positions={positions} />
    </div>
  );
}
