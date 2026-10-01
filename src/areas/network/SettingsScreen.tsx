"use client";

/**
 * /biz/network/settings — «Управление сетью» (F-11-015…F-11-020): название, филиалы (порядок, главный,
 * выход из сети), плашка предупреждения, удаление сети. Удалённая сеть открывается только по прямой
 * ссылке ?net=<id> (F-11-020).
 */
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  GripVertical,
  History,
  Landmark,
  LifeBuoy,
  Plus,
  Receipt,
  TriangleAlert,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  copyBranchData,
  getNetwork,
  getNetworkLicenseSummary,
  isNetworkDeleted,
  listAddableLocations,
  listMyNetworks,
  getLocationDeletionRequest,
  listNetworkAuditLog,
  listNetworkLocations,
  LOCATION_LICENSE_UNIT_PRICE,
  removeLocationFromNetwork,
  renameNetwork,
  reorderNetworkLocations,
  requestLocationDeletion,
  restoreNetwork,
  setMainLocation,
  softDeleteNetwork,
  type NetworkLocationRow,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCan, useCurrent } from "@/demo/hooks";
import type { Id } from "@/domain/core";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { Badge } from "@/ui/Badge";
import { Tooltip } from "@/ui/Tooltip";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { Select } from "@/ui/Select";
import { SkeletonText } from "@/ui/Skeleton";
import { useSkeletonCount } from "@/ui/hooks/useSkeletonCount";
import { StatCard } from "@/ui/StatCard";
import { useConfirm, useToast } from "@/ui/Toast";
import { NetworkPageActions } from "@/areas/network/NetworkPageHelp";
import { AddBranchDialog } from "@/areas/network/lib/AddBranchDialog";
import { useNetwork } from "@/areas/network/lib/useNetwork";

function SortableLocationRow({
  row,
  onLeave,
  onMakeMain,
  onRequestDeletion,
}: {
  row: NetworkLocationRow;
  onLeave: () => void;
  onMakeMain: () => void;
  onRequestDeletion: () => void;
}) {
  const t = useT("network");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.business.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={LOCATION_ROW}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-11 w-11 shrink-0 items-center justify-center text-muted"
        aria-label={t("settings.dragHandle")}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-fg">
          {row.business.name}
        </div>
        <Tooltip content={t("settings.locationIdHint")}>
          <div data-f="F-11-007" tabIndex={0} className="truncate text-xs text-muted">
            {t("settings.locationId", { id: row.business.id })}
          </div>
        </Tooltip>
      </div>
      {row.isMain ? (
        <Badge tone="accent" size="sm">
          {t("settings.mainLocation")}
        </Badge>
      ) : (
        <Button variant="ghost" size="sm" onClick={onMakeMain}>
          {t("settings.makeMain")}
        </Button>
      )}
      <IconButton
        icon={<LifeBuoy aria-hidden />}
        variant="ghost"
        size="sm"
        label={t("settings.requestDeletion")}
        onClick={onRequestDeletion}
      />
      <IconButton
        icon={<Trash2 aria-hidden />}
        variant="ghost"
        size="sm"
        label={t("settings.leaveLocation")}
        onClick={onLeave}
      />
    </li>
  );
}

const LOCATION_ROW = "flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-2.5";

/** Скелетон строки филиала — та же разметка: ручка, название и ID, «Главная» / «Сделать главной», две кнопки */
function LocationRowSkeleton({ main }: { main: boolean }) {
  const t = useT("network");
  return (
    <li className={LOCATION_ROW}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted">
        <GripVertical className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-fg">
          <SkeletonText width="16ch" />
        </div>
        <div className="truncate text-xs text-muted">
          <SkeletonText width="18ch" />
        </div>
      </div>
      {main ? (
        <Badge tone="accent" size="sm">
          {t("settings.mainLocation")}
        </Badge>
      ) : (
        <Button variant="ghost" size="sm" disabled>
          {t("settings.makeMain")}
        </Button>
      )}
      <IconButton icon={<LifeBuoy aria-hidden />} variant="ghost" size="sm" label={t("settings.requestDeletion")} disabled />
      <IconButton icon={<Trash2 aria-hidden />} variant="ghost" size="sm" label={t("settings.leaveLocation")} disabled />
    </li>
  );
}

