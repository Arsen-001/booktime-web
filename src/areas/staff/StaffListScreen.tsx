"use client";

/**
 * /biz/staff — «Сотрудники» (F-10-001…018, F-10-022, F-10-023, F-10-110, F-10-112, F-10-113, F-10-132).
 * Обзор 27.09.2026:
 *  - «Работают» — одна таблица с должностями-разделителями и колонками «График» / «Услуги» (С7, С8);
 *  - порядок мастеров меняется перетаскиванием прямо в ней, весь порядок — одним запросом, кэш правится сразу (С1);
 *  - «Архив» — уволенные и удалённые, вернуть в любой момент; «Удалить навсегда» — только там (С3, С4);
 *  - поиск и фильтры прячут строки на месте, таблица не пересоздаётся (М6); чтение одно — все сотрудники бизнеса;
 *  - телефон: вкладки — выпадающим списком, у строки то же меню «⋯», «+» — «Сотрудника / Должность / Лицензия» (С6).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { BadgeCheck, ListPlus, Plus, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import {
  applyDueDismissals,
  listPositions,
  listStaffRows,
  moveStaff,
  resendInviteForStaff,
  restoreDeletedStaff,
  restoreStaff,
  revokeAccess,
  setOnlineBookingEnabled,
  type MoveStaffInput,
  type StaffListRow,
} from "@/api/staff";
import { useCoreGet } from "@/api/core";
import { optimistic, useApiMutation, useApiQuery } from "@/api/request";
import { seedStaffCard } from "@/areas/staff/cardSeed";
import { AddPositionModal } from "@/areas/staff/components/AddPositionModal";
import { AddStaffSheet } from "@/areas/staff/components/AddStaffSheet";
import { DeleteStaffModal } from "@/areas/staff/components/DeleteStaffModal";
import { DismissStaffModal } from "@/areas/staff/components/DismissStaffModal";
import { NoAccessState } from "@/areas/staff/components/NoAccessState";
import { StaffArchiveView } from "@/areas/staff/components/StaffArchiveView";
import { StaffFiltersSheet } from "@/areas/staff/components/StaffFiltersSheet";
import { StaffTeamTable, type StaffGroup, type StaffTeamSort } from "@/areas/staff/components/StaffTeamTable";
import { SystemUsersTab } from "@/areas/staff/components/SystemUsersTab";
import { TransferAccessModal } from "@/areas/staff/components/TransferAccessModal";
import {
  activeStaffFilterCount,
  applyStaffMove,
  emptyStaffFilters,
  matchesStaffSearch,
  type DeletedStaffSnapshot,
  type StaffGroupTab,
  type StaffListFilters,
} from "@/domain/staff";
import { useCan, useCurrent } from "@/demo/hooks";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { DropdownMenu } from "@/ui/DropdownMenu";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { Fab } from "@/ui/Fab";
import { IconButton } from "@/ui/IconButton";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { Select } from "@/ui/Select";
import { Sheet } from "@/ui/Sheet";
import { SkeletonText } from "@/ui/Skeleton";
import { Tabs } from "@/ui/Tabs";
import { useToast } from "@/ui/Toast";

const ALL_FILTERS: StaffListFilters = { status: "all", license: "all" };

/** Порядок меняет один запрос; кэш списка правится сразу — строка встаёт на место без ожидания «сервера» */
const moveOptimistic = optimistic<StaffListRow[], MoveStaffInput>(
  (a) => ["staff", "list", a.businessId],
  (old, a) => {
    const ids = [...old].sort((x, y) => x.order - y.order).map((r) => r.staff.id);
    const next = applyStaffMove(ids, a.staffId, a.targetId, a.place);
    return old
      .map((r) => ({ ...r, order: next.indexOf(r.staff.id) }))
      .sort((x, y) => x.order - y.order);
  },
);

const onlineOptimistic = optimistic<StaffListRow[], { businessId: string; staffId: string; enabled: boolean }>(
  (a) => ["staff", "list", a.businessId],
  (old, a) =>
    old.map((r) => (r.staff.id === a.staffId ? { ...r, staff: { ...r.staff, onlineBookingEnabled: a.enabled } } : r)),
);

