"use client";

/**
 * /biz/network/clients — «Клиентская база» сети: клиент, бывавший в двух филиалах, — одна строка.
 * F-11-041 (поиск по кнопке «Показать»), F-11-042 (фильтры), F-11-043 (выбор + «Действия»), F-11-044
 * (выгрузка в Excel письмом), F-11-060/164 (действия сети — только рассылка и Excel, без категорий/удаления).
 */
import { useState } from "react";
import { Filter, Send, Sheet as SheetIcon, Users } from "lucide-react";
import {
  exportNetworkClients,
  getNetworkPushWeekCount,
  getNetworkSmsBalance,
  getNetworkSmsChannelStatus,
  listNetworkClients,
  listNetworkLocations,
  listNetworkMarketingOptOut,
  NETWORK_SMS_UNIT_PRICE,
  sendNetworkBroadcast,
  type NetworkClientFilters,
  type NetworkClientRow,
} from "@/api/network";
import type { NetworkImportanceClass } from "@/domain/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCoreGet } from "@/api/core";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { formatPhone } from "@/lib/phone";
import { Badge, type BadgeTone } from "@/ui/Badge";
import { Button, LinkButton } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { DropdownMenu } from "@/ui/DropdownMenu";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { SectionCard } from "@/ui/SectionCard";
import { Select } from "@/ui/Select";
import { Sheet } from "@/ui/Sheet";
import { SkeletonText } from "@/ui/Skeleton";
import { Table, type TableColumn } from "@/ui/Table";
import { Textarea } from "@/ui/Textarea";
import { useToast } from "@/ui/Toast";
import { NetworkPageActions } from "@/areas/network/NetworkPageHelp";
import { useNetwork } from "@/areas/network/lib/useNetwork";

const IMPORTANCE_TONE: Record<NetworkImportanceClass, BadgeTone> = {
  gold: "primary",
  silver: "info",
  bronze: "warning",
  none: "neutral",
};

type Draft = {
  query: string;
  sort: "name" | "spend" | "visits";
  memberLocationIds: string[];
  visitedLocationIds: string[];
  gender: "" | "male" | "female" | "unknown";
  onlineOnly: boolean;
  importance: "" | NetworkImportanceClass;
  spendMin: string;
  spendMax: string;
  visitsMin: string;
  visitsMax: string;
  hasFrom: string;
  hasTo: string;
  noFrom: string;
  noTo: string;
  sms: "" | "received" | "notReceived";
};

const EMPTY_DRAFT: Draft = {
  query: "",
  sort: "name",
  memberLocationIds: [],
  visitedLocationIds: [],
  gender: "",
  onlineOnly: false,
  importance: "",
  spendMin: "",
  spendMax: "",
  visitsMin: "",
  visitsMax: "",
  hasFrom: "",
  hasTo: "",
  noFrom: "",
  noTo: "",
  sms: "",
};

function toFilters(d: Draft): NetworkClientFilters {
  return {
    query: d.query || undefined,
    sort: d.sort,
    memberLocationIds: d.memberLocationIds.length ? d.memberLocationIds : undefined,
    visitedLocationIds: d.visitedLocationIds.length ? d.visitedLocationIds : undefined,
    gender: d.gender || undefined,
    onlineOnly: d.onlineOnly || undefined,
    importance: d.importance || undefined,
    spendMin: d.spendMin ? Number(d.spendMin) : undefined,
    spendMax: d.spendMax ? Number(d.spendMax) : undefined,
    visitsMin: d.visitsMin ? Number(d.visitsMin) : undefined,
    visitsMax: d.visitsMax ? Number(d.visitsMax) : undefined,
    hasBookingsFrom: d.hasFrom || undefined,
    hasBookingsTo: d.hasTo || undefined,
    noBookingsFrom: d.noFrom || undefined,
    noBookingsTo: d.noTo || undefined,
    smsReceived: d.sms || undefined,
  };
}

function activeFilterCount(d: Draft): number {
  let n = 0;
  if (d.memberLocationIds.length) n++;
  if (d.visitedLocationIds.length) n++;
  if (d.gender) n++;
  if (d.onlineOnly) n++;
  if (d.importance) n++;
  if (d.spendMin || d.spendMax) n++;
  if (d.visitsMin || d.visitsMax) n++;
  if (d.hasFrom || d.hasTo) n++;
  if (d.noFrom || d.noTo) n++;
  if (d.sms) n++;
  return n;
}

