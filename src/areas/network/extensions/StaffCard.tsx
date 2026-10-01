"use client";

/**
 * Вклад раздела «network» в карточку сотрудника (хост «staffCard») — F-11-099: сетевого сотрудника
 * правят только в сети, в филиале — ссылка на сетевую карточку. Ждёт регистрации в
 * src/extensions/pairs.ts — qa/requests/network.md.
 * Посмотреть вклад без хозяина хоста: /dev/ext/staffCard/network
 */
import { Network as NetworkIcon } from "lucide-react";
import { getStaffNetworkInfo } from "@/api/network";
import { useApiQuery } from "@/api/request";
import type { StaffCardExtProps } from "@/extensions/types";
import { useT } from "@/i18n/useT";
import { LinkButton } from "@/ui/Button";
import { Skeleton } from "@/ui/Skeleton";

export default function NetworkStaffCard({ staffId }: StaffCardExtProps) {
  const t = useT("network");
  const infoQ = useApiQuery(
    ["network-staffcard", staffId],
    () => getStaffNetworkInfo(staffId),
    { enabled: Boolean(staffId) },
  );

  if (infoQ.isLoading) return <Skeleton lines={2} />;
  if (infoQ.isError || !infoQ.data) return null; // не сетевой сотрудник — вклад молчит

  const info = infoQ.data;

  return (
    <div
      data-f="F-11-099"
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-fg">
        <NetworkIcon size={16} aria-hidden />
        {t("extensions.staffCard.title")}
      </div>
      <p className="text-sm text-muted">
        {t("extensions.staffCard.body", { n: info.businessCount })}
      </p>
      <LinkButton
        href={`/biz/network/staff/${encodeURIComponent(info.key)}`}
        variant="ghost"
        size="sm"
        className="w-fit"
      >
        {t("extensions.staffCard.openInNetwork")}
      </LinkButton>
    </div>
  );
}
