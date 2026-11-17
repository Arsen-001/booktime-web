"use client";

/**
 * Сеть13: один вход «Добавить филиал» для кабинета сети — окно с двумя путями: завести новый филиал или подключить
 * к сети уже свой салон. Владелец 17.11.2026 (ответ 31): «Новый филиал» — одним шагом прямо здесь (название и адрес),
 * без повторной анкеты регистрации и без второго шага «Уже ваш салон» (было: /register-business, потом подключение).
 */
import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { addLocationToNetwork, createNetworkBranch, listAddableLocations } from "@/api/network";
import { SESSION_KEY } from "@/api/session";
import { useApiMutation, useApiQuery } from "@/api/request";
import { DISTRICT_IDS } from "@/config/districts";
import type { DistrictId, Id } from "@/domain/core";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { EmptyState } from "@/ui/EmptyState";
import { Modal } from "@/ui/Modal";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";

export interface AddBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networkId: Id | undefined;
  staffId: Id | undefined;
  /** Салон подключён к сети — экран перечитывает свои списки */
  onAdded?: () => void;
}

export function AddBranchDialog({ open, onOpenChange, networkId, staffId, onAdded }: AddBranchDialogProps) {
  const t = useT("network");
  const toast = useToast();
  const addableQ = useApiQuery(["network", "addable", networkId, staffId], () => listAddableLocations(networkId, staffId), {
    enabled: open && Boolean(networkId),
  });
  const addMutation = useApiMutation((businessId: Id) => addLocationToNetwork(networkId!, businessId));
  const tc = useT("common");
  const [branchName, setBranchName] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState<DistrictId>(DISTRICT_IDS[0]);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  // Новый бизнес-филиал виден в «кто я» после перечитывания сессии (членства)
  const createMutation = useApiMutation(
    (_: void) => createNetworkBranch(networkId!, { name: branchName, address, district }),
    { invalidates: [SESSION_KEY] },
  );
  const createBranch = async () => {
    if (!branchName.trim()) {
      setNameError(t("addBranch.nameRequired"));
      return;
    }
    try {
      await createMutation.mutate(undefined);
      toast.success(t("addBranch.created"));
      setBranchName("");
      setAddress("");
      onAdded?.();
      onOpenChange(false);
    } catch {
      toast.error(t("addBranch.failed"));
    }
  };

  const add = async (businessId: Id) => {
    try {
      await addMutation.mutate(businessId);
      toast.success(t("settings.addDone"));
      onAdded?.();
      onOpenChange(false);
    } catch {
      toast.error(t("addBranch.failed"));
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("addBranch.title")} description={t("addBranch.subtitle")} size="md">
      <div data-f="F-11-008 F-11-039" className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{t("addBranch.newTitle")}</p>
            <p className="text-xs text-muted">{t("addBranch.newHint")}</p>
          </div>
          <FormField label={t("addBranch.nameLabel")} error={nameError}>
            <Input
              value={branchName}
              onChange={(e) => {
                setBranchName(e.target.value);
                setNameError(undefined);
              }}
              placeholder={t("addBranch.namePlaceholder")}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={t("addBranch.addressLabel")} optional>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </FormField>
            <FormField label={t("addBranch.districtLabel")}>
              <Select
                value={district}
                onValueChange={(v) => setDistrict(v as DistrictId)}
                options={DISTRICT_IDS.map((d) => ({ value: d, label: tc(`districts.${d}`) }))}
              />
            </FormField>
          </div>
          <Button size="sm" leftIcon={<Plus aria-hidden />} className="self-end" loading={createMutation.isPending} onClick={() => void createBranch()}>
            {t("addBranch.newAction")}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-fg">{t("addBranch.existingTitle")}</p>
          {addableQ.isLoading ? (
            <Skeleton lines={2} />
          ) : !addableQ.data?.length ? (
            <EmptyState compact icon={<Building2 aria-hidden />} title={t("settings.noAddable")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {addableQ.data.map((business) => (
                <li key={business.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="truncate text-sm text-fg">{business.name}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={addMutation.isPending}
                    onClick={() => void add(business.id)}
                  >
                    {t("settings.addAction")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