export function ClientsScreen() {
  const t = useT("network");
  const format = useFormat();
  const toast = useToast();
  const { ready, networkId, staffId, isError, refetch } = useNetwork();
  const meQ = useCoreGet("staff", staffId ?? undefined, { enabled: ready });

  const [applied, setApplied] = useState<Draft>(EMPTY_DRAFT);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [broadcast, setBroadcast] = useState<{
    channel: "sms" | "push";
    scope: "selected" | "found";
  } | null>(null);
  const [broadcastText, setBroadcastText] = useState("");
  const [consent, setConsent] = useState(false);

  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const q = useApiQuery(
    ["network", "clients", networkId, JSON.stringify(applied)],
    () => listNetworkClients(networkId!, toFilters(applied)),
    { enabled: ready && Boolean(networkId) },
  );
  const exportMutation = useApiMutation(exportNetworkClients);
  const broadcastMutation = useApiMutation(sendNetworkBroadcast);
  // F-11-056: без подключённого SMS-провайдера главной локации рассылка не уходит
  const smsStatusQ = useApiQuery(
    ["network", "smsStatus", networkId],
    () => getNetworkSmsChannelStatus(networkId!),
    { enabled: ready && Boolean(networkId) && broadcast?.channel === "sms" },
  );
  // F-11-057: тариф и баланс главной локации
  const smsBalanceQ = useApiQuery(
    ["network", "smsBalance", networkId],
    () => getNetworkSmsBalance(networkId!),
    { enabled: ready && Boolean(networkId) && broadcast?.channel === "sms" },
  );
  // F-11-058: клиенты, отказавшиеся от рекламных рассылок, исключены из отправки
  const optOutQ = useApiQuery(
    ["network", "marketingOptOut", networkId],
    () => listNetworkMarketingOptOut(networkId!),
    { enabled: ready && Boolean(networkId) && Boolean(broadcast) },
  );
  // F-11-055 / F-00-114: не больше 3 сетевых пушей в неделю
  const pushWeekCountQ = useApiQuery(
    ["network", "pushWeekCount", networkId],
    () => getNetworkPushWeekCount(networkId!),
    { enabled: ready && Boolean(networkId) && broadcast?.channel === "push" },
  );

  if (isError || q.isError)
    return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const rows = q.data ?? [];
  const locations = locationsQ.data ?? [];

  const runSearch = () => {
    setApplied(draft);
    setSelected([]);
  };
  const clearFilters = () => {
    setDraft(EMPTY_DRAFT);
    setApplied(EMPTY_DRAFT);
    setSelected([]);
  };

  const runExport = async (scope: "found" | "all") => {
    try {
      await exportMutation.mutate({
        networkId: networkId!,
        scope,
        // «вся база» сервер считает сам (все клиенты сети), здесь — только найденные
        count: rows.length,
        authorName: meQ.data?.name ?? t("clientCard.title"),
        kind: "clients",
      });
      toast.success(t("clients.exportSent"));
    } catch {
      toast.error(t("clients.exportFailed"));
    }
  };

  const openBroadcast = (channel: "sms" | "push", scope: "selected" | "found") => {
    setBroadcast({ channel, scope });
    setBroadcastText("");
    setConsent(false);
  };

  const broadcastPhones = broadcast
    ? broadcast.scope === "selected"
      ? rows.filter((r) => selected.includes(r.phone)).map((r) => r.phone)
      : rows.map((r) => r.phone)
    : [];
  const optOutSet = new Set(optOutQ.data ?? []);
  const broadcastOptedOut = broadcastPhones.filter((p) => optOutSet.has(p)).length;
  const broadcastRecipients = broadcastPhones.length - broadcastOptedOut;
  const broadcastCost =
    broadcast?.channel === "sms" ? broadcastRecipients * NETWORK_SMS_UNIT_PRICE : 0;
  const smsBalance = smsBalanceQ.data ?? 0;
  const pushesThisWeek = pushWeekCountQ.data ?? 0;
  const pushCapReached = broadcast?.channel === "push" && pushesThisWeek >= 3;
  const smsBlocked =
    broadcast?.channel === "sms" && smsStatusQ.data && !smsStatusQ.data.connected;

  const runBroadcast = async () => {
    if (!broadcast) return;
    try {
      const entry = await broadcastMutation.mutate({
        networkId: networkId!,
        channel: broadcast.channel,
        scope: broadcast.scope,
        phones: broadcastPhones,
        text: broadcastText,
      });
      if (entry.status === "insufficientFunds") {
        toast.error(t("clients.broadcastInsufficientFunds"));
      } else {
        toast.success(t("clients.broadcastSent", { count: entry.recipients }));
      }
      setBroadcast(null);
    } catch {
      toast.error(t("clients.broadcastFailed"));
    }
  };

  const columns: TableColumn<NetworkClientRow>[] = [
    // Ширины колонок заданы, длинное — многоточием: строки одной высоты, скелетон и данные одной ширины
    {
      id: "name",
      header: t("clients.colName"),
      cell: (r) => <span className="block max-w-[14rem] truncate">{r.name}</span>,
      mobile: "title",
      width: "16rem",
      skeletonWidth: "16ch",
    },
    {
      id: "contacts",
      header: t("clients.colContacts"),
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatPhone(r.phone)}</span>,
      mobile: "subtitle",
      width: "11rem",
      skeletonWidth: "15ch",
    },
    {
      id: "spend",
      header: t("clients.colSpend"),
      cell: (r) => <span className="whitespace-nowrap">{format.money(r.spend)}</span>,
      align: "right",
      mobile: "aside",
      width: "9rem",
      skeletonWidth: "8ch",
      sortable: true,
      sortValue: (r) => r.spend,
    },
    {
      id: "lastVisit",
      header: t("clients.colLastVisit"),
      cell: (r) => (r.lastVisitAt ? format.date(r.lastVisitAt.slice(0, 10)) : "—"),
      mobile: "meta",
      width: "10rem",
      skeletonWidth: "10ch",
    },
    {
      id: "importance",
      header: t("clients.colImportance"),
      cell: (r) =>
        r.importance === "none" ? (
          "—"
        ) : (
          <Badge tone={IMPORTANCE_TONE[r.importance]} size="sm">
            {t(`clients.importance.${r.importance}` as const)}
          </Badge>
        ),
      mobile: "hidden",
      align: "center",
      width: "9rem",
      skeletonWidth: "2ch",
    },
    {
      id: "locations",
      header: t("clients.colLocations"),
      cell: (r) => (
        // На телефоне у бейджа нет заголовка колонки — число с подписью («2 филиала»), а не голая цифра
        <Badge tone={r.locationsCount > 1 ? "accent" : "neutral"} size="sm">
          {t("clients.locationsCount", { count: r.locationsCount })}
        </Badge>
      ),
      mobile: "badge",
      align: "center",
      width: "8rem",
      // Плашка с числом филиалов — та же коробка, число полосой
      skeleton: (
        <Badge tone="neutral" size="sm">
          <SkeletonText width="8ch" />
        </Badge>
      ),
    },
  ];

  const foundCount = rows.length;
  const selectedCount = selected.length;

  return (
    <div data-f="F-11-040 F-11-041 F-11-042 F-11-043 F-11-044 F-11-054 F-11-059 F-11-060 F-11-163 F-11-164 F-04-182 F-04-180" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t("clients.title")}
        description={t("clients.subtitle")}
        actions={
          <NetworkPageActions titleKey="help.clients.title" bodyKey="help.clients.body" />
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-2">
          <SearchInput
            value={draft.query}
            onValueChange={(v) => setDraft((d) => ({ ...d, query: v }))}
            placeholder={t("clients.searchPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <Button onClick={runSearch}>{t("clients.show")}</Button>
        </div>
        <Button
          variant="outline"
          leftIcon={<Filter aria-hidden />}
          onClick={() => {
            setDraft(applied);
            setFiltersOpen(true);
          }}
        >
          {t("clients.filtersTitle")}
          {activeFilterCount(applied) > 0 && (
            <Badge tone="accent" size="sm" className="ml-1">
              {activeFilterCount(applied)}
            </Badge>
          )}
        </Button>
      </div>

      <SectionCard
        title={t("clients.actionsTitle")}
        actions={
          <span className="text-sm text-muted">
            {selectedCount > 0
              ? t("clients.selectedCount", { count: selectedCount })
              : null}
          </span>
        }
      >
        {/* Сеть11: четыре кнопки рассылки заняли первый экран телефона и вылезали за край — одно меню «Рассылка» */}
        <div className="flex flex-wrap gap-2">
          <DropdownMenu
            trigger={(triggerProps) => (
              <Button {...triggerProps} variant="outline" size="sm" leftIcon={<Send aria-hidden />} disabled={!foundCount}>
                {t("clients.actions.broadcast")}
              </Button>
            )}
            items={[
              { id: "smsFound", label: t("clients.actions.smsFound"), onSelect: () => openBroadcast("sms", "found"), disabled: !foundCount },
              { id: "smsSelected", label: t("clients.actions.smsSelected"), onSelect: () => openBroadcast("sms", "selected"), disabled: !selectedCount },
              { id: "pushFound", label: t("clients.actions.pushFound"), onSelect: () => openBroadcast("push", "found"), disabled: !foundCount },
              { id: "pushSelected", label: t("clients.actions.pushSelected"), onSelect: () => openBroadcast("push", "selected"), disabled: !selectedCount },
            ]}
          />
          <DropdownMenu
            trigger={(triggerProps) => (
              <Button
                {...triggerProps}
                variant="outline"
                size="sm"
                leftIcon={<SheetIcon aria-hidden />}
              >
                Excel
              </Button>
            )}
            items={[
              {
                id: "excelFound",
                label: t("clients.actions.excelFound"),
                onSelect: () => runExport("found"),
                disabled: !foundCount,
              },
              {
                id: "excelAll",
                label: t("clients.actions.excelAll"),
                onSelect: () => runExport("all"),
              },
            ]}
          />
          <LinkButton variant="ghost" size="sm" href="/biz/network/clients/log">
            {t("clients.openExportLog")}
          </LinkButton>
        </div>
      </SectionCard>

      <Table
        columns={columns}
        rows={rows}
        loading={!ready || q.isLoading}
        loadingRows={10}
        rowKey={(r) => r.phone}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        rowHref={(r) => `/biz/network/clients/${encodeURIComponent(r.phone)}`}
        empty={
          <EmptyState
            icon={<Users aria-hidden />}
            kind={applied.query || activeFilterCount(applied) ? "search" : undefined}
            onReset={
              applied.query || activeFilterCount(applied) ? clearFilters : undefined
            }
            title={t("clients.empty")}
          />
        }
      />

      <div data-f="F-11-051 F-11-053">
        <SectionCard title={t('clients.dedupTitle')}>
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            <li>{t('clients.dedupRules.openCard')}</li>
            <li>{t('clients.dedupRules.mergeScope')}</li>
          </ul>
        </SectionCard>
      </div>

      <Sheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={t("clients.filtersTitle")}
        side="right"
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setDraft(EMPTY_DRAFT);
              }}
            >
              {t("clients.filtersReset")}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setApplied(draft);
                setFiltersOpen(false);
              }}
            >
              {t("clients.show")}
            </Button>
          </div>
        }
      >
        <div data-f="F-04-181" className="flex flex-col gap-5 p-1">
          <Select
            options={[
              { value: "name", label: t("clients.sort.name") },
              { value: "spend", label: t("clients.sort.spend") },
              { value: "visits", label: t("clients.sort.visits") },
            ]}
            value={draft.sort}
            onValueChange={(v) => setDraft((d) => ({ ...d, sort: v as Draft["sort"] }))}
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">
              {t("clients.filter.memberLocations")}
            </span>
            {locations.map((l) => (
              <Checkbox
                key={l.business.id}
                label={l.business.name}
                checked={draft.memberLocationIds.includes(l.business.id)}
                onCheckedChange={(c) =>
                  setDraft((d) => ({
                    ...d,
                    memberLocationIds: c
                      ? [...d.memberLocationIds, l.business.id]
                      : d.memberLocationIds.filter((id) => id !== l.business.id),
                  }))
                }
              />
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">
              {t("clients.filter.visitedLocations")}
            </span>
            {locations.map((l) => (
              <Checkbox
                key={l.business.id}
                label={l.business.name}
                checked={draft.visitedLocationIds.includes(l.business.id)}
                onCheckedChange={(c) =>
                  setDraft((d) => ({
                    ...d,
                    visitedLocationIds: c
                      ? [...d.visitedLocationIds, l.business.id]
                      : d.visitedLocationIds.filter((id) => id !== l.business.id),
                  }))
                }
              />
            ))}
          </div>

          <Select
            options={[
              { value: "", label: t("clients.filter.genderAny") },
              { value: "male", label: t("clients.filter.genderMale") },
              { value: "female", label: t("clients.filter.genderFemale") },
              { value: "unknown", label: t("clients.filter.genderUnknown") },
            ]}
            value={draft.gender}
            onValueChange={(v) => setDraft((d) => ({ ...d, gender: v as Draft["gender"] }))}
          />

          <Checkbox
            label={t("clients.filter.onlineOnly")}
            description={t("clients.filter.onlineHint")}
            checked={draft.onlineOnly}
            onCheckedChange={(c) => setDraft((d) => ({ ...d, onlineOnly: c }))}
          />

          <Select
            options={[
              { value: "", label: t("clients.filter.importanceAny") },
              { value: "gold", label: t("clients.filter.importanceGold") },
              { value: "silver", label: t("clients.filter.importanceSilver") },
              { value: "bronze", label: t("clients.filter.importanceBronze") },
              { value: "none", label: t("clients.filter.importanceNone") },
            ]}
            value={draft.importance}
            onValueChange={(v) =>
              setDraft((d) => ({ ...d, importance: v as Draft["importance"] }))
            }
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">{t("clients.filter.spendRange")}</span>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                placeholder={t("clients.filter.from")}
                value={draft.spendMin}
                onChange={(e) => setDraft((d) => ({ ...d, spendMin: e.target.value }))}
              />
              <Input
                inputMode="numeric"
                placeholder={t("clients.filter.to")}
                value={draft.spendMax}
                onChange={(e) => setDraft((d) => ({ ...d, spendMax: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">{t("clients.filter.visitsRange")}</span>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                placeholder={t("clients.filter.from")}
                value={draft.visitsMin}
                onChange={(e) => setDraft((d) => ({ ...d, visitsMin: e.target.value }))}
              />
              <Input
                inputMode="numeric"
                placeholder={t("clients.filter.to")}
                value={draft.visitsMax}
                onChange={(e) => setDraft((d) => ({ ...d, visitsMax: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">{t("clients.filter.hasBookings")}</span>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="YYYY-MM-DD"
                value={draft.hasFrom}
                onChange={(e) => setDraft((d) => ({ ...d, hasFrom: e.target.value }))}
              />
              <Input
                type="text"
                placeholder="YYYY-MM-DD"
                value={draft.hasTo}
                onChange={(e) => setDraft((d) => ({ ...d, hasTo: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">{t("clients.filter.noBookings")}</span>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="YYYY-MM-DD"
                value={draft.noFrom}
                onChange={(e) => setDraft((d) => ({ ...d, noFrom: e.target.value }))}
              />
              <Input
                type="text"
                placeholder="YYYY-MM-DD"
                value={draft.noTo}
                onChange={(e) => setDraft((d) => ({ ...d, noTo: e.target.value }))}
              />
            </div>
          </div>

          <Select
            options={[
              { value: "", label: t("clients.filter.smsAny") },
              { value: "received", label: t("clients.filter.smsReceived") },
              { value: "notReceived", label: t("clients.filter.smsNotReceived") },
            ]}
            value={draft.sms}
            onValueChange={(v) => setDraft((d) => ({ ...d, sms: v as Draft["sms"] }))}
          />

        </div>
      </Sheet>

      <Modal
        open={Boolean(broadcast)}
        onOpenChange={(o) => !o && setBroadcast(null)}
        title={t("clients.broadcastTitle")}
        size="sm"
      >
        {broadcast && (
          <div data-f="F-11-055 F-11-056 F-11-057 F-11-058" className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {t("clients.broadcastRecipients", { count: broadcastRecipients })}
              {broadcastOptedOut > 0
                ? ` · ${t("clients.broadcastOptedOut", { count: broadcastOptedOut })}`
                : ""}
            </p>
            {broadcast.channel === "sms" && smsBlocked && (
              <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-fg">
                {t("clients.broadcastNoChannel", {
                  name: smsStatusQ.data?.mainBusinessName ?? "",
                })}
              </p>
            )}
            {broadcast.channel === "sms" && !smsBlocked && (
              <p className="text-xs text-muted">
                {t("clients.broadcastCost", {
                  cost: broadcastCost,
                  balance: smsBalance,
                })}
              </p>
            )}
            {broadcast.channel === "push" && pushCapReached && (
              <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-fg">
                {t("clients.broadcastPushCapReached")}
              </p>
            )}
            <Textarea
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              placeholder={t("clients.broadcastText")}
              rows={4}
            />
            {broadcast.channel === "sms" && (
              <Checkbox
                label={t("clients.broadcastConsent")}
                checked={consent}
                onCheckedChange={setConsent}
              />
            )}
            <Button
              disabled={
                !broadcastText.trim() ||
                !broadcastRecipients ||
                (broadcast.channel === "sms" && !consent) ||
                Boolean(smsBlocked) ||
                pushCapReached ||
                broadcastMutation.isPending
              }
              loading={broadcastMutation.isPending}
              onClick={runBroadcast}
            >
              {t("clients.broadcastSend")}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
