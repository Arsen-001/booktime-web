"use client";

/**
 * Карточка сотрудника → «Доступ» → «Вход по логину» (F-00-034, F-00-038). Владелец (право staff.manage) выдаёт
 * администратору логин и временный пароль, меняет логин и сбрасывает пароль. Пароль виден один раз — сразу после
 * выдачи, с копированием; сервер хранит только хеш. При первом входе администратор задаёт свой пароль
 * (mustChangePassword), сброс закрывает прежние входы по логину; вход по номеру телефона и коду не трогается.
 */
import { useState } from "react";
import { KeyRound, RefreshCw } from "lucide-react";
import type { StaffAccessData } from "@/api/staff";
import { IssueLoginModal, type IssueLoginMode } from "@/areas/staff/components/IssueLoginModal";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { SectionCard } from "@/ui/SectionCard";

export function PasswordLoginSection({ data }: { data: StaffAccessData }) {
  const t = useT("staff");
  const fmt = useFormat();
  const { staff, passwordLogin } = data;
  const [mode, setMode] = useState<IssueLoginMode | null>(null);

  return (
    <div data-f="F-00-034 F-00-038">
      <SectionCard title={t("passwordLogin.title")} description={t("passwordLogin.hint")}>
        {passwordLogin ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted">{t("passwordLogin.login")}</span>
              <span className="break-all font-mono text-base text-fg">{passwordLogin.login}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Badge tone={passwordLogin.mustChangePassword ? "warning" : "success"} className="w-fit">
                {t(passwordLogin.mustChangePassword ? "passwordLogin.statusMustChange" : "passwordLogin.statusOwn")}
              </Badge>
              <p className="text-sm text-muted">
                {passwordLogin.mustChangePassword
                  ? t("passwordLogin.statusMustChangeHint", { date: fmt.date(passwordLogin.issuedAt, "long") })
                  : passwordLogin.changedAt
                    ? t("passwordLogin.statusOwnHint", { date: fmt.date(passwordLogin.changedAt, "long") })
                    : t("passwordLogin.statusOwnNoDate")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" leftIcon={<RefreshCw aria-hidden />} onClick={() => setMode("reset")}>
                {t("passwordLogin.reset")}
              </Button>
              <Button variant="ghost" onClick={() => setMode("issue")}>
                {t("passwordLogin.changeLogin")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="text-sm text-muted">{t("passwordLogin.emptyText")}</p>
            <Button leftIcon={<KeyRound aria-hidden />} onClick={() => setMode("issue")}>
              {t("passwordLogin.issue")}
            </Button>
          </div>
        )}
      </SectionCard>

      {mode && (
        <IssueLoginModal
          key={mode}
          mode={mode}
          staffId={staff.id}
          staffName={staff.name}
          currentLogin={passwordLogin?.login ?? ""}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}
