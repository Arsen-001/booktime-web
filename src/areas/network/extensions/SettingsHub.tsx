"use client";

/**
 * Вклад раздела «network» в хаб настроек /biz/settings (хост «settingsHub») — F-11-022: «Принадлежность
 * к сети» локации — все сети, куда входит филиал, и какая из них главная (Business.networkId определяет
 * телефонию и баланс рассылок для этой локации, F-11-057).
 * Посмотреть вклад без хозяина хоста: /dev/ext/settingsHub/network
 */
import { Network as NetworkIcon } from "lucide-react";
import {
  listLocationNetworks,
  setMainNetworkForLocation,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import type { SettingsHubExtProps } from "@/extensions/types";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Button, LinkButton } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { SectionCard } from "@/ui/SectionCard";
import { SkeletonText } from "@/ui/Skeleton";
import { useSkeletonCount } from "@/ui/hooks/useSkeletonCount";
import { useToast } from "@/ui/Toast";

export default function NetworkSettingsHub({ businessId }: SettingsHubExtProps) {
  const t = useT("network");
  const toast = useToast();
  const q = useApiQuery(
    ["network", "locationNetworks", businessId],
    () => listLocationNetworks(businessId),
  );
  // Чаще всего локация ни в одной сети — тогда и при загрузке то же пустое состояние; иначе строки, как в прошлый раз
  const skeletonRows = useSkeletonCount("settingsHubNetworks", { loading: q.isLoading, count: q.data?.length, fallback: 0, max: 5 });
  const setMain = useApiMutation((networkId: string) =>
    setMainNetworkForLocation(businessId, networkId),
  );

  return (
    <div data-f="F-11-022">
      <SectionCard
        title={t("extensions.settingsHub.title")}
        description={t("extensions.settingsHub.description")}
      >
        {q.isLoading && skeletonRows > 0 ? (
          // Скелетон = те же строки сети: название, число компаний, метка «Основная»
          <ul aria-hidden className="flex flex-col gap-2">
            {Array.from({ length: skeletonRows }, (_, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg">
                    <SkeletonText width="14ch" />
                  </div>
                  <div className="text-xs text-muted">
                    <SkeletonText width="10ch" />
                  </div>
                </div>
                <Badge tone="accent" size="sm">
                  {t("extensions.settingsHub.mainNetwork")}
                </Badge>
              </li>
            ))}
          </ul>
        ) : !q.data?.length ? (
          <EmptyState
            compact
            icon={<NetworkIcon aria-hidden />}
            title={t("extensions.settingsHub.empty")}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {q.data.map((row) => (
              <li
                key={row.network.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg">
                    {row.network.name}
                  </div>
                  <div className="text-xs text-muted">
                    {t("extensions.settingsHub.companiesCount", {
                      count: row.locationsCount,
                    })}
                  </div>
                </div>
                {row.isMain ? (
                  <Badge tone="accent" size="sm">
                    {t("extensions.settingsHub.mainNetwork")}
                  </Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={setMain.isPending}
                    onClick={async () => {
                      try {
                        await setMain.mutate(row.network.id);
                        toast.success(t("extensions.settingsHub.mainSaved"));
                        q.refetch();
                      } catch {
                        toast.error(t("extensions.settingsHub.mainSaveFailed"));
                      }
                    }}
                  >
                    {t("extensions.settingsHub.makeMain")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <LinkButton
          href="/biz/network/settings"
          variant="ghost"
          size="sm"
          className="mt-3 w-fit"
        >
          {t("extensions.settingsHub.openSettings")}
        </LinkButton>
      </SectionCard>
    </div>
  );
}
