"use client";

/**
 * /biz/network/new — создание сети из своих филиалов (F-11-014): название, отметка филиалов, выбор главного.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { listAddableLocations, createNetwork } from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { setNetworkId } from "@/demo/store";
import type { Id } from "@/domain/core";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { EmptyState } from "@/ui/EmptyState";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { PageHeader } from "@/ui/PageHeader";
import { Radio } from "@/ui/Radio";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";

export function NewNetworkScreen() {
  const t = useT("network");
  const router = useRouter();
  const toast = useToast();
  const { ready, staffId } = useCurrent();
  const q = useApiQuery(
    ["network", "addable", undefined, staffId],
    () => listAddableLocations(undefined, staffId),
    { enabled: ready },
  );
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Id[]>([]);
  const [mainId, setMainId] = useState<Id | undefined>(undefined);
  const [nameError, setNameError] = useState<string | undefined>();
  const [selectionError, setSelectionError] = useState<string | undefined>();
  const mutation = useApiMutation(createNetwork);

  const toggle = (id: Id) => {
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      if (!next.includes(mainId ?? "")) setMainId(next[0]);
      return next;
    });
  };

  const submit = async () => {
    const trimmed = name.trim();
    setNameError(trimmed ? undefined : t("newNetwork.nameRequired"));
    setSelectionError(
      selected.length ? undefined : t("newNetwork.selectionRequired"),
    );
    if (!trimmed || selected.length === 0 || !staffId) return;
    try {
      const network = await mutation.mutate({
        name: trimmed,
        businessIds: selected,
        mainBusinessId: mainId ?? selected[0],
        ownerStaffId: staffId,
      });
      toast.success(t("newNetwork.created"));
      // Новая сеть становится выбранной (F-11-021) и открываются её настройки
      setNetworkId(network.id);
      router.push(`/biz/network/settings?net=${network.id}`);
    } catch {
      toast.error(t("newNetwork.createFailed"));
    }
  };

  return (
    <div
      data-f="F-11-014"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t("newNetwork.title")}
        description={t("newNetwork.subtitle")}
        back={{ href: "/biz/network/switch" }}
      />

      <SectionCard title={t("newNetwork.nameLabel")}>
        <FormField label={t("newNetwork.nameLabel")} required error={nameError}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("newNetwork.namePlaceholder")}
            autoFocus
          />
        </FormField>
      </SectionCard>

      <SectionCard
        title={t("newNetwork.locationsLabel")}
        description={t("newNetwork.locationsHint")}
      >
        {!ready || q.isLoading ? (
          <Skeleton lines={3} />
        ) : !q.data?.length ? (
          <EmptyState compact title={t("newNetwork.noCandidates")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {q.data.map((business) => (
              <li
                key={business.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <Checkbox
                  checked={selected.includes(business.id)}
                  onCheckedChange={() => toggle(business.id)}
                  label={business.name}
                />
                {selected.includes(business.id) && (
                  <Radio
                    name="main-location"
                    checked={mainId === business.id}
                    onChange={() => setMainId(business.id)}
                    label={t("settings.mainLocation")}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {selectionError && (
          <p className="mt-2 text-sm text-danger">{selectionError}</p>
        )}
      </SectionCard>

      <Button
        loading={mutation.isPending}
        onClick={submit}
        className="self-start"
      >
        {t("newNetwork.save")}
      </Button>
    </div>
  );
}