export function SettingsScreen() {
  const t = useT("network");
  const format = useFormat();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const netParam = searchParams.get("net") as Id | null;
  const own = useNetwork();
  const { staffId, businessId } = useCurrent();
  // Сеть1: ?net=<id> (F-11-020) — только сеть, где состоит свой бизнес; чужой id по ссылке — своя сеть
  const myNetworksQ = useApiQuery(
    ["network", "my-networks", businessId],
    () => listMyNetworks(businessId, staffId),
    { enabled: Boolean(netParam) && Boolean(businessId) },
  );
  const netAllowed = Boolean(netParam) && Boolean(myNetworksQ.data?.some((n) => n.id === netParam));
  const networkId = netAllowed ? netParam! : own.networkId;
  const ready = Boolean(networkId) && (netAllowed ? true : own.ready) && (!netParam || !myNetworksQ.isLoading);

  const netQ = useApiQuery(
    ["network", "get", networkId],
    () => getNetwork(networkId!),
    { enabled: ready },
  );
  const deletedQ = useApiQuery(
    ["network", "deleted", networkId],
    () => isNetworkDeleted(networkId!),
    { enabled: ready },
  );
  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && !deletedQ.data },
  );
  const addableQ = useApiQuery(
    ["network", "addable", networkId, staffId],
    () => listAddableLocations(networkId, staffId),
    { enabled: ready },
  );
  const licenseQ = useApiQuery(
    ["network", "license", networkId],
    () => getNetworkLicenseSummary(networkId!),
    { enabled: ready && !deletedQ.data },
  );
  const auditQ = useApiQuery(
    ["network", "audit", networkId],
    () => listNetworkAuditLog(networkId!),
    { enabled: ready },
  );

  const [name, setName] = useState("");
  const [nameSeen, setNameSeen] = useState<string | undefined>(undefined);
  if (netQ.data && netQ.data.name !== nameSeen) {
    setName(netQ.data.name);
    setNameSeen(netQ.data.name);
  }
  const [order, setOrder] = useState<NetworkLocationRow[] | null>(null);
  const [seenLocations, setSeenLocations] = useState<
    NetworkLocationRow[] | undefined
  >(undefined);
  if (locationsQ.data && locationsQ.data !== seenLocations) {
    setSeenLocations(locationsQ.data);
    setOrder(locationsQ.data);
  }
  const [addOpen, setAddOpen] = useState(false);
  // F-11-039: отдельное право «Добавление локации в сети» (staff.catalog standalone.networkAddLocation),
  // не общее network.manage — у владельца оба включены по умолчанию, у сотрудника права могут разойтись
  const canAddLocation = useCan("network.addLocation");
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState<Id | "">("");
  const [copyTo, setCopyTo] = useState<Id | "">("");
  const [copyServices, setCopyServices] = useState(true);
  const [copyStaff, setCopyStaff] = useState(true);
  const [copyGoods, setCopyGoods] = useState(true);
  const copyMutation = useApiMutation(
    (input: {
      fromBusinessId: Id;
      toBusinessId: Id;
      services: boolean;
      staff: boolean;
      goods: boolean;
    }) => copyBranchData({ networkId: networkId!, ...input }),
  );

  const renameMutation = useApiMutation((newName: string) =>
    renameNetwork(networkId!, newName),
  );
  const reorderMutation = useApiMutation((ids: Id[]) =>
    reorderNetworkLocations(networkId!, ids),
  );
  const mainMutation = useApiMutation((businessId: Id) =>
    setMainLocation(networkId!, businessId),
  );
  const leaveMutation = useApiMutation((businessId: Id) =>
    removeLocationFromNetwork(networkId!, businessId),
  );
  const deleteMutation = useApiMutation(() => softDeleteNetwork(networkId!));
  const restoreMutation = useApiMutation(() => restoreNetwork(networkId!));
  const requestDeletionMutation = useApiMutation((businessId: Id) =>
    requestLocationDeletion(networkId!, businessId),
  );
  const [deletionTarget, setDeletionTarget] = useState<NetworkLocationRow | null>(null);
  // 01.10.2026: заявка на этот филиал уже в поддержке — вторую не шлём, показываем когда отправлена
  const pendingDeletionQ = useApiQuery(
    ["network", "pendingDeletion", networkId, deletionTarget?.business.id],
    () => getLocationDeletionRequest(networkId!, deletionTarget!.business.id),
    { enabled: Boolean(networkId && deletionTarget) },
  );
  const pendingDeletionAt = pendingDeletionQ.data;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Пока сеть грузится — та же страница: поля неактивны, списки и таблицы — строками-скелетонами
  const pageLoading = !ready || netQ.isLoading || deletedQ.isLoading;
  const locationsLoading = !locationsQ.data && (pageLoading || locationsQ.isLoading);
  const licenseLoading = !licenseQ.data && (pageLoading || licenseQ.isLoading);
  const auditLoading = !auditQ.data && (pageLoading || auditQ.isLoading);
  const locationRows = useSkeletonCount("networkSettingsLocations", { loading: locationsLoading, count: locationsQ.data?.length, fallback: 2, max: 20 });
  const auditRows = useSkeletonCount("networkSettingsAudit", { loading: auditLoading, count: auditQ.data ? Math.min(auditQ.data.length, 10) : undefined, fallback: 1, max: 10 });

  // ?api=error: сеть не нашлась (ensure) или не прочиталась — ошибка с «Повторить», а не вечные скелетоны
  if (own.isError || myNetworksQ.isError || netQ.isError || deletedQ.isError || locationsQ.isError)
    return (
      <ErrorState
        onRetry={() => {
          if (own.isError) own.refetch();
          if (myNetworksQ.isError) myNetworksQ.refetch();
          if (netQ.isError) netQ.refetch();
          if (deletedQ.isError) deletedQ.refetch();
          if (locationsQ.isError) locationsQ.refetch();
        }}
      />
    );

  const isDeleted = Boolean(deletedQ.data);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === netQ.data?.name) return;
    try {
      await renameMutation.mutate(trimmed);
      toast.success(t("settings.nameSaved"));
      netQ.refetch();
    } catch {
      toast.error(t("settings.nameSaveFailed"));
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !order) return;
    const from = order.findIndex((r) => r.business.id === active.id);
    const to = order.findIndex((r) => r.business.id === over.id);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(
      next.map((r, i) => ({ ...r, isMain: i === 0 ? r.isMain : r.isMain })),
    );
    void reorderMutation.mutate(next.map((r) => r.business.id));
  };

  const leave = async (businessId: Id, businessName: string) => {
    const ok = await confirm({
      title: t("settings.leaveConfirmTitle"),
      description: t("settings.leaveConfirmBody", { name: businessName }),
      tone: "danger",
      confirmLabel: t("settings.leaveConfirmAction"),
    });
    if (!ok) return;
    await leaveMutation.mutate(businessId);
    toast.success(t("settings.leaveDone"));
    locationsQ.refetch();
    addableQ.refetch();
  };

  // Решение владельца 01.10.2026: «Сделать главным» сам переносит филиал на первое место и делает главным —
  // без отдельного перетаскивания (у Altegio главной может стать только уже первая строка)
  const makeMain = async (businessId: Id) => {
    try {
      const current = order ?? locationsQ.data ?? [];
      if (current[0]?.business.id !== businessId) {
        const moved = current.find((r) => r.business.id === businessId);
        const next = moved ? [moved, ...current.filter((r) => r.business.id !== businessId)] : current;
        setOrder(next);
        await reorderMutation.mutate(next.map((r) => r.business.id));
      }
      await mainMutation.mutate(businessId);
      toast.success(t("settings.mainSaved"));
      netQ.refetch();
      locationsQ.refetch();
    } catch {
      toast.error(t("settings.mainMustBeFirst"));
    }
  };

  const runCopy = async () => {
    if (!copyFrom || !copyTo || copyFrom === copyTo) return;
    try {
      const result = await copyMutation.mutate({
        fromBusinessId: copyFrom,
        toBusinessId: copyTo,
        services: copyServices,
        staff: copyStaff,
        goods: copyGoods,
      });
      toast.success(
        t("settings.copyDone", {
          services: result.servicesCopied,
          staff: result.staffCopied,
          goods: result.goodsCopied,
        }),
      );
      setCopyOpen(false);
    } catch {
      toast.error(t("settings.copyFailed"));
    }
  };

  const deleteNetwork = async () => {
    const ok = await confirm({
      title: t("settings.deleteConfirmTitle"),
      description: t("settings.deleteConfirmBody"),
      tone: "danger",
      confirmLabel: t("settings.deleteConfirmAction"),
    });
    if (!ok) return;
    await deleteMutation.mutate(undefined);
    toast.success(t("settings.deleteDone"));
    router.push("/biz/network/switch");
  };

  const restore = async () => {
    await restoreMutation.mutate(undefined);
    toast.success(t("settings.restoreDone"));
    deletedQ.refetch();
    locationsQ.refetch();
  };

  if (isDeleted) {
    return (
      <div
        data-f="F-11-019 F-11-020"
        className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
      >
        <PageHeader
          title={netQ.data?.name ?? ""}
          description={t("settings.deletedSubtitle")}
        />
        <EmptyState
          icon={<Trash2 aria-hidden />}
          title={t("settings.deletedTitle")}
          description={t("settings.deletedBody")}
          action={
            <Button
              leftIcon={<Undo2 aria-hidden />}
              loading={restoreMutation.isPending}
              onClick={restore}
            >
              {t("settings.restoreAction")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.subtitle")}
        actions={
          <NetworkPageActions
            titleKey="help.settings.title"
            bodyKey="help.settings.body"
          />
        }
      />

      <div data-f="F-11-012" className="grid grid-cols-2 gap-3">
        <StatCard
          loading={locationsLoading}
          label={t("settings.statBranches")}
          value={order?.length ?? 0}
          icon={<Landmark aria-hidden />}
        />
        <StatCard
          loading={licenseLoading}
          label={t("settings.statLicenseMonthly")}
          value={`${(licenseQ.data ?? []).reduce((sum, r) => sum + r.monthly, 0).toLocaleString("ru-RU")} ֏`}
          icon={<Receipt aria-hidden />}
        />
      </div>

      <div data-f="F-11-015">
        <SectionCard title={t("settings.nameLabel")}>
          {/* Сеть13: название сохраняется кнопкой (и Enter), а не молча на blur */}
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
          >
            <FormField label={t("settings.nameLabel")} required className="flex-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={pageLoading} />
            </FormField>
            <div className="flex gap-2">
              {/* «Отмена» держит место всегда (invisible), чтобы поле и «Сохранить» не прыгали при правке */}
              <Button
                type="button"
                variant="ghost"
                className={name !== (netQ.data?.name ?? "") ? undefined : "invisible"}
                aria-hidden={name === (netQ.data?.name ?? "") || undefined}
                tabIndex={name === (netQ.data?.name ?? "") ? -1 : undefined}
                onClick={() => setName(netQ.data?.name ?? "")}
              >
                {t("settings.nameCancel")}
              </Button>
              <Button
                type="submit"
                loading={renameMutation.isPending}
                disabled={!name.trim() || name.trim() === netQ.data?.name}
              >
                {t("settings.nameSave")}
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>

      <div
        data-f="F-11-018"
        className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-fg"
      >
        <TriangleAlert
          className="mt-0.5 size-4 shrink-0 text-warning"
          aria-hidden
        />
        <p>{t("settings.warningBanner")}</p>
      </div>

      <div data-f="F-11-016 F-11-017 F-11-013 F-11-008 F-11-039">
        <SectionCard
          title={t("settings.locationsTitle")}
          actions={
            <div className="flex flex-wrap gap-2">
              {(locationsLoading || (order && order.length >= 2)) && (
                <Button
                  data-f="F-11-009 F-11-010"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Copy aria-hidden />}
                  disabled={locationsLoading}
                  onClick={() => {
                    setCopyFrom(order?.[0]?.business.id ?? "");
                    setCopyTo(order?.[1]?.business.id ?? "");
                    setCopyOpen(true);
                  }}
                >
                  {t("settings.copyData")}
                </Button>
              )}
              {canAddLocation ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus aria-hidden />}
                  onClick={() => setAddOpen(true)}
                >
                  {t("settings.addLocation")}
                </Button>
              ) : (
                <Badge tone="neutral" size="sm">
                  {t("settings.addLocationNoPermission")}
                </Badge>
              )}
            </div>
          }
        >
          {locationsLoading ? (
            <ul aria-hidden className="flex flex-col gap-2">
              {Array.from({ length: locationRows }, (_, i) => (
                <LocationRowSkeleton key={i} main={i === 0} />
              ))}
            </ul>
          ) : !order?.length ? (
            <EmptyState compact title={t("settings.noLocations")} />
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <SortableContext
                items={order.map((r) => r.business.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-2">
                  {order.map((row) => (
                    <SortableLocationRow
                      key={row.business.id}
                      row={row}
                      onLeave={() => leave(row.business.id, row.business.name)}
                      onMakeMain={() => makeMain(row.business.id)}
                      onRequestDeletion={() => setDeletionTarget(row)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </SectionCard>
      </div>

      <div data-f="F-11-012">
        <SectionCard
          title={t("settings.licenseTitle")}
          description={t("settings.licenseSubtitle")}
        >
          {licenseLoading ? (
            <div aria-hidden className="main-scrollbar overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="py-2">{t("settings.licenseLocation")}</th>
                    <th className="py-2 text-right">{t("settings.licenseMasters")}</th>
                    <th className="py-2 text-right">{t("settings.licenseMonthly")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: locationRows }, (_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2 font-medium text-fg"><SkeletonText width={i % 2 ? "12ch" : "16ch"} /></td>
                      <td className="py-2 text-right"><SkeletonText width="2ch" /></td>
                      <td className="py-2 text-right"><SkeletonText width="8ch" /></td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-2 font-medium text-fg">{t("settings.licenseTotal")}</td>
                    <td className="pt-2" />
                    <td className="pt-2 text-right font-semibold text-fg"><SkeletonText width="8ch" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : !licenseQ.data?.length ? (
            <EmptyState compact title={t("settings.noLocations")} />
          ) : (
            <div className="main-scrollbar overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="py-2">{t("settings.licenseLocation")}</th>
                    <th className="py-2 text-right">{t("settings.licenseMasters")}</th>
                    <th className="py-2 text-right">{t("settings.licenseMonthly")}</th>
                  </tr>
                </thead>
                <tbody>
                  {licenseQ.data.map((row) => (
                    <tr key={row.businessId} className="border-b border-border last:border-0">
                      <td className="py-2 font-medium text-fg">{row.businessName}</td>
                      <td className="py-2 text-right">{row.mastersCount}</td>
                      <td className="py-2 text-right">{row.monthly.toLocaleString("ru-RU")} ֏</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-2 font-medium text-fg">{t("settings.licenseTotal")}</td>
                    <td className="pt-2" />
                    <td className="pt-2 text-right font-semibold text-fg">
                      {licenseQ.data.reduce((sum, r) => sum + r.monthly, 0).toLocaleString("ru-RU")} ֏
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            {t("settings.licenseHint", { price: LOCATION_LICENSE_UNIT_PRICE })}
          </p>
        </SectionCard>
      </div>

      <div data-f="F-11-023">
        <SectionCard
          title={t("settings.auditTitle")}
          description={t("settings.auditSubtitle")}
        >
          {auditLoading && auditRows > 0 ? (
            <ul aria-hidden className="flex flex-col gap-2">
              {Array.from({ length: auditRows }, (_, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-fg"><SkeletonText width={i % 2 ? "18ch" : "24ch"} /></span>
                  <span className="shrink-0 text-xs text-muted"><SkeletonText width="26ch" /></span>
                </li>
              ))}
            </ul>
          ) : !auditQ.data?.length ? (
            <EmptyState
              compact
              icon={<History aria-hidden />}
              title={t("settings.auditEmpty")}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {auditQ.data.slice(0, 10).map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-fg">
                    {t(`settings.auditAction.${entry.action}` as const)}
                    {entry.detail ? ` · ${entry.detail}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {entry.authorName} · {format.date(entry.at)}, {format.time(entry.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div data-f="F-11-019">
        <SectionCard
          title={t("settings.dangerTitle")}
          description={t("settings.dangerSubtitle")}
        >
          <Button
            variant="danger"
            leftIcon={<Trash2 aria-hidden />}
            loading={deleteMutation.isPending}
            onClick={deleteNetwork}
          >
            {t("settings.deleteAction")}
          </Button>
        </SectionCard>
      </div>

      <AddBranchDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        networkId={networkId}
        staffId={staffId}
        onAdded={() => {
          locationsQ.refetch();
          addableQ.refetch();
        }}
      />

      <Modal
        open={copyOpen}
        onOpenChange={setCopyOpen}
        title={t("settings.copyData")}
        size="sm"
        footer={
          <Button
            loading={copyMutation.isPending}
            disabled={!copyFrom || !copyTo || copyFrom === copyTo}
            onClick={runCopy}
            className="w-full"
          >
            {t("settings.copyAction")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t("settings.copyHint")}</p>
          <FormField label={t("settings.copyFromLabel")}>
            <Select
              value={copyFrom}
              onValueChange={(v) => setCopyFrom(v as Id)}
              options={(order ?? []).map((r) => ({
                value: r.business.id,
                label: r.business.name,
              }))}
            />
          </FormField>
          <FormField label={t("settings.copyToLabel")}>
            <Select
              value={copyTo}
              onValueChange={(v) => setCopyTo(v as Id)}
              options={(order ?? [])
                .filter((r) => r.business.id !== copyFrom)
                .map((r) => ({ value: r.business.id, label: r.business.name }))}
            />
          </FormField>
          <div className="flex flex-col gap-2">
            <Checkbox
              checked={copyServices}
              onCheckedChange={setCopyServices}
              label={t("settings.copyServices")}
            />
            <Checkbox
              checked={copyStaff}
              onCheckedChange={setCopyStaff}
              label={t("settings.copyStaff")}
            />
            <Checkbox
              checked={copyGoods}
              onCheckedChange={setCopyGoods}
              label={t("settings.copyGoods")}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deletionTarget)}
        onOpenChange={(o) => !o && setDeletionTarget(null)}
        title={t("settings.requestDeletion")}
        size="sm"
        footer={
          pendingDeletionAt ? (
            <Button variant="secondary" className="w-full" onClick={() => setDeletionTarget(null)}>
              {t("switch.close")}
            </Button>
          ) : (
            <Button
              variant="danger"
              className="w-full"
              loading={requestDeletionMutation.isPending || pendingDeletionQ.isLoading}
              onClick={async () => {
                if (!deletionTarget) return;
                try {
                  await requestDeletionMutation.mutate(deletionTarget.business.id);
                  toast.success(t("settings.requestDeletionSent"));
                  setDeletionTarget(null);
                } catch {
                  toast.error(t("settings.requestDeletionFailed"));
                }
              }}
            >
              {t("settings.requestDeletionAction")}
            </Button>
          )
        }
      >
        <p data-f="F-11-011" className="text-sm text-muted">
          {t("settings.requestDeletionBody", {
            name: deletionTarget?.business.name ?? "",
          })}
        </p>
        {pendingDeletionAt && (
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">
            {t("settings.requestDeletionAlready", {
              at: `${format.date(pendingDeletionAt)}, ${format.time(pendingDeletionAt)}`,
            })}
          </p>
        )}
      </Modal>
    </div>
  );
}
