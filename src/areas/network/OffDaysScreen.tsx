"use client";

/**
 * /biz/network/staff/off-days — типы нерабочих дней сети (F-11-108): системные + свои.
 */
import { useState } from "react";
import { CalendarOff, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteNetworkOffDayType,
  listNetworkLocations,
  listNetworkOffDayTypes,
  saveNetworkOffDayType,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import type { Id } from "@/domain/core";
import type { NetworkOffDayType } from "@/domain/network";
import { Badge } from "@/ui/Badge";
import { Button, LinkButton } from "@/ui/Button";
import { ColorSwatch } from "@/ui/ColorSwatch";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { PageHeader } from "@/ui/PageHeader";
import { Skeleton } from "@/ui/Skeleton";
import { Textarea } from "@/ui/Textarea";
import { useConfirm, useToast } from "@/ui/Toast";
import { LocationsPicker } from "@/areas/network/lib/LocationsPicker";
import { useNetwork } from "@/areas/network/lib/useNetwork";

const COLOR_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8];

export function OffDaysScreen() {
  const t = useT("network");
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, networkId, isError, refetch } = useNetwork();
  const q = useApiQuery(
    ["network", "offDayTypes", networkId],
    () => listNetworkOffDayTypes(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NetworkOffDayType | null>(null);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [colorIndex, setColorIndex] = useState(COLOR_INDEXES[0]);
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [seenFormKey, setSeenFormKey] = useState<string | null>(null);

  const formKey = open ? (editing?.id ?? "new") : null;
  if (formKey !== seenFormKey) {
    setName(editing?.name ?? "");
    setComment(editing?.comment ?? "");
    setColorIndex(editing?.colorIndex ?? COLOR_INDEXES[0]);
    setBusinessIds(
      editing ? editing.businessIds : (locationsQ.data ?? []).map((l) => l.business.id),
    );
    setError(undefined);
    setSeenFormKey(formKey);
  }

  const saveMutation = useApiMutation((_: void) =>
    saveNetworkOffDayType(
      networkId!,
      { name: name.trim(), comment: comment.trim() || undefined, colorIndex, businessIds },
      editing?.id,
    ),
  );
  const deleteMutation = useApiMutation((id: Id) => deleteNetworkOffDayType(networkId!, id));

  if (isError || q.isError)
    return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const save = async () => {
    if (!name.trim()) {
      setError(t("staff.offDays.nameRequired"));
      return;
    }
    try {
      await saveMutation.mutate();
      toast.success(t("staff.offDays.saved"));
      setOpen(false);
      q.refetch();
    } catch {
      toast.error(t("staff.offDays.saveFailed"));
    }
  };

  const remove = async (item: NetworkOffDayType) => {
    if (item.system) {
      toast.error(t("staff.offDays.deleteSystemError"));
      return;
    }
    const ok = await confirm({
      title: t("staff.offDays.deleteConfirmTitle"),
      description: t("staff.offDays.deleteConfirmBody"),
      tone: "danger",
    });
    if (!ok) return;
    await deleteMutation.mutate(item.id);
    toast.success(t("staff.offDays.deleted"));
    q.refetch();
  };

  return (
    <div
      data-f="F-11-108 F-10-143 F-02-011"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t("staff.offDays.title")}
        description={t("staff.offDays.subtitle")}
        actions={
          <Button
            size="sm"
            leftIcon={<Plus aria-hidden />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            {t("staff.offDays.add")}
          </Button>
        }
      />
      <LinkButton href="/biz/network/staff" variant="ghost" size="sm" className="w-fit">
        ← {t("staff.title")}
      </LinkButton>

      {!ready || q.isLoading ? (
        <Skeleton lines={4} />
      ) : !q.data?.length ? (
        <EmptyState icon={<CalendarOff aria-hidden />} title={t("staff.offDays.empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {q.data.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <ColorSwatch colorIndex={item.colorIndex} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                {item.name}
              </span>
              {item.system && (
                <Badge tone="neutral" size="sm">
                  {t("staff.offDays.systemBadge")}
                </Badge>
              )}
              <IconButton
                icon={<Pencil aria-hidden />}
                variant="ghost"
                size="sm"
                label={t("staff.offDays.editTitle")}
                onClick={() => {
                  setEditing(item);
                  setOpen(true);
                }}
              />
              {!item.system && (
                <IconButton
                  icon={<Trash2 aria-hidden />}
                  variant="ghost"
                  size="sm"
                  label={t("staff.offDays.deleteConfirmTitle")}
                  onClick={() => remove(item)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? t("staff.offDays.editTitle") : t("staff.offDays.newTitle")}
        size="sm"
        footer={
          <Button loading={saveMutation.isPending} onClick={save} className="w-full">
            {t("staff.offDays.save")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label={t("staff.offDays.nameLabel")} required error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </FormField>
          <FormField label={t("staff.offDays.commentLabel")} optional>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </FormField>
          <FormField label={t("staff.offDays.colorLabel")}>
            <div className="flex flex-wrap gap-2">
              {COLOR_INDEXES.map((i) => (
                <ColorSwatch
                  key={i}
                  colorIndex={i}
                  selected={colorIndex === i}
                  size="md"
                  onClick={() => setColorIndex(i)}
                  label={String(i)}
                />
              ))}
            </div>
          </FormField>
          <FormField label={t("staff.offDays.locationsTitle")}>
            <LocationsPicker
              locations={locationsQ.data ?? []}
              value={businessIds}
              onChange={setBusinessIds}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