export function StaffListScreen() {
  const t = useT("staff");
  const toast = useToast();
  const router = useRouter();
  const locale = useLocale();
  const { ready, businessId, activeLocationIds } = useCurrent();
  const canManage = useCan("staff.manage");
  const canView = useCan("staff.view");

  const [tab, setTab] = useState<StaffGroupTab>("team");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<StaffListFilters>(emptyStaffFilters());
  const [sort, setSort] = useState<StaffTeamSort>("order");
  const [filterOpen, setFilterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState<"staff" | "position" | null>(null);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffListRow | null>(null);
  const [dismissTarget, setDismissTarget] = useState<StaffListRow | null>(null);
  const [transferTarget, setTransferTarget] = useState<StaffListRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const enabled = ready && Boolean(businessId);
  // Одно чтение на весь экран: все сотрудники бизнеса. Поиск, фильтры, архив — на месте (М6)
  const listQ = useApiQuery(
    ["staff", "list", businessId, activeLocationIds, "all"],
    () => listStaffRows({ businessId: businessId!, locationIds: activeLocationIds, filters: ALL_FILTERS }),
    { enabled },
  );
  const positionsQ = useApiQuery(["staff", "positions", businessId], () => listPositions(businessId!), { enabled });
  const businessQ = useCoreGet("businesses", businessId, { enabled });

  const onlineM = useApiMutation(
    (input: { businessId: string; staffId: string; enabled: boolean }) => setOnlineBookingEnabled(input.staffId, input.enabled),
    { optimistic: onlineOptimistic },
  );
  const moveM = useApiMutation(moveStaff, { optimistic: moveOptimistic });
  const restoreM = useApiMutation(restoreStaff);
  const restoreDeletedM = useApiMutation(restoreDeletedStaff);
  const revokeM = useApiMutation(revokeAccess);
  const resendM = useApiMutation(resendInviteForStaff);
  const dueM = useApiMutation(applyDueDismissals);

  // Запланированные увольнения, чей день настал, вступают в силу (С3)
  useEffect(() => {
    if (enabled && businessId) void dueM.mutate(businessId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, businessId]);

  const rows = listQ.data ?? [];
  const team = rows.filter((r) => r.staff.status !== "fired");
  const fired = rows.filter((r) => r.staff.status === "fired");
  const filterCount = activeStaffFilterCount({ ...filters, status: "working" });
  // «Только владелец» (F-10-003, onboarding-k1 №3): свою карточку всегда видно, «пусто» — когда никого ещё не пригласили
  const baseEmpty = !listQ.isLoading && !listQ.isError && rows.filter((r) => r.staff.role !== "owner").length === 0;

  const visible = new Set(
    team
      .filter(
        (r) =>
          matchesStaffSearch(r.staff, search) &&
          (filters.license === "all" || (filters.license === "paid") === r.seat.paid) &&
          (!filters.positionName || r.positionLabel === filters.positionName),
      )
      .map((r) => r.staff.id),
  );

  // Группы по должности: порядок — как в каталоге должностей, «Без должности» — в конце
  const noPosition = t("table.noPosition");
  const catalog = (positionsQ.data ?? []).map((p) => p.name.ru);
  const sorted =
    sort === "order"
      ? team
      : [...team].sort((a, b) => a.staff.name.localeCompare(b.staff.name, locale) * (sort === "nameAsc" ? 1 : -1));
  const groupMap = new Map<string, string[]>();
  for (const r of sorted) {
    const key = r.positionLabel || "";
    groupMap.set(key, [...(groupMap.get(key) ?? []), r.staff.id]);
  }
  const groupKeys = [...groupMap.keys()].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    const ia = catalog.indexOf(a);
    const ib = catalog.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, locale);
  });
  const groups: StaffGroup[] = groupKeys.map((key) => ({ key: key || "—", label: key || noPosition, ids: groupMap.get(key) ?? [] }));

  const businessName = businessQ.data?.name ?? "";
  const open = (row: StaffListRow) => {
    seedStaffCard(row, businessName);
    router.push(`/biz/staff/${row.staff.id}`);
  };

  const run = async (id: string, fn: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(success);
    } catch {
      toast.error(t("toast.actionFailed"));
    } finally {
      setBusyId(null);
    }
  };
  const doRestore = (row: StaffListRow) =>
    void run(row.staff.id, () => restoreM.mutate(row.staff.id), t("toast.restored", { name: row.staff.name }));
  const doCancelDismissal = (row: StaffListRow) =>
    void run(row.staff.id, () => restoreM.mutate(row.staff.id), t("toast.dismissalCancelled", { name: row.staff.name }));
  const doRestoreDeleted = (d: DeletedStaffSnapshot) =>
    void run(d.id, () => restoreDeletedM.mutate(d.id), t("toast.restoredDeleted", { name: d.snapshot.name }));
  const doRevoke = (row: StaffListRow) =>
    void run(row.staff.id, () => revokeM.mutate(row.staff.id), t("toast.accessRevoked", { name: row.staff.name }));
  const doResend = (row: StaffListRow) =>
    void run(row.staff.id, () => resendM.mutate(row.staff.id), t("toast.inviteResent", { name: row.staff.name }));
  const doToggleOnline = (row: StaffListRow, next: boolean) => {
    if (!businessId) return;
    onlineM.mutate({ businessId, staffId: row.staff.id, enabled: next }).catch(() => toast.error(t("toast.actionFailed")));
  };
  const doMove = (staffId: string, targetId: string, place: "before" | "after") => {
    if (!businessId) return;
    moveM.mutate({ businessId, staffId, targetId, place }).catch(() => toast.error(t("toast.actionFailed")));
  };

  if (ready && !canView) return <NoAccessState />;

  const tabItems = [
    // Счётчик «Команды» на месте уже при загрузке — вкладки не раздвигаются, когда пришли данные
    { value: "team", label: t("tabs.team"), badge: listQ.isLoading ? <SkeletonText width="2ch" /> : team.length },
    // Архив: пока грузится — место под счётчик (в демо уволенные есть); пустой архив — без счётчика
    { value: "archive", label: t("tabs.archive"), badge: listQ.isLoading ? <SkeletonText width="2ch" /> : !fired.length ? undefined : fired.length },
    { value: "system", label: t("tabs.system") },
  ];

  return (
    <div data-f="F-10-001 F-10-003" className="flex flex-col gap-4 md:gap-6">
      {/* Экранных узлов на весь список нет — метки на самих понятиях (arch-a1: root листа один на весь экран) */}
      <span data-f="F-10-002 F-10-005 F-10-013 F-10-014 F-00-037 F-00-049 F-00-050" hidden />
      <PageHeader
        title={t("title")}
        description={<span className="max-md:hidden">{t("subtitle")}</span>}
        actions={
          <span className="flex items-center gap-2 max-md:hidden">
            {canManage && (
              <Button data-f="F-10-111" variant="secondary" onClick={() => router.push("/biz/staff/license")}>
                {t("license.button")}
              </Button>
            )}
            {canManage && (
              <DropdownMenu
                trigger={(p) => (
                  <Button leftIcon={<Plus aria-hidden />} {...p}>
                    {t("addMenu.button")}
                  </Button>
                )}
                items={[
                  { id: "staff", label: t("addMenu.staff"), icon: <UserPlus aria-hidden />, onSelect: () => setAddOpen("staff") },
                  { id: "position", label: t("addMenu.position"), icon: <ListPlus aria-hidden />, onSelect: () => setAddOpen("position") },
                ]}
                label={t("addMenu.button")}
              />
            )}
          </span>
        }
      />

      {listQ.isError ? (
        <ErrorState title={t("list.loadFailed")} onRetry={listQ.refetch} />
      ) : baseEmpty ? (
        <div data-f="F-10-003">
          <EmptyState
            icon={<Users aria-hidden />}
            title={t("empty.baseTitle")}
            description={t("empty.baseText")}
            action={
              canManage ? (
                <Button leftIcon={<UserPlus aria-hidden />} onClick={() => setAddOpen("staff")}>
                  {t("addMenu.staff")}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div data-f="F-10-008 F-10-009 F-10-010">
            <div className="max-md:hidden">
              <Tabs value={tab} onValueChange={(v) => setTab(v as StaffGroupTab)} items={tabItems} />
            </div>
            <div className="md:hidden">
              <Select
                aria-label={t("tabs.view")}
                value={tab}
                onValueChange={(v) => setTab(v as StaffGroupTab)}
                options={tabItems.map((i) => ({ value: i.value, label: typeof i.badge === "number" ? `${i.label} · ${i.badge}` : i.label }))}
              />
            </div>
          </div>

          {tab === "team" && (
            <div data-f="F-10-006 F-10-007" className="flex items-center gap-2">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                debounceMs={200}
                placeholder={t("searchPlaceholder")}
                className="min-w-0 flex-1 md:max-w-xl"
              />
              <span className="relative shrink-0">
                <IconButton
                  icon={<SlidersHorizontal aria-hidden />}
                  label={filterCount > 0 ? t("filters.buttonActive", { count: filterCount }) : t("filters.button")}
                  variant="outline"
                  className={cn(filterCount > 0 && "border-primary text-primary-text")}
                  onClick={() => setFilterOpen(true)}
                />
                {filterCount > 0 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-1.5 -right-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs leading-5 font-semibold text-primary-contrast ring-2 ring-bg"
                  >
                    {filterCount}
                  </span>
                )}
              </span>
            </div>
          )}

          {tab === "team" && <StaffTotals rows={team} loading={listQ.isLoading} />}

          {tab === "system" ? (
            // F-13-019 (integrations, второй проход 26.09): системный пользователь живёт от реального
            // подключения приложения в локации, не от отдельного мокапа businessId — locationIds, не businessId.
            <SystemUsersTab locationIds={activeLocationIds} />
          ) : tab === "archive" ? (
            <StaffArchiveView
              businessId={businessId ?? ""}
              fired={fired}
              loading={listQ.isLoading}
              canManage={canManage}
              busyId={busyId}
              onOpen={open}
              onRestore={doRestore}
              onDelete={setDeleteTarget}
              onRestoreDeleted={doRestoreDeleted}
            />
          ) : (
            <StaffTeamTable
              rows={team}
              groups={groups}
              visible={visible}
              // Порядок групп — по каталогу должностей: пока он не пришёл, строки не показываем (иначе группы
              // сначала встают в одном порядке, а через миг перескакивают)
              loading={listQ.isLoading || positionsQ.isLoading}
              canManage={canManage}
              locale={locale}
              sort={sort}
              onSortChange={setSort}
              onOpen={open}
              onToggleOnline={doToggleOnline}
              onMove={doMove}
              onFire={setDismissTarget}
              onCancelDismissal={doCancelDismissal}
              onRevokeAccess={doRevoke}
              onResendInvite={doResend}
              onTransferAccess={setTransferTarget}
            />
          )}
        </>
      )}

      {canManage && <Fab icon={<Plus aria-hidden />} label={t("addMenu.button")} onClick={() => setMobileAddOpen(true)} />}
      <Sheet open={mobileAddOpen} onOpenChange={setMobileAddOpen} side="bottom" title={t("addMenu.button")}>
        <div className="flex flex-col gap-1 pb-2">
          {[
            { id: "staff", icon: <UserPlus aria-hidden />, label: t("addMenu.staff"), run: () => setAddOpen("staff") },
            { id: "position", icon: <ListPlus aria-hidden />, label: t("addMenu.position"), run: () => setAddOpen("position") },
            { id: "license", icon: <BadgeCheck aria-hidden />, label: t("addMenu.license"), run: () => router.push("/biz/staff/license") },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMobileAddOpen(false);
                item.run();
              }}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-left text-base text-fg active:bg-surface-2 [&_svg]:size-5 [&_svg]:text-muted"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </Sheet>

      <AddStaffSheet
        open={addOpen === "staff"}
        onOpenChange={(o) => setAddOpen(o ? "staff" : null)}
        businessId={businessId}
        locationIds={activeLocationIds}
        existingStaff={rows.map((r) => r.staff)}
        assistantOf={undefined}
        positions={positionsQ.data ?? []}
        onCreated={(staff) => router.push(`/biz/staff/${staff.id}?setup=1`)}
      />
      <AddPositionModal
        open={addOpen === "position"}
        onOpenChange={(o) => setAddOpen(o ? "position" : null)}
        businessId={businessId}
        onCreated={() => undefined}
      />
      <StaffFiltersSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onChange={setFilters}
        positions={positionsQ.data ?? []}
      />
      <DeleteStaffModal row={deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onDeleted={() => undefined} />
      <DismissStaffModal row={dismissTarget} onOpenChange={(o) => !o && setDismissTarget(null)} onDismissed={() => undefined} />
      <TransferAccessModal
        row={transferTarget}
        candidates={team}
        onOpenChange={(o) => !o && setTransferTarget(null)}
        onTransferred={() => undefined}
      />
    </div>
  );
}

/** Итоги списка (DESIGN.md → Journal A2, тот же ритм «число · подпись»): сколько человек в команде и сколько
 * платных/бесплатных мест лицензии. Скелетон той же высоты — строка не прыгает. */
function StaffTotals({ rows, loading }: { rows: StaffListRow[]; loading: boolean }) {
  const t = useT("staff");
  const format = useFormat();
  const paidCount = rows.filter((r) => r.seat.paid).length;
  const freeCount = rows.length - paidCount;
  const item = (n: number, label: string) => (
    <span className="whitespace-nowrap">
      <b className="font-bold text-fg tabular-nums">{format.number(n)}</b> {label}
    </span>
  );
  return (
    <p className="flex min-h-5 flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-muted">
      {loading ? (
        // Те же три пары «число подпись» — строка не меняет высоту и не переносится иначе
        <>
          {[12, 14, 16].map((w) => (
            <span key={w} className="whitespace-nowrap">
              <b className="font-bold text-fg tabular-nums">
                <SkeletonText width="2ch" />
              </b>{" "}
              <SkeletonText width={`${w}ch`} />
            </span>
          ))}
        </>
      ) : (
        <>
          {item(rows.length, t("list.totals.count", { n: rows.length }))}
          {item(paidCount, t("list.totals.paidSeats", { n: paidCount }))}
          {item(freeCount, t("list.totals.freeSeats", { n: freeCount }))}
        </>
      )}
    </p>
  );
}
