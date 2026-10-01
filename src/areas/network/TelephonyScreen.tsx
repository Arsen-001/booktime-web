"use client";

/**
 * /biz/network/telephony — «Телефония» сети (F-11-146/147): токен для АТС, статус подключения.
 * После подключения появляются 4 подраздела прямо на этой странице (F-11-147): маршруты (F-11-148),
 * маршрутизация — правила «номер → маршрут» (F-11-149), история звонков (F-11-150) и подсказка на
 * случай, если звонки не приходят (F-11-152).
 */
import { useState } from "react";
import {
  Bell,
  Building2,
  Copy,
  History,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plug,
  Plus,
  Route as RouteIcon,
  Wallet,
} from "lucide-react";
import {
  connectNetworkTelephony,
  deleteNetworkTelephonyRule,
  getLastAcceptedNetworkCall,
  getNetworkTelephony,
  listNetworkCalls,
  listNetworkLocations,
  listNetworkTelephonyRoutes,
  listNetworkTelephonyRules,
  listNetworkUsers,
  saveNetworkTelephonyRoute,
  saveNetworkTelephonyRule,
  type NetworkTelephonyRouteInput,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import type { Id } from "@/domain/core";
import type { NetworkCallHistoryStorage } from "@/domain/network";
import { Badge } from "@/ui/Badge";
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
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { Table, type TableColumn } from "@/ui/Table";
import { useToast } from "@/ui/Toast";
import { copyText } from "@/areas/network/lib/copyText";
import { LocationsPicker } from "@/areas/network/lib/LocationsPicker";
import { NetworkPageActions } from "@/areas/network/NetworkPageHelp";
import { useNetwork } from "@/areas/network/lib/useNetwork";

const PERKS = [
  "callNotifications",
  "quickBooking",
  "callHistory",
  "newModule",
] as const;
const PERK_ICONS = {
  callNotifications: Bell,
  quickBooking: Phone,
  callHistory: History,
  newModule: Plug,
} as const;

const HISTORY_STORAGE: NetworkCallHistoryStorage[] = [
  "network",
  "networkAndNotified",
  "locationOnly",
];

function emptyRouteInput(): NetworkTelephonyRouteInput {
  return { name: "", userIds: [], businessIds: [], historyStorage: "network" };
}

export function TelephonyScreen() {
  const t = useT("network");
  const format = useFormat();
  const toast = useToast();
  const { ready, networkId, isError, refetch } = useNetwork();
  const q = useApiQuery(
    ["network", "telephony", networkId],
    () => getNetworkTelephony(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const connected = Boolean(q.data?.connected);
  const mutation = useApiMutation(() => connectNetworkTelephony(networkId!));

  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) && connected },
  );
  const usersQ = useApiQuery(
    ["network", "users", networkId],
    () => listNetworkUsers(networkId!),
    { enabled: ready && Boolean(networkId) && connected },
  );
  const routesQ = useApiQuery(
    ["network", "telephonyRoutes", networkId],
    () => listNetworkTelephonyRoutes(networkId!),
    { enabled: ready && Boolean(networkId) && connected },
  );
  const rulesQ = useApiQuery(
    ["network", "telephonyRules", networkId],
    () => listNetworkTelephonyRules(networkId!),
    { enabled: ready && Boolean(networkId) && connected },
  );
  const callsQ = useApiQuery(
    ["network", "calls", networkId],
    () => listNetworkCalls(networkId!),
    { enabled: ready && Boolean(networkId) && connected },
  );
  const lastAcceptedQ = useApiQuery(
    ["network", "lastAcceptedCall", networkId],
    () => getLastAcceptedNetworkCall(networkId!),
    { enabled: ready && Boolean(networkId) && connected },
  );

  const [routeOpen, setRouteOpen] = useState(false);
  const [routeInput, setRouteInput] =
    useState<NetworkTelephonyRouteInput>(emptyRouteInput());
  const [routeNameError, setRouteNameError] = useState<string | undefined>();
  const [routeLocationsError, setRouteLocationsError] = useState<string | undefined>();
  const saveRouteMutation = useApiMutation((_: void) =>
    saveNetworkTelephonyRoute(networkId!, routeInput),
  );

  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleKind, setRuleKind] = useState<"phone" | "sip">("phone");
  const [ruleIdentifier, setRuleIdentifier] = useState("");
  const [ruleRouteId, setRuleRouteId] = useState<Id | "">("");
  const [ruleError, setRuleError] = useState<string | undefined>();
  const saveRuleMutation = useApiMutation((_: void) =>
    saveNetworkTelephonyRule(networkId!, {
      kind: ruleKind,
      identifier: ruleIdentifier,
      routeId: ruleRouteId as Id,
    }),
  );
  const deleteRuleMutation = useApiMutation((id: Id) =>
    deleteNetworkTelephonyRule(networkId!, id),
  );

  if (isError || q.isError)
    return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const copy = async () => {
    if (!q.data) return;
    const ok = await copyText(q.data.token);
    toast[ok ? "success" : "error"](
      ok ? t("telephony.copied") : t("telephony.copyFailed"),
    );
  };

  const connect = async () => {
    await mutation.mutate(undefined);
    toast.success(t("telephony.connected"));
    q.refetch();
  };

  const saveRoute = async () => {
    // Раньше пустое название / без филиалов — кнопка молчала; теперь ошибка под полем
    setRouteNameError(routeInput.name.trim() ? undefined : t("telephony.routeNameRequired"));
    setRouteLocationsError(routeInput.businessIds.length ? undefined : t("telephony.routeLocationsRequired"));
    if (!routeInput.name.trim() || !routeInput.businessIds.length) return;
    try {
      await saveRouteMutation.mutate();
      toast.success(t("telephony.routeSaved"));
      setRouteOpen(false);
      setRouteInput(emptyRouteInput());
      routesQ.refetch();
    } catch {
      toast.error(t("telephony.routeSaveFailed"));
    }
  };

  const saveRule = async () => {
    if (!/^\d+$/.test(ruleIdentifier.trim()) || !ruleRouteId) {
      setRuleError(t("telephony.ruleDigitsOnly"));
      return;
    }
    try {
      await saveRuleMutation.mutate();
      toast.success(t("telephony.ruleSaved"));
      setRuleOpen(false);
      setRuleIdentifier("");
      setRuleRouteId("");
      rulesQ.refetch();
    } catch {
      toast.error(t("telephony.ruleSaveFailed"));
    }
  };

  const removeRule = async (id: Id) => {
    await deleteRuleMutation.mutate(id);
    toast.success(t("telephony.ruleDeleted"));
    rulesQ.refetch();
  };

  const callColumns: TableColumn<NonNullable<typeof callsQ.data>[number]>[] = [
    {
      id: "phone",
      header: t("telephony.callsPhone"),
      cell: (c) => (
        <span className="flex items-center gap-2">
          {c.direction === "in" ? (
            <PhoneIncoming className="size-4 text-muted" aria-hidden />
          ) : (
            <PhoneOutgoing className="size-4 text-muted" aria-hidden />
          )}
          {c.phone}
        </span>
      ),
      mobile: "title",
    },
    {
      id: "status",
      header: t("telephony.callsStatus"),
      cell: (c) =>
        c.status === "accepted" ? (
          <Badge tone="success" size="sm">
            {t("telephony.callAccepted")}
          </Badge>
        ) : (
          <Badge tone="danger" size="sm">
            <PhoneMissed className="mr-1 inline size-3" aria-hidden />
            {t("telephony.callMissed")}
          </Badge>
        ),
      mobile: "meta",
    },
    {
      id: "at",
      header: t("telephony.callsAt"),
      cell: (c) => format.dateTime(c.at),
      mobile: "subtitle",
    },
    {
      id: "recording",
      header: t("telephony.callsRecording"),
      cell: (c) =>
        c.hasRecording ? <audio controls className="h-8 w-40" /> : "—",
      mobile: "aside",
    },
  ];

  return (
    <div
      data-f="F-11-146 F-11-147 F-11-148 F-11-149 F-11-150 F-11-152 F-13-086 F-13-087 F-13-088 F-10-152"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t("telephony.title")}
        description={t("telephony.subtitle")}
        actions={
          <NetworkPageActions
            titleKey="help.telephony.title"
            bodyKey="help.telephony.body"
          />
        }
      />

      <SectionCard
        title={t("telephony.cardTitle")}
        description={t("telephony.cardBody")}
      >
        {/* Пока грузится — те же поле, кнопка копирования и «Подключить» (чаще всего ещё не подключено), неактивные */}
        {!ready || q.isLoading ? (
          <div aria-hidden className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Input value="" readOnly disabled className="font-mono" />
              <IconButton icon={<Copy aria-hidden />} label={t("telephony.copyToken")} variant="outline" disabled />
            </div>
            <Button leftIcon={<Plug aria-hidden />} disabled className="self-start">
              {t("telephony.connectAction")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Input
                value={q.data?.token ?? ""}
                readOnly
                className="font-mono"
              />
              <IconButton
                icon={<Copy aria-hidden />}
                label={t("telephony.copyToken")}
                variant="outline"
                onClick={copy}
              />
            </div>
            {connected ? (
              <Badge tone="success" size="sm" className="self-start">
                {t("telephony.connectedBadge")}
              </Badge>
            ) : (
              <Button
                leftIcon={<Plug aria-hidden />}
                loading={mutation.isPending}
                onClick={connect}
                className="self-start"
              >
                {t("telephony.connectAction")}
              </Button>
            )}
          </div>
        )}
      </SectionCard>

      {!connected && (
        <SectionCard title={t("telephony.perksTitle")}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PERKS.map((key) => {
              const Icon = PERK_ICONS[key];
              return (
                <li
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-fg"
                >
                  <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                  {t(`telephony.perk.${key}` as const)}
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      <div
        data-f="F-11-153 F-11-154"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-fg sm:flex-row sm:gap-4"
      >
        <Building2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <div>
          <p className="font-medium">{t("telephony.multiLocationTitle")}</p>
          <p className="mt-1 text-muted">{t("telephony.multiLocationBody")}</p>
          <p className="mt-2 font-medium">{t("telephony.vendorTitle")}</p>
          <p className="mt-1 text-muted">{t("telephony.vendorBody")}</p>
        </div>
      </div>

      {connected && (
        <>
          <div data-f="F-11-148 F-13-089 F-13-090">
            <SectionCard
              title={t("telephony.routesTitle")}
              description={t("telephony.routesSubtitle")}
              actions={
                <Button
                  size="sm"
                  leftIcon={<Plus aria-hidden />}
                  onClick={() => {
                    setRouteInput(emptyRouteInput());
                    setRouteOpen(true);
                  }}
                >
                  {t("telephony.addRoute")}
                </Button>
              }
            >
              {routesQ.isLoading ? (
                <Skeleton lines={2} />
              ) : !routesQ.data?.length ? (
                <EmptyState
                  compact
                  icon={<RouteIcon aria-hidden />}
                  title={t("telephony.noRoutes")}
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {routesQ.data.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-fg">
                          {r.name}
                        </span>
                        {r.isDefault && (
                          <Badge tone="neutral" size="sm">
                            {t("telephony.defaultRoute")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted">
                        {t("telephony.routeMeta", {
                          users: r.userIds.length,
                          locations: r.businessIds.length,
                        })}{" "}
                        ·{" "}
                        {t(
                          `telephony.historyStorage.${r.historyStorage}` as const,
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <div data-f="F-11-149 F-13-091">
            <SectionCard
              title={t("telephony.routingTitle")}
              description={t("telephony.routingSubtitle")}
              actions={
                <Button
                  size="sm"
                  leftIcon={<Plus aria-hidden />}
                  disabled={!routesQ.data?.length}
                  onClick={() => setRuleOpen(true)}
                >
                  {t("telephony.addRule")}
                </Button>
              }
            >
              {rulesQ.isLoading ? (
                <Skeleton lines={2} />
              ) : !rulesQ.data?.length ? (
                <EmptyState compact title={t("telephony.noRules")} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {rulesQ.data.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
                    >
                      <span className="font-mono text-sm text-fg">
                        {r.identifier}{" "}
                        <span className="text-xs text-muted">
                          ({t(`telephony.ruleKind.${r.kind}` as const)})
                        </span>
                      </span>
                      <span className="text-xs text-muted">
                        →{" "}
                        {routesQ.data?.find((rt) => rt.id === r.routeId)
                          ?.name ?? "—"}
                      </span>
                      <IconButton
                        icon={<Plus className="rotate-45" aria-hidden />}
                        variant="ghost"
                        size="sm"
                        label={t("telephony.ruleDelete")}
                        onClick={() => removeRule(r.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <div
            data-f="F-11-151"
            className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-fg"
          >
            <Bell className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <div>
              <p className="font-medium">{t("telephony.notifyTitle")}</p>
              <p className="mt-1 text-muted">{t("telephony.notifyBody")}</p>
            </div>
          </div>

          <div
            data-f="F-11-155"
            className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-fg"
          >
            <Wallet className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <div>
              <p className="font-medium">
                {t("telephony.perLocationBillingTitle")}
              </p>
              <p className="mt-1 text-muted">
                {t("telephony.perLocationBillingBody")}
              </p>
            </div>
          </div>

          <div
            data-f="F-11-152 F-13-098"
            className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-fg"
          >
            <Bell className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <div>
              <p className="font-medium">{t("telephony.troubleshootTitle")}</p>
              <p className="mt-1 text-muted">
                {t("telephony.troubleshootBody")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {lastAcceptedQ.data
                  ? t("telephony.lastAccepted", {
                      at: format.dateTime(lastAcceptedQ.data.at),
                    })
                  : t("telephony.lastAcceptedNone")}
              </p>
            </div>
          </div>

          <div data-f="F-11-150 F-13-092">
            <SectionCard title={t("telephony.callsTitle")}>
              {callsQ.isLoading ? (
                <Skeleton lines={3} />
              ) : (
                <Table
                  columns={callColumns}
                  rows={callsQ.data ?? []}
                  rowKey={(c) => c.id}
                  empty={<EmptyState compact title={t("telephony.noCalls")} />}
                />
              )}
            </SectionCard>
          </div>
        </>
      )}

      <Modal
        open={routeOpen}
        onOpenChange={setRouteOpen}
        title={t("telephony.addRoute")}
        size="md"
        footer={
          <Button
            loading={saveRouteMutation.isPending}
            onClick={saveRoute}
            className="w-full"
          >
            {t("telephony.save")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label={t("telephony.routeNameLabel")} required error={routeNameError}>
            <Input
              value={routeInput.name}
              onChange={(e) =>
                setRouteInput((p) => ({ ...p, name: e.target.value }))
              }
              autoFocus
            />
          </FormField>
          <FormField label={t("telephony.routeUsersLabel")}>
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
              {(usersQ.data ?? []).map((u) => (
                <li key={u.id}>
                  <Checkbox
                    checked={routeInput.userIds.includes(u.id)}
                    onCheckedChange={(v) =>
                      setRouteInput((p) => ({
                        ...p,
                        userIds: v
                          ? [...p.userIds, u.id]
                          : p.userIds.filter((id) => id !== u.id),
                      }))
                    }
                    label={u.name}
                  />
                </li>
              ))}
            </ul>
          </FormField>
          <FormField label={t("telephony.routeLocationsLabel")} required error={routeLocationsError}>
            <LocationsPicker
              locations={locationsQ.data ?? []}
              value={routeInput.businessIds}
              onChange={(v) => {
                setRouteLocationsError(undefined);
                setRouteInput((p) => ({ ...p, businessIds: v }));
              }}
            />
          </FormField>
          <FormField label={t("telephony.historyStorageLabel")}>
            <SegmentedControl
              options={HISTORY_STORAGE.map((v) => ({
                value: v,
                label: t(`telephony.historyStorage.${v}` as const),
              }))}
              value={routeInput.historyStorage}
              onValueChange={(v) =>
                setRouteInput((p) => ({
                  ...p,
                  historyStorage: v as NetworkCallHistoryStorage,
                }))
              }
            />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={ruleOpen}
        onOpenChange={setRuleOpen}
        title={t("telephony.addRule")}
        size="sm"
        footer={
          <Button
            loading={saveRuleMutation.isPending}
            onClick={saveRule}
            className="w-full"
          >
            {t("telephony.save")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label={t("telephony.ruleKindLabel")}>
            <SegmentedControl
              options={[
                { value: "phone", label: t("telephony.ruleKind.phone") },
                { value: "sip", label: t("telephony.ruleKind.sip") },
              ]}
              value={ruleKind}
              onValueChange={(v) => setRuleKind(v as "phone" | "sip")}
            />
          </FormField>
          <FormField
            label={t("telephony.ruleIdentifierLabel")}
            required
            hint={t("telephony.ruleDigitsOnly")}
            error={ruleError}
          >
            <Input
              className="font-mono"
              value={ruleIdentifier}
              onChange={(e) =>
                setRuleIdentifier(e.target.value.replace(/\D/g, ""))
              }
            />
          </FormField>
          <FormField label={t("telephony.ruleRouteLabel")} required>
            <Select
              value={ruleRouteId}
              onValueChange={(v) => setRuleRouteId(v as Id)}
              options={(routesQ.data ?? []).map((r) => ({
                value: r.id,
                label: r.name,
              }))}
              placeholder={t("telephony.ruleRoutePlaceholder")}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
