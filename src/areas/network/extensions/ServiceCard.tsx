"use client";

/**
 * Вклад раздела «network» в карточку услуги (хост «serviceCard») — F-11-082/083: если услуга раздана
 * больше чем в один филиал сети, локально она только для чтения по тем полям, что заблокированы сетью
 * (цена и/или описание). Ждёт регистрации в src/extensions/pairs.ts — qa/requests/network.md.
 * Посмотреть вклад без хозяина хоста: /dev/ext/serviceCard/network
 */
import { Lock, Network as NetworkIcon } from "lucide-react";
import { getServiceNetworkInfo } from "@/api/network";
import { useApiQuery } from "@/api/request";
import type { ServiceCardExtProps } from "@/extensions/types";
import { useT } from "@/i18n/useT";
import { LinkButton } from "@/ui/Button";
import { Skeleton } from "@/ui/Skeleton";

export default function NetworkServiceCard({ mode, serviceId }: ServiceCardExtProps) {
  const t = useT("network");
  const infoQ = useApiQuery(
    ["network-servicecard", serviceId],
    () => getServiceNetworkInfo(serviceId!),
    { enabled: mode === "edit" && Boolean(serviceId) },
  );

  if (mode !== "edit" || !serviceId) return null;
  if (infoQ.isLoading) return <Skeleton lines={2} />;
  if (infoQ.isError || !infoQ.data) return null; // не сетевая услуга — вклад молчит

  const info = infoQ.data;
  if (!info.priceLocked && !info.descriptionLocked) return null;

  return (
    <div
      data-f="F-11-082"
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-fg">
        <NetworkIcon size={16} aria-hidden />
        {t("extensions.serviceCard.title")}
      </div>
      <p className="text-sm text-muted">
        {t("extensions.serviceCard.body", { n: info.businessCount })}
      </p>
      {info.priceLocked && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Lock size={14} aria-hidden />
          {t("extensions.serviceCard.priceLocked")}
        </p>
      )}
      {info.descriptionLocked && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Lock size={14} aria-hidden />
          {t("extensions.serviceCard.descriptionLocked")}
        </p>
      )}
      <LinkButton
        href={`/biz/network/services/${encodeURIComponent(info.key)}`}
        variant="ghost"
        size="sm"
        className="w-fit"
      >
        {t("extensions.serviceCard.openInNetwork")}
      </LinkButton>
    </div>
  );
}
