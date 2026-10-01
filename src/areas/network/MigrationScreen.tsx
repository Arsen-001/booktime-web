"use client";

/**
 * /biz/network/services/migration — «Миграция услуг» (F-11-087…093): у каждой услуги видно, в каких
 * филиалах она есть; «Добавить в филиалы» / «Удалить из филиалов» / «Синхронизировать» / «Объединить».
 * «Сделать сетевой» (F-11-085/091) — та же «Добавить в филиалы» из услуги одного филиала.
 */
import { useRef, useState } from "react";
import { useLocale } from "next-intl";
import { ArrowLeftRight, Check, FileDown, FileUp, Plus } from "lucide-react";
import {
  addServiceToLocations,
  exportBusinessServicesCsv,
  importBusinessServicesCsv,
  listNetworkLocations,
  listServiceMigrationRows,
  mergeNetworkServices,
  removeServiceFromLocations,
  syncServiceToLocations,
  type ServiceMigrationRow,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { pickText } from "@/lib/text";
import { downloadCsv, parseCsv, readTextFile } from "@/lib/csv";
import type { Id } from "@/domain/core";
import { Badge } from "@/ui/Badge";
import { Button, LinkButton } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { PageHeader } from "@/ui/PageHeader";
import { DEFAULT_PAGE_SIZE, Pagination, usePagedList } from "@/ui/Pagination";
import { Select } from "@/ui/Select";
import { SectionCard } from "@/ui/SectionCard";
import { SkeletonText } from "@/ui/Skeleton";
import { useSkeletonCount } from "@/ui/hooks/useSkeletonCount";
import { useConfirm, useToast } from "@/ui/Toast";
import { scrollEdgeClass, useScrollEdges } from "@/ui/hooks/useScrollEdges";
import { NetworkPageActions } from "@/areas/network/NetworkPageHelp";
import { LocationsPicker } from "@/areas/network/lib/LocationsPicker";
import { useNetwork } from "@/areas/network/lib/useNetwork";
import type { NetworkLocationRow } from "@/api/network";

/** F-11-010: выгрузка услуг филиала в Excel и загрузка в другой — без сети, между любыми двумя локациями */
/**
 * Таблица «Услуги по филиалам» — фиксированная раскладка: колонка филиала 12rem (название в одну строку, многоточием),
 * услуга — всё остальное. Ширины не зависят от данных, поэтому скелетон и таблица с данными совпадают.
 */
const MIGRATION_TABLE = "w-full min-w-[640px] table-fixed border-collapse text-sm";
const LOCATION_TH = "w-48 truncate px-2 py-2.5 text-center font-medium";

function ExcelMigrationCard({
  locations,
}: {
  locations: NetworkLocationRow[];
}) {
  const t = useT("network");
  const toast = useToast();
  const [fromId, setFromId] = useState<Id | "">("");
  const [toId, setToId] = useState<Id | "">("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const exportMutation = useApiMutation((id: Id) =>
    exportBusinessServicesCsv(id),
  );
  const importMutation = useApiMutation(
    (input: {
      targetId: Id;
      rows: {
        name: string;
        category: string;
        price: number;
        duration: number;
      }[];
    }) => importBusinessServicesCsv(input.targetId, input.rows),
  );

  const doExport = async () => {
    if (!fromId) return;
    const csv = await exportMutation.mutate(fromId);
    downloadCsv(`services-${fromId}.csv`, csv);
    toast.success(t("migration.excelExported"));
  };

  const pickFile = () => fileRef.current?.click();

  const doImport = async (file: File) => {
    if (!toId) {
      toast.error(t("migration.excelPickTarget"));
      return;
    }
    setBusy(true);
    try {
      const text = await readTextFile(file);
      const table = parseCsv(text);
      const rows = table
        .slice(1, 501)
        .filter((r) => r.length && r[0]?.trim())
        .map((r) => ({
          name: r[0] ?? "",
          category: r[1] ?? "",
          price: Number(r[2]) || 0,
          duration: Number(r[3]) || 30,
        }));
      const created = await importMutation.mutate({ targetId: toId, rows });
      toast.success(t("migration.excelImported", { count: created }));
    } catch {
      toast.error(t("migration.excelImportFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-f="F-11-010">
      <SectionCard
        title={t("migration.excelTitle")}
        description={t("migration.excelSubtitle")}
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <FormField label={t("migration.excelFromLabel")} className="flex-1">
            <Select
              value={fromId}
              onValueChange={(v) => setFromId(v as Id)}
              options={locations.map((l) => ({
                value: l.business.id,
                label: l.business.name,
              }))}
              placeholder={t("migration.excelChooseLocation")}
            />
          </FormField>
          <Button
            variant="secondary"
            leftIcon={<FileDown aria-hidden />}
            disabled={!fromId}
            loading={exportMutation.isPending}
            onClick={doExport}
            className="self-end"
          >
            {t("migration.excelExport")}
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <FormField label={t("migration.excelToLabel")} className="flex-1">
            <Select
              value={toId}
              onValueChange={(v) => setToId(v as Id)}
              options={locations.map((l) => ({
                value: l.business.id,
                label: l.business.name,
              }))}
              placeholder={t("migration.excelChooseLocation")}
            />
          </FormField>
          <Button
            variant="secondary"
            leftIcon={<FileUp aria-hidden />}
            disabled={!toId}
            loading={busy}
            onClick={pickFile}
            className="self-end"
          >
            {t("migration.excelImport")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void doImport(file);
            }}
          />
        </div>
      </SectionCard>
    </div>
  );
}

type Action = "add" | "remove" | "sync" | "merge" | null;

export function MigrationScreen() {
  const t = useT("network");
  const locale = useLocale() as "ru" | "en" | "hy";
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, networkId, isError, refetch } = useNetwork();
  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const rowsQ = useApiQuery(
    ["network", "servicesMigration", networkId],
    () => listServiceMigrationRows(networkId!),
    { enabled: ready && Boolean(networkId) },
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<Action>(null);
  const [targetBusinessIds, setTargetBusinessIds] = useState<Id[]>([]);
  const [mergeName, setMergeName] = useState("");
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableEdges = useScrollEdges(tableScrollRef);

  const addMutation = useApiMutation((input: { key: string; ids: Id[] }) =>
    addServiceToLocations(networkId!, input.key, input.ids),
  );
  const removeMutation = useApiMutation((input: { key: string; ids: Id[] }) =>
    removeServiceFromLocations(networkId!, input.key, input.ids),
  );
  const syncMutation = useApiMutation((input: { key: string; ids: Id[] }) =>
    syncServiceToLocations(networkId!, input.key, input.ids),
  );
  const mergeMutation = useApiMutation(
    (input: { keys: string[]; name: string }) =>
      mergeNetworkServices(networkId!, input.keys, { ru: input.name }),
  );

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: rowsPage, pager } = usePagedList(rowsQ.data ?? []);
  const tableLoading = !ready || rowsQ.isLoading || locationsQ.isLoading;
  const skeletonRows = useSkeletonCount("networkMigration", { loading: tableLoading, count: rowsQ.data ? rowsPage.length : undefined, fallback: 10, max: 10 });
  // Сколько услуг всего (для полосы страниц под скелетоном): в демо их больше 10 — две страницы
  const skeletonTotal = useSkeletonCount("networkMigrationTotal", { loading: tableLoading, count: rowsQ.data?.length, fallback: 20 });
  const skeletonCols = useSkeletonCount("networkMigrationCols", { loading: tableLoading, count: locationsQ.data?.length, fallback: 2, max: 10 });

  if (isError || rowsQ.isError)
    return (
      <ErrorState onRetry={() => (isError ? refetch() : rowsQ.refetch())} />
    );

  const locations = locationsQ.data ?? [];
  const rows = rowsQ.data ?? [];
  const keyOf = (row: ServiceMigrationRow) =>
    row.service.name.ru || row.service.id;
  const selectedRows = rows.filter((r) => selected.includes(keyOf(r)));

  const toggleRow = (key: string, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key),
    );
  };

  const openAction = (kind: Exclude<Action, null>) => {
    if (kind === "add") {
      const already = selectedRows[0]?.availableIn ?? [];
      setTargetBusinessIds(
        locations
          .map((l) => l.business.id)
          .filter((id) => !already.includes(id)),
      );
    } else if (kind === "remove" || kind === "sync") {
      setTargetBusinessIds(selectedRows[0]?.availableIn ?? []);
    } else {
      setMergeName(
        selectedRows[0] ? pickText(selectedRows[0].service.name, locale) : "",
      );
    }
    setAction(kind);
  };

  const closeAction = () => {
    setAction(null);
    setTargetBusinessIds([]);
  };

  const runAction = async () => {
    const row = selectedRows[0];
    try {
      if (action === "add" && row) {
        const ok =
          row.availableIn.length > 1 ||
          (await confirm({
            title: t("migration.makeNetworkConfirmTitle"),
            description: t("migration.makeNetworkConfirmBody"),
            tone: "danger",
            confirmLabel: t("migration.makeNetworkConfirmAction"),
          }));
        if (!ok) return;
        await addMutation.mutate({ key: keyOf(row), ids: targetBusinessIds });
        toast.success(t("migration.addDone"));
      } else if (action === "remove" && row) {
        const ok = await confirm({
          title: t("migration.removeConfirmTitle"),
          description: t("migration.removeConfirmBody"),
          tone: "danger",
        });
        if (!ok) return;
        await removeMutation.mutate({
          key: keyOf(row),
          ids: targetBusinessIds,
        });
        toast.success(t("migration.removeDone"));
      } else if (action === "sync" && row) {
        await syncMutation.mutate({ key: keyOf(row), ids: targetBusinessIds });
        toast.success(t("migration.syncDone"));
      } else if (action === "merge" && selectedRows.length >= 2) {
        const ok = await confirm({
          title: t("migration.mergeConfirmTitle"),
          description: t("migration.mergeConfirmBody"),
          tone: "danger",
          confirmLabel: t("migration.mergeConfirmAction"),
        });
        if (!ok) return;
        await mergeMutation.mutate({
          keys: selectedRows.map(keyOf),
          name: mergeName.trim(),
        });
        toast.success(t("migration.mergeDone"));
      }
      closeAction();
      setSelected([]);
      rowsQ.refetch();
    } catch {
      toast.error(t("migration.actionFailed"));
    }
  };

  const willLose =
    action === "sync" && selectedRows[0]
      ? selectedRows[0].availableIn.filter(
          (id) => !targetBusinessIds.includes(id),
        )
      : [];

  return (
    <div
      data-f="F-11-087"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t("migration.title")}
        description={t("migration.subtitle")}
        actions={
          <NetworkPageActions
            titleKey="help.migration.title"
            bodyKey="help.migration.body"
            extra={
              <LinkButton
                href="/biz/network/services/new"
                variant="secondary"
                size="sm"
                leftIcon={<Plus aria-hidden />}
              >
                {t("migration.addService")}
              </LinkButton>
            }
          />
        }
      />

      <ExcelMigrationCard locations={locations} />

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5">
          <span className="text-sm text-muted">
            {t("migration.selectedCount", { count: selected.length })}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <span data-f="F-11-088">
              <Button
                size="sm"
                variant="secondary"
                disabled={selected.length !== 1}
                onClick={() => openAction("add")}
              >
                {t("migration.actionAdd")}
              </Button>
            </span>
            <span data-f="F-11-089">
              <Button
                size="sm"
                variant="secondary"
                disabled={selected.length !== 1}
                onClick={() => openAction("remove")}
              >
                {t("migration.actionRemove")}
              </Button>
            </span>
            <span data-f="F-11-090">
              <Button
                size="sm"
                variant="secondary"
                disabled={selected.length !== 1}
                onClick={() => openAction("sync")}
              >
                {t("migration.actionSync")}
              </Button>
            </span>
            <span data-f="F-11-093">
              <Button
                size="sm"
                variant="secondary"
                disabled={selected.length < 2}
                onClick={() => openAction("merge")}
              >
                {t("migration.actionMerge")}
              </Button>
            </span>
          </div>
        </div>
      )}

      <SectionCard title={t("migration.tableTitle")} padding="none">
        {tableLoading ? (
          // Скелетон = та же таблица: галочка, услуга, по колонке на филиал; под ней — полоса страниц
          <>
            <div aria-hidden className="main-scrollbar overflow-x-auto">
              <table className={MIGRATION_TABLE}>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="w-11 px-3 py-2.5" />
                    <th className="sticky left-0 z-10 bg-surface px-4 py-2.5">
                      {t("migration.colService")}
                    </th>
                    {Array.from({ length: skeletonCols }, (_, c) => (
                      <th key={c} className={LOCATION_TH}>
                        {/* Типичное «Manana Beauty · Нор-Норк» — колонка той же ширины */}
                        <SkeletonText width="23.5ch" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: skeletonRows }, (_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <Checkbox checked={false} disabled />
                      </td>
                      <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium text-fg">
                        <span className="flex min-h-11 items-center py-2">
                          <SkeletonText width={i % 2 ? "14ch" : "20ch"} />
                        </span>
                      </td>
                      {Array.from({ length: skeletonCols }, (_, c) => (
                        <td key={c} className="px-2 py-2 text-center" />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {skeletonTotal > DEFAULT_PAGE_SIZE && (
              <div className="border-t border-border px-4 py-3">
                <Pagination loading page={1} pageSize={DEFAULT_PAGE_SIZE} total={skeletonTotal} onPageChange={() => {}} onPageSizeChange={() => {}} className="mt-4" />
              </div>
            )}
          </>
        ) : !rows.length ? (
          <div className="p-5">
            <EmptyState
              compact
              icon={<ArrowLeftRight aria-hidden />}
              title={t("migration.empty")}
              action={
                <LinkButton href="/biz/network/services/new" size="sm">
                  {t("migration.addService")}
                </LinkButton>
              }
            />
          </div>
        ) : (
          <>
            <div
              ref={tableScrollRef}
              className={`main-scrollbar overflow-x-auto ${scrollEdgeClass(tableEdges) ?? ""}`}
            >
              <table className={MIGRATION_TABLE}>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="w-11 px-3 py-2.5" />
                    <th className="sticky left-0 z-10 bg-surface px-4 py-2.5">
                      {t("migration.colService")}
                    </th>
                    {locations.map((l) => (
                      <th
                        key={l.business.id}
                        className={LOCATION_TH}
                      >
                        {l.business.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowsPage.map((row) => {
                    const key = keyOf(row);
                    return (
                      <tr
                        key={row.service.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={selected.includes(key)}
                            onCheckedChange={(checked) => toggleRow(key, checked)}
                          />
                        </td>
                        <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium text-fg">
                          <LinkButton
                            href={`/biz/network/services/${encodeURIComponent(key)}`}
                            variant="ghost"
                            className="h-auto min-h-11 w-full min-w-0 justify-start gap-2 px-0 py-2 text-left md:h-auto"
                          >
                            {row.availableIn.length > 1 && (
                              <Badge tone="accent" size="sm">
                                {t("services.networkMark")}
                              </Badge>
                            )}
                            <span className="min-w-0 truncate">{pickText(row.service.name, locale)}</span>
                          </LinkButton>
                        </td>
                        {locations.map((l) => (
                          <td
                            key={l.business.id}
                            className="px-2 py-2 text-center"
                          >
                            {row.availableIn.includes(l.business.id) && (
                              <Check
                                className="mx-auto size-4 text-success"
                                aria-hidden
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pager && <div className="border-t border-border px-4 py-3">{pager}</div>}
          </>
        )}
      </SectionCard>

      <Modal
        open={action === "add" || action === "remove" || action === "sync"}
        onOpenChange={(open) => !open && closeAction()}
        title={
          action === "add"
            ? t("migration.actionAdd")
            : action === "remove"
              ? t("migration.actionRemove")
              : t("migration.actionSync")
        }
        size="sm"
        footer={
          <Button
            className="w-full"
            loading={
              addMutation.isPending ||
              removeMutation.isPending ||
              syncMutation.isPending
            }
            onClick={runAction}
            disabled={!targetBusinessIds.length && action !== "sync"}
          >
            {t("migration.confirmAction")}
          </Button>
        }
      >
        <div
          className="flex flex-col gap-3"
          data-f="F-11-085 F-11-086 F-11-091 F-11-092"
        >
          <LocationsPicker
            locations={
              action === "add"
                ? locations.filter(
                    (l) =>
                      !selectedRows[0]?.availableIn.includes(l.business.id),
                  )
                : locations
            }
            value={targetBusinessIds}
            onChange={setTargetBusinessIds}
          />
          {action === "add" && (
            <p className="text-xs text-muted">
              {t("migration.addKeepsTranslations")}
            </p>
          )}
          {action === "sync" && willLose.length > 0 && (
            <p className="text-xs text-warning">
              {t("migration.syncWillRemove", {
                names: willLose
                  .map(
                    (id) =>
                      locations.find((l) => l.business.id === id)?.business
                        .name,
                  )
                  .filter(Boolean)
                  .join(", "),
              })}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={action === "merge"}
        onOpenChange={(open) => !open && closeAction()}
        title={t("migration.actionMerge")}
        size="sm"
        footer={
          <Button
            className="w-full"
            loading={mergeMutation.isPending}
            onClick={runAction}
          >
            {t("migration.confirmAction")}
          </Button>
        }
      >
        <FormField label={t("migration.mergeNameLabel")} required>
          <Input
            value={mergeName}
            onChange={(e) => setMergeName(e.target.value)}
            autoFocus
          />
        </FormField>
      </Modal>
    </div>
  );
}
