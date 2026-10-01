"use client";

/**
 * /biz/network/switch — переключатель «Филиалы / Сети» (F-11-002, F-11-005). Постоянный вход из шапки
 * кабинета ещё не заказан фундаменту (см. qa/requests/network.md); пока — прямая ссылка.
 */
import {
  Building2,
  Network as NetworkIcon,
  Plus,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ensureNetwork,
  getNetworkBranchDailyStats,
  listMyBranches,
  listMyNetworks,
  softDeleteNetwork,
} from "@/api/network";
import { setLocationId, setNetworkId } from "@/demo/store";
import type { Id } from "@/domain/core";
import { useConfirm, useToast } from "@/ui/Toast";
import { removeFromList, useApiMutation, useApiQuery } from "@/api/request";
import { useCan, useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { today } from "@/lib/date";
import { Button, LinkButton } from "@/ui/Button";
import { AddBranchDialog } from "@/areas/network/lib/AddBranchDialog";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { IconButton } from "@/ui/IconButton";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";

export function SwitchScreen() {
  const t = useT("network");
  const router = useRouter();
  const format = useFormat();
  const { ready, staffId, businessId, businessIds } = useCurrent();
  // Владелец (network.manage) всегда имеет свою сеть, даже если ещё ни разу не открывал /biz/network
  // (F-11-001 «сеть есть у владельца всегда») — без этого «Сети» здесь ложно пустует (F-11-002/F-11-005).
  // Для admin/master (нет network.manage) сеть не создаём — им положено видеть «вас не добавили» (F-11-005).
  const canManage = useCan("network.manage");
  const confirm = useConfirm();
  // Удалённая сеть уходит из списка сразу (в т.ч. «своя» из ensureNetwork, которая в listMyNetworks уже не попадёт)
  const [removed, setRemoved] = useState<Id[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();
  const deleteMutation = useApiMutation((networkId: Id) => softDeleteNetwork(networkId), {
    optimistic: removeFromList(["network", "switch", "networks"], (networkId: Id) => networkId),
  });
  const branchesQ = useApiQuery(
    ["network", "switch", "branches", staffId],
    () => listMyBranches(staffId, businessIds),
    { enabled: ready },
  );
  const ensuredQ = useApiQuery(
    ["network", "switch", "ensured", businessId],
    () => ensureNetwork(businessId!),
    { enabled: ready && canManage && Boolean(businessId) },
  );
  const networksQ = useApiQuery(
    ["network", "switch", "networks", businessId, staffId, ensuredQ.data?.id],
    // F-11-005: сети, где человек владелец или пользователь сети, а не «куда входит мой салон»
    () => listMyNetworks(businessId, staffId),
    { enabled: ready },
  );
  // Не `ensuredQ.data!.id`: React Compiler по «!» считает ensuredQ.data не-null и выносит чтение поля в рендер.
  const ensuredId = ensuredQ.data?.id;
  // Своя сеть, заведённая ensureNetwork, уже есть в listMyNetworks (ключ зависит от ensuredId); удалённая —
  // не показывается и не заводится заново (решение владельца 01.10.2026)
  const networks = useMemo(
    () => (networksQ.data ?? []).filter((n) => !removed.includes(n.id)),
    [networksQ.data, removed],
  );
  const networksLoading =
    !ready || networksQ.isLoading || (canManage && ensuredQ.isLoading);
  const networksError = networksQ.isError || (canManage && ensuredQ.isError);
  const branchIds = (branchesQ.data ?? []).map((r) => r.business.id);
  // F-11-156: статистика каждого филиала за сегодня — для быстрого переключения в приложении для бизнеса
  const statsQ = useApiQuery(
    ["network", "branchDailyStats", branchIds, today()],
    () => getNetworkBranchDailyStats(branchIds, today()),
    { enabled: ready && branchIds.length > 0 },
  );

  const removeNetwork = async (networkId: Id) => {
    const ok = await confirm({
      title: t("settings.deleteConfirmTitle"),
      description: t("settings.deleteConfirmBody"),
      tone: "danger",
      confirmLabel: t("settings.deleteConfirmAction"),
    });
    if (!ok) return;
    try {
      setRemoved((ids) => [...ids, networkId]);
      await deleteMutation.mutate(networkId);
      toast.success(t("settings.deleteDone"));
    } catch {
      setRemoved((ids) => ids.filter((id) => id !== networkId));
      toast.error(t("switch.deleteFailed"));
    }
  };

  if (branchesQ.isError || networksError) {
    return (
      <ErrorState
        onRetry={() => {
          if (branchesQ.isError) branchesQ.refetch();
          if (networksQ.isError) networksQ.refetch();
          if (canManage && ensuredQ.isError) ensuredQ.refetch();
        }}
      />
    );
  }

  return (
    <div
      data-f="F-11-002"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t("switch.title")}
        description={t("switch.subtitle")}
      />

      <SectionCard
        title={t("switch.branches")}
        actions={
          canManage ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Plus aria-hidden />}
              onClick={() => setAddOpen(true)}
            >
              {t("switch.addBranch")}
            </Button>
          ) : undefined
        }
      >
        {!ready || branchesQ.isLoading ? (
          <Skeleton lines={2} />
        ) : !branchesQ.data?.length ? (
          <EmptyState
            compact
            icon={<Building2 aria-hidden />}
            title={t("switch.noBranches")}
          />
        ) : (
          <ul data-f="F-11-156" className="flex flex-col gap-2">
            {branchesQ.data.map(({ business, until }) => {
              const stat = statsQ.data?.find(
                (s) => s.businessId === business.id,
              );
              return (
                <li key={business.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // Сеть3: строка филиала выбирает его в шапке, потом ведёт в кабинет
                      const locationId = business.locationIds[0];
                      if (locationId) setLocationId(locationId);
                      router.push("/biz");
                    }}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-surface-2"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
                      <Building2 className="size-4" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 basis-32 flex-col">
                      <span className="truncate text-sm font-medium text-fg">
                        {business.name}
                      </span>
                      {until && (
                        <span className="text-xs text-muted">
                          {t("switch.until", { date: format.date(until) })}
                        </span>
                      )}
                    </span>
                    {stat && (
                      <span className="flex shrink-0 flex-col items-start sm:ml-auto sm:items-end">
                        <span className="num-headline text-base text-fg">
                          {format.money(stat.revenue)}
                        </span>
                        <span className="text-xs text-muted">
                          {t("switch.todayBookings", { count: stat.bookingsCount })}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <div data-f="F-11-005 F-11-021">
        <SectionCard
          title={t("switch.networks")}
          actions={
            canManage ? (
              <LinkButton
                href="/biz/network/new"
                variant="secondary"
                size="sm"
                leftIcon={<Plus aria-hidden />}
              >
                {t("switch.addNetwork")}
              </LinkButton>
            ) : undefined
          }
        >
          {networksLoading ? (
            <Skeleton lines={2} />
          ) : !networks.length ? (
            <EmptyState
              compact
              icon={<NetworkIcon aria-hidden />}
              title={t("switch.noNetworks")}
              description={t("switch.noNetworksHint")}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {networks.map((network) => (
                <li
                  key={network.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      // Сеть3: кабинет сети — «Все филиалы» в шапке
                      setLocationId("all");
                      // F-11-021: кабинет сети открывает именно эту сеть, а не первую
                      setNetworkId(network.id);
                      router.push(canManage ? "/biz/network" : "/biz");
                    }}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm font-medium text-fg"
                  >
                    <NetworkIcon
                      className="size-4 shrink-0 text-muted"
                      aria-hidden
                    />
                    <span className="truncate">{network.name}</span>
                  </button>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton
                        icon={<SettingsIcon aria-hidden />}
                        variant="ghost"
                        size="sm"
                        label={t("switch.networkSettings")}
                        onClick={() => router.push(`/biz/network/settings?net=${network.id}`)}
                      />
                      {/* Сеть13: корзина удаляет сеть (с подтверждением), а не просто открывает настройки */}
                      <IconButton
                        icon={<Trash2 aria-hidden />}
                        variant="ghost"
                        size="sm"
                        label={t("switch.deleteNetwork")}
                        onClick={() => void removeNetwork(network.id)}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <Button
        variant="ghost"
        onClick={() => router.push("/biz")}
        className="self-start"
      >
        {t("switch.close")}
      </Button>

      {/* Сеть13: тот же единственный вход «Добавить филиал», что и в настройках сети */}
      <AddBranchDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        networkId={ensuredId}
        staffId={staffId}
        onAdded={() => {
          branchesQ.refetch();
          networksQ.refetch();
        }}
      />
    </div>
  );
}
