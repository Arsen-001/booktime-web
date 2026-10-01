"use client";

/**
 * Сеть13: один вход «Добавить филиал» для кабинета сети — окно с двумя путями: завести новый салон (онбординг
 * /biz/onboarding, тот же, что у «Добавить филиал» в переключателе) или подключить к сети уже свой салон.
 * Раньше было три разных входа (переключатель → онбординг, настройки салона, окно настроек сети) с разным итогом.
 */
import { Building2, Plus } from "lucide-react";
import { addLocationToNetwork, listAddableLocations } from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import type { Id } from "@/domain/core";
import { useT } from "@/i18n/useT";
import { Button, LinkButton } from "@/ui/Button";
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
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{t("addBranch.newTitle")}</p>
            <p className="text-xs text-muted">{t("addBranch.newHint")}</p>
          </div>
          <LinkButton href="/biz/onboarding" size="sm" leftIcon={<Plus aria-hidden />} className="shrink-0">
            {t("addBranch.newAction")}
          </LinkButton>
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
