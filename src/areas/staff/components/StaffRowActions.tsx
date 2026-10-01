"use client";

/**
 * Меню «⋯» строки сотрудника (F-10-012), одинаковое на компьютере и телефоне (С6). Порядок меняется
 * перетаскиванием в самой таблице (С1) — «Выше/Ниже» здесь больше нет; «Удалить навсегда» живёт только в архиве (С4).
 */
import {
  CalendarX2,
  MoreHorizontal,
  RefreshCw,
  ShieldOff,
  UserCog,
  UserMinus,
} from "lucide-react";
import type { StaffListRow } from "@/api/staff";
import { useT } from "@/i18n/useT";
import { IconButton } from "@/ui/IconButton";
import { DropdownMenu, type DropdownMenuItem } from "@/ui/DropdownMenu";

export interface StaffRowActionsProps {
  row: StaffListRow;
  canManage: boolean;
  onFire: (row: StaffListRow) => void;
  onCancelDismissal: (row: StaffListRow) => void;
  onRevokeAccess: (row: StaffListRow) => void;
  onResendInvite: (row: StaffListRow) => void;
  onTransferAccess: (row: StaffListRow) => void;
}

export function StaffRowActions({
  row,
  canManage,
  onFire,
  onCancelDismissal,
  onRevokeAccess,
  onResendInvite,
  onTransferAccess,
}: StaffRowActionsProps) {
  const t = useT("staff");
  if (!canManage || row.staff.role === "owner" || row.staff.status === "fired") return null;

  const items: DropdownMenuItem[] = [];
  if (row.staff.status === "invited") {
    items.push({
      id: "resend",
      label: t("row.resendInvite"),
      icon: <RefreshCw aria-hidden />,
      onSelect: () => onResendInvite(row),
    });
  }
  if (row.staff.status === "active" && (row.staff.login || row.staff.role === "master")) {
    items.push({
      id: "revoke",
      label: t("row.revokeAccess"),
      icon: <ShieldOff aria-hidden />,
      onSelect: () => onRevokeAccess(row),
    });
  }
  items.push({
    id: "transfer",
    label: t("row.transferAccess"),
    icon: <UserCog aria-hidden />,
    onSelect: () => onTransferAccess(row),
  });
  items.push({ id: "sep", separator: true });
  if (row.dismissal?.scheduled) {
    items.push({
      id: "cancelDismissal",
      label: t("row.cancelDismissal"),
      icon: <CalendarX2 aria-hidden />,
      onSelect: () => onCancelDismissal(row),
    });
  } else {
    items.push({
      id: "fire",
      label: t("row.fire"),
      icon: <UserMinus aria-hidden />,
      onSelect: () => onFire(row),
      danger: true,
    });
  }

  return (
    <span data-f="F-10-012 F-10-045" onClick={(e) => e.stopPropagation()} className="inline-flex">
      <DropdownMenu
        trigger={(p) => (
          <IconButton
            icon={<MoreHorizontal aria-hidden />}
            label={t("row.menu")}
            variant="ghost"
            size="sm"
            {...p}
          />
        )}
        items={items}
        align="end"
        label={row.staff.name}
      />
    </span>
  );
}
