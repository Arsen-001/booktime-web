"use client";

/**
 * Окно «Добавить пакет» (F-11-095): 2–10 сетевых услуг, режим оказания, филиалы.
 * Список услуг — все сетевые услуги (2+ филиала) текущей сети, кроме уже существующих пакетов.
 */
import { useState } from "react";
import { createNetworkPackage, listNetworkLocations, listServiceMigrationRows } from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useLocale } from "next-intl";
import { pickText } from "@/lib/text";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";
import { LocationsPicker } from "@/areas/network/lib/LocationsPicker";
import { useNetwork } from "@/areas/network/lib/useNetwork";

export function PackageFormModal({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useT("network");
  const locale = useLocale() as "ru" | "en" | "hy";
  const toast = useToast();
  const { networkId } = useNetwork();
  const rowsQ = useApiQuery(
    ["network", "servicesMigration", networkId],
    () => listServiceMigrationRows(networkId!),
    { enabled: open && Boolean(networkId) },
  );
  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: open && Boolean(networkId) },
  );
  const [name, setName] = useState("");
  const [itemKeys, setItemKeys] = useState<string[]>([]);
  const [mode, setMode] = useState<"parallel" | "sequentialSame" | "sequentialAny">("parallel");
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();

  const mutation = useApiMutation((_: void) =>
    createNetworkPackage(networkId!, {
      name: { ru: name.trim() },
      itemKeys,
      mode,
      businessIds,
    }),
  );

  const networkedServices = (rowsQ.data ?? []).filter((r) => r.availableIn.length >= 2);

  const toggleItem = (key: string, checked: boolean) => {
    setItemKeys((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
  };

  const save = async () => {
    if (!name.trim()) {
      setError(t("services.form.nameRequired"));
      return;
    }
    if (itemKeys.length < 2 || itemKeys.length > 10) {
      setError(t("services.package.itemsRangeError"));
      return;
    }
    if (!businessIds.length) {
      setError(t("services.form.locationsRequired"));
      return;
    }
    try {
      await mutation.mutate();
      toast.success(t("services.package.created"));
      setName("");
      setItemKeys([]);
      setBusinessIds([]);
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t("services.form.saveFailed"));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("services.package.formTitle")}
      size="md"
      footer={
        <Button loading={mutation.isPending} onClick={save} className="w-full">
          {t("services.form.save")}
        </Button>
      }
    >
      <div data-f="F-16-123" className="flex flex-col gap-4">
        <FormField label={t("services.package.nameLabel")} required error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </FormField>

        <FormField label={t("services.package.modeLabel")}>
          <SegmentedControl
            options={[
              { value: "parallel", label: t("services.package.modeParallel") },
              { value: "sequentialSame", label: t("services.package.modeSequentialSame") },
              { value: "sequentialAny", label: t("services.package.modeSequentialAny") },
            ]}
            value={mode}
            onValueChange={(v) => setMode(v as typeof mode)}
          />
        </FormField>

        <FormField label={t("services.package.itemsLabel", { count: itemKeys.length })}>
          {rowsQ.isLoading ? (
            <Skeleton lines={3} />
          ) : (
            <ul className="main-scrollbar flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
              {networkedServices.map((r) => {
                const key = r.service.name.ru || r.service.id;
                return (
                  <li key={r.service.id}>
                    <Checkbox
                      checked={itemKeys.includes(key)}
                      onCheckedChange={(checked) => toggleItem(key, checked)}
                      label={pickText(r.service.name, locale)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </FormField>

        <FormField label={t("services.form.locationsTitle")}>
          <LocationsPicker
            locations={locationsQ.data ?? []}
            value={businessIds}
            onChange={setBusinessIds}
          />
        </FormField>
      </div>
    </Modal>
  );
}
