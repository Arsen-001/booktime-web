"use client";

/** Строка сотрудника на телефоне (~72 px): аватар · имя и должность · телефон · роль/лицензия. */
import type { StaffListRow } from "@/api/staff";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";

export interface StaffMobileRowProps {
  row: StaffListRow;
}

export function StaffMobileRow({ row }: StaffMobileRowProps) {
  const t = useT("staff");
  const fmt = useFormat();
  const { staff, seat, positionLabel } = row;
  return (
    <div data-f="F-10-023 F-10-132" className="flex min-w-0 items-center gap-3">
      <Avatar
        name={staff.name}
        src={staff.avatarUrl}
        colorIndex={staff.colorIndex}
        size="md"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="truncate text-base font-semibold text-fg">
            {staff.name}
          </span>
          <span className="shrink-0 text-sm text-muted">
            {positionLabel || t("table.noPosition")}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="whitespace-nowrap text-sm text-muted tabular-nums">
            {staff.phone ? fmt.phone(staff.phone) : (staff.email ?? "—")}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {staff.status === "invited" && (
              <Badge tone="warning">{t("status.invited")}</Badge>
            )}
            {staff.status === "fired" && (
              <Badge tone="danger">{t("status.fired")}</Badge>
            )}
            {staff.status === "disabled" && (
              <Badge tone="warning">{t("status.disabled")}</Badge>
            )}
            <Badge tone={seat.paid ? "neutral" : "success"}>
              {seat.paid ? t("table.paid") : t("table.free")}
            </Badge>
          </span>
        </div>
      </div>
    </div>
  );
}
