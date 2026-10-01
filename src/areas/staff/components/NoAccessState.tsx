"use client";

/**
 * Экран «Доступ запрещён» (F-10-161, добавлено проверкой 2): без права `staff.view`/`staff.manage`
 * раздел скрыт из меню (nav.ts), но по прямой ссылке /biz/staff/** должен показать это, а не пустоту
 * или чужие данные. Показывает, к кому обратиться (владелец бизнеса).
 */
import { ShieldAlert } from "lucide-react";
import { useT } from "@/i18n/useT";
import { EmptyState } from "@/ui/EmptyState";

export function NoAccessState() {
  const t = useT("staff");
  return (
    <div data-f="F-10-161" className="px-1">
      <EmptyState
        variant="page"
        framed
        icon={<ShieldAlert aria-hidden />}
        title={t("noAccess.title")}
        description={t("noAccess.hint")}
      />
    </div>
  );
}
