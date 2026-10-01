"use client";

/**
 * /biz/network/settings/fields — «Дополнительные поля» сети: для записи (F-11-127) и для клиента (F-11-128),
 * тип данных (F-11-129), доступность по локациям (F-11-130), показ в виджете (F-11-131), удаление словом (F-11-132)
 * и право просмотра (F-11-133).
 */
import { useState } from "react";
import { ListPlus, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import {
  deleteNetworkField,
  listNetworkFields,
  listNetworkLocations,
  saveNetworkField,
  type NetworkFieldInput,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCan } from "@/demo/hooks";
import type { Id } from "@/domain/core";
import type { NetworkField, NetworkFieldDataType } from "@/domain/network";
import { useT } from "@/i18n/useT";
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
import { SkeletonText } from "@/ui/Skeleton";
import { useSkeletonCount } from "@/ui/hooks/useSkeletonCount";
import { Switch } from "@/ui/Switch";
import { useToast } from "@/ui/Toast";
import { NetworkPageActions } from "@/areas/network/NetworkPageHelp";
import { LocationsPicker } from "@/areas/network/lib/LocationsPicker";
import { useNetwork } from "@/areas/network/lib/useNetwork";

type FieldTab = "booking" | "client";

const DATA_TYPES: NetworkFieldDataType[] = [
  "text",
  "number",
  "list",
  "date",
  "datetime",
];

function emptyInput(kind: FieldTab): NetworkFieldInput {
  return {
    kind,
    name: "",
    dataType: "text",
    apiKey: "",
    listOptions: [],
    editableByUser: true,
    showInAdmin: true,
    alwaysShowInBookingWindow: false,
    requiredOnCreate: false,
    requiredOnArrived: false,
    alwaysShowInClientCard: false,
    showInWidget: false,
    requiredInWidget: false,
    businessIds: [],
  };
}

const FIELD_ROW = "flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5";

export function FieldsScreen() {
  const t = useT("network");
  const toast = useToast();
  const canManage = useCan("network.manage");
  const { ready, networkId, isError, refetch } = useNetwork();
  const [tab, setTab] = useState<FieldTab>("booking");
  const q = useApiQuery(
    ["network", "fields", networkId, tab],
    () => listNetworkFields(networkId!, tab),
    { enabled: ready && Boolean(networkId) },
  );
  const loading = !ready || q.isLoading;
  const skeletonRows = useSkeletonCount(`networkFields-${tab}`, { loading, count: q.data?.length, fallback: 0, max: 20 });
  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NetworkField | null>(null);
  const [input, setInput] = useState<NetworkFieldInput>(emptyInput(tab));
  const [error, setError] = useState<string | undefined>();
  const [locationsError, setLocationsError] = useState<string | undefined>();
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<NetworkField | null>(null);
  const [deleteWord, setDeleteWord] = useState("");

  const formKey = open ? (editing?.id ?? `new-${tab}`) : null;
  if (formKey !== seenKey) {
    setInput(
      editing
        ? {
            kind: editing.kind,
            name: editing.name,
            dataType: editing.dataType,
            apiKey: editing.apiKey,
            listOptions: editing.listOptions,
            editableByUser: editing.editableByUser,
            showInAdmin: editing.showInAdmin,
            alwaysShowInBookingWindow: editing.alwaysShowInBookingWindow,
            requiredOnCreate: editing.requiredOnCreate,
            requiredOnArrived: editing.requiredOnArrived,
            alwaysShowInClientCard: editing.alwaysShowInClientCard,
            showInWidget: editing.showInWidget,
            requiredInWidget: editing.requiredInWidget,
            businessIds: editing.businessIds,
          }
        : emptyInput(tab),
    );
    setError(undefined);
    setSeenKey(formKey);
  }

  const saveMutation = useApiMutation((_: void) =>
    saveNetworkField(networkId!, input, editing?.id),
  );
  const deleteMutation = useApiMutation((id: Id) =>
    deleteNetworkField(networkId!, id),
  );

  if (isError || q.isError)
    return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (f: NetworkField) => {
    setEditing(f);
    setOpen(true);
  };

  const apiKeyValid = /^[a-zA-Z0-9._-]*$/.test(input.apiKey);

  const save = async () => {
    if (!input.name.trim()) {
      setError(t("settingsFields.nameRequired"));
      return;
    }
    if (!input.apiKey.trim() || !apiKeyValid) {
      setError(t("settingsFields.apiKeyInvalid"));
      return;
    }
    // F-11-130: в сети из нескольких филиалов поле должно действовать хотя бы в одном — иначе API отказывает молча
    if ((locationsQ.data?.length ?? 0) > 1 && !input.businessIds.length) {
      setLocationsError(t("settingsFields.locationsRequired"));
      return;
    }
    try {
      await saveMutation.mutate();
      toast.success(t("settingsFields.saved"));
      setOpen(false);
      q.refetch();
    } catch {
      toast.error(t("settingsFields.saveFailed"));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    if (
      deleteWord.trim().toUpperCase() !==
      t("settingsFields.deleteWord").toUpperCase()
    )
      return;
    await deleteMutation.mutate(deleting.id);
    toast.success(t("settingsFields.deleted"));
    setDeleting(null);
    setDeleteWord("");
    q.refetch();
  };

  const rows = q.data ?? [];

  return (
    <div
      data-f="F-11-126 F-11-127 F-11-128 F-11-129 F-11-130 F-11-131 F-11-132 F-11-133"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t("settingsFields.title")}
        description={t("settingsFields.subtitle")}
        actions={
          <NetworkPageActions
            titleKey="help.settingsFields.title"
            bodyKey="help.settingsFields.body"
            extra={
              canManage ? (
                <Button
                  size="sm"
                  leftIcon={<Plus aria-hidden />}
                  onClick={openNew}
                >
                  {t("settingsFields.add")}
                </Button>
              ) : undefined
            }
          />
        }
      />
      <SectionCard title={t("settingsFields.tabsTitle")}>
        <SegmentedControl
          options={[
            { value: "booking", label: t("settingsFields.tabBooking") },
            { value: "client", label: t("settingsFields.tabClient") },
          ]}
          value={tab}
          onValueChange={(v) => setTab(v as FieldTab)}
        />
        {tab === "booking" && (rows.length > 0 || (loading && skeletonRows > 0)) && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <Pin className="size-3.5 shrink-0 text-border-strong" aria-hidden />
            {t("settingsFields.pinnedHint")}
          </p>
        )}
        <div className="mt-4">
          {loading && skeletonRows > 0 ? (
            // Скелетон = те же строки поля: название, тип, ключ API, скрепка, кнопки
            <ul aria-hidden className="flex flex-col gap-2">
              {Array.from({ length: skeletonRows }, (_, i) => (
                <li key={i} className={FIELD_ROW}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">
                      <SkeletonText width={i % 2 ? "12ch" : "16ch"} />
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral" size="sm">
                        <SkeletonText width="6ch" />
                      </Badge>
                      <span className="font-mono text-xs text-muted">
                        <SkeletonText width="10ch" />
                      </span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <IconButton icon={<Pencil aria-hidden />} variant="ghost" size="sm" label={t("settingsFields.editTitle")} disabled />
                      <IconButton icon={<Trash2 aria-hidden />} variant="ghost" size="sm" label={t("settingsFields.deleteAction")} disabled />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : !rows.length ? (
            <EmptyState
              icon={<ListPlus aria-hidden />}
              compact
              title={
                tab === "booking"
                  ? t("settingsFields.emptyBooking")
                  : t("settingsFields.emptyClient")
              }
              description={t("settingsFields.emptyHint")}
              action={
                canManage ? (
                  <Button
                    size="sm"
                    leftIcon={<Plus aria-hidden />}
                    onClick={openNew}
                  >
                    {t("settingsFields.add")}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((f) => (
                <li key={f.id} className={FIELD_ROW}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">
                      {f.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral" size="sm">
                        {t(`settingsFields.dataType.${f.dataType}` as const)}
                      </Badge>
                      <span className="font-mono text-xs text-muted">
                        {f.apiKey}
                      </span>
                      {f.showInWidget && (
                        <Badge tone="accent" size="sm">
                          {t("settingsFields.widgetBadge")}
                        </Badge>
                      )}
                      <span
                        data-f="F-11-134"
                        className="flex items-center gap-1 text-xs text-muted"
                      >
                        <Pin
                          className={
                            f.alwaysShowInBookingWindow
                              ? "size-3.5 fill-muted text-muted"
                              : "size-3.5 text-border-strong"
                          }
                          aria-hidden
                        />
                        {f.alwaysShowInBookingWindow &&
                          t("settingsFields.pinnedBadge")}
                      </span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <IconButton
                        icon={<Pencil aria-hidden />}
                        variant="ghost"
                        size="sm"
                        label={t("settingsFields.editTitle")}
                        onClick={() => openEdit(f)}
                      />
                      <IconButton
                        icon={<Trash2 aria-hidden />}
                        variant="ghost"
                        size="sm"
                        label={t("settingsFields.deleteAction")}
                        onClick={() => setDeleting(f)}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={
          editing
            ? t("settingsFields.editTitle")
            : tab === "booking"
              ? t("settingsFields.newBookingTitle")
              : t("settingsFields.newClientTitle")
        }
        size="md"
        footer={
          <Button
            loading={saveMutation.isPending}
            onClick={save}
            className="w-full"
          >
            {t("settingsFields.save")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField
            label={t("settingsFields.nameLabel")}
            required
            error={error}
          >
            <Input
              value={input.name}
              onChange={(e) =>
                setInput((p) => ({ ...p, name: e.target.value }))
              }
              autoFocus
            />
          </FormField>
          <FormField label={t("settingsFields.dataTypeLabel")}>
            <SegmentedControl
              options={DATA_TYPES.map((dt) => ({
                value: dt,
                label: t(`settingsFields.dataType.${dt}` as const),
              }))}
              value={input.dataType}
              onValueChange={(v) =>
                setInput((p) => ({
                  ...p,
                  dataType: v as NetworkFieldDataType,
                  showInWidget: v === "datetime" ? false : p.showInWidget,
                }))
              }
            />
          </FormField>
          {input.dataType === "list" && (
            <FormField
              label={t("settingsFields.listOptionsLabel")}
              hint={t("settingsFields.listOptionsHint")}
            >
              <Input
                value={input.listOptions.join(", ")}
                onChange={(e) =>
                  setInput((p) => ({
                    ...p,
                    listOptions: e.target.value.split(","),
                  }))
                }
              />
            </FormField>
          )}
          <FormField
            label={t("settingsFields.apiKeyLabel")}
            required
            hint={t("settingsFields.apiKeyHint")}
            error={
              input.apiKey && !apiKeyValid
                ? t("settingsFields.apiKeyInvalid")
                : undefined
            }
          >
            <Input
              className="font-mono"
              value={input.apiKey}
              onChange={(e) =>
                setInput((p) => ({ ...p, apiKey: e.target.value }))
              }
            />
          </FormField>
          <Switch
            checked={input.editableByUser}
            onCheckedChange={(v) =>
              setInput((p) => ({ ...p, editableByUser: v }))
            }
            label={t("settingsFields.editableLabel")}
          />
          <Switch
            checked={input.showInAdmin}
            onCheckedChange={(v) => setInput((p) => ({ ...p, showInAdmin: v }))}
            label={t("settingsFields.showInAdminLabel")}
          />
          {input.showInAdmin && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <Checkbox
                checked={input.alwaysShowInBookingWindow}
                onCheckedChange={(v) =>
                  setInput((p) => ({ ...p, alwaysShowInBookingWindow: v }))
                }
                label={t("settingsFields.alwaysShowLabel")}
              />
              <Checkbox
                checked={input.requiredOnCreate}
                onCheckedChange={(v) =>
                  setInput((p) => ({ ...p, requiredOnCreate: v }))
                }
                label={t("settingsFields.requiredOnCreateLabel")}
              />
              <Checkbox
                checked={input.requiredOnArrived}
                onCheckedChange={(v) =>
                  setInput((p) => ({ ...p, requiredOnArrived: v }))
                }
                label={t("settingsFields.requiredOnArrivedLabel")}
              />
              {tab === "client" && (
                <Checkbox
                  checked={input.alwaysShowInClientCard}
                  onCheckedChange={(v) =>
                    setInput((p) => ({ ...p, alwaysShowInClientCard: v }))
                  }
                  label={t("settingsFields.alwaysShowInClientCardLabel")}
                />
              )}
            </div>
          )}
          {input.dataType !== "datetime" && (
            <>
              <Switch
                checked={input.showInWidget}
                onCheckedChange={(v) =>
                  setInput((p) => ({
                    ...p,
                    showInWidget: v,
                    requiredInWidget: v ? p.requiredInWidget : false,
                  }))
                }
                label={t("settingsFields.showInWidgetLabel")}
              />
              {input.showInWidget && (
                <Checkbox
                  checked={input.requiredInWidget}
                  onCheckedChange={(v) =>
                    setInput((p) => ({ ...p, requiredInWidget: v }))
                  }
                  label={t("settingsFields.requiredInWidgetLabel")}
                />
              )}
            </>
          )}
          <FormField label={t("settingsFields.locationsLabel")} error={locationsError}>
            <LocationsPicker
              locations={locationsQ.data ?? []}
              value={input.businessIds}
              onChange={(v) => {
                setLocationsError(undefined);
                setInput((p) => ({ ...p, businessIds: v }));
              }}
            />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onOpenChange={(o) => {
          if (!o) {
            setDeleting(null);
            setDeleteWord("");
          }
        }}
        title={t("settingsFields.deleteConfirmTitle")}
        size="sm"
        footer={
          <Button
            variant="danger"
            disabled={
              deleteWord.trim().toUpperCase() !==
              t("settingsFields.deleteWord").toUpperCase()
            }
            loading={deleteMutation.isPending}
            onClick={confirmDelete}
            className="w-full"
          >
            {t("settingsFields.deleteAction")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-fg">
            {t("settingsFields.deleteConfirmBody", {
              name: deleting?.name ?? "",
            })}
          </p>
          <FormField
            label={t("settingsFields.deleteWordLabel", {
              word: t("settingsFields.deleteWord"),
            })}
          >
            <Input
              value={deleteWord}
              onChange={(e) => setDeleteWord(e.target.value)}
              autoFocus
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
