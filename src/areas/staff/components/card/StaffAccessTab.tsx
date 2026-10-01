"use client";

/**
 * Карточка → «Доступ» (F-10-019 кнопка «Настроить права», F-10-020 приглашение, F-10-031 «Доступ в
 * систему», F-10-131 доступ ≠ аккаунт, F-10-053…061 роль-шаблон). Логин/телефон — только чтение, их
 * меняет сам сотрудник в личном кабинете; полный редактор прав — экран «Роли и права» (b04).
 */
import { useState } from "react";
import { ChevronDown, Check, Copy, Crown, RefreshCw, Settings2, XCircle } from "lucide-react";
import {
  StaffValidationError,
  getIpRestriction,
  getStaffAccess,
  inviteLinkFor,
  sendInviteForStaff,
  resendInviteForStaff,
  revokeInviteForStaff,
  setStaffAccessEnabled,
  setStaffAccessInfo,
  setStaffRoleTemplate,
} from "@/api/staff";
import { useApiMutation, useApiQuery } from "@/api/request";
import { IpRestrictionSection } from "@/areas/staff/components/IpRestrictionSection";
import { TransferOwnerModal } from "@/areas/staff/components/TransferOwnerModal";
import { PermissionsEditor } from "@/areas/staff/permissions/PermissionsEditor";
import {
  ADMIN_ROLE_TEMPLATES,
  roleTemplateLabel,
  type StaffRoleTemplateId,
} from "@/domain/staff";
import type { Id, StaffRole } from "@/domain/core";
import { useCurrent, useTerms } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Collapse } from "@/ui/Collapse";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { SectionCard } from "@/ui/SectionCard";
import { Switch } from "@/ui/Switch";
import { Textarea } from "@/ui/Textarea";
import { useToast } from "@/ui/Toast";

export interface StaffAccessTabProps {
  staffId: Id;
  canManage: boolean;
  /** «Изменить на «Информации»» — телефон для входа правится там (С14) */
  onOpenInfo: () => void;
}

function templatesFor(role: StaffRole): StaffRoleTemplateId[] {
  if (role === "owner") return ["owner"];
  if (role === "master") return ["specialist", "viewer"];
  return ADMIN_ROLE_TEMPLATES;
}

export function StaffAccessTab({ staffId, canManage, onOpenInfo }: StaffAccessTabProps) {
  const t = useT("staff");
  const toast = useToast();
  const current = useCurrent();
  const terms = useTerms();
  const [info, setInfo] = useState<string | null>(null);
  const [rightsOpen, setRightsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const accessQ = useApiQuery(["staff", "access", staffId], () =>
    getStaffAccess(staffId),
  );
  // М2: доступ по IP читаем тут же, параллельно — вкладка появляется одним куском, без второй заглушки
  const ipQ = useApiQuery(["staff", "ipRestriction", staffId], () => getIpRestriction(staffId));
  const [inviteTarget, setInviteTarget] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const sendInviteM = useApiMutation((a: { staffId: Id; target: string }) => sendInviteForStaff(a.staffId, a.target));
  const enableM = useApiMutation(
    (args: { staffId: Id; enabled: boolean }) =>
      setStaffAccessEnabled(args.staffId, args.enabled),
  );
  const infoM = useApiMutation(
    (args: { staffId: Id; info: string }) =>
      setStaffAccessInfo(args.staffId, args.info),
  );
  const roleM = useApiMutation(
    (args: { staffId: Id; roleTemplateId: StaffRoleTemplateId }) =>
      setStaffRoleTemplate(args.staffId, args.roleTemplateId),
  );
  const resendM = useApiMutation(resendInviteForStaff);
  const revokeInviteM = useApiMutation(revokeInviteForStaff);

  if (accessQ.isError) return <ErrorState onRetry={accessQ.refetch} />;
  if (!accessQ.data || (accessQ.data.access.enabled && !ipQ.data && !ipQ.isError))
    return (
      <div data-skeleton className="flex flex-col gap-5" aria-busy>
        <div className="flex flex-col gap-4 rounded-2xl border border-border p-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-80" />
          <Skeleton variant="rect" className="h-12 w-full rounded-xl" />
          <Skeleton variant="rect" className="h-16 w-full rounded-xl" />
          <Skeleton variant="rect" className="h-20 w-full rounded-xl" />
          <Skeleton variant="rect" className="h-16 w-full rounded-xl" />
        </div>
        <Skeleton variant="rect" className="h-28 rounded-2xl" />
      </div>
    );

  const { access, invite, staff } = accessQ.data;
  const roleId = access.roleTemplateId ?? "specialist";
  const options = templatesFor(staff.role);
  const noteValue = info ?? access.info ?? "";

  const toggle = async (enabled: boolean) => {
    try {
      await enableM.mutate({ staffId, enabled });
      toast.success(
        enabled ? t("accessTab.granted") : t("accessTab.revoked"),
      );
      accessQ.refetch();
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  const saveInfo = async () => {
    try {
      await infoM.mutate({ staffId, info: noteValue });
      toast.success(t("cardView.saved"));
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  const changeRole = async (id: StaffRoleTemplateId) => {
    try {
      await roleM.mutate({ staffId, roleTemplateId: id });
      toast.success(t("accessTab.roleChanged"));
      accessQ.refetch();
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  const copyLink = async () => {
    try {
      const link = await inviteLinkFor(staffId);
      await navigator.clipboard?.writeText(link);
      toast.success(t("accessTab.linkCopied"));
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  const resend = async () => {
    try {
      await resendM.mutate(staffId);
      toast.success(t("toast.inviteResent", { name: staff.name }));
      accessQ.refetch();
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  const sendInvite = async (target: string) => {
    setInviteError(null);
    try {
      await sendInviteM.mutate({ staffId, target });
      toast.success(t("accessTab.inviteSent", { target }));
      setInviteTarget(null);
    } catch (e) {
      if (e instanceof StaffValidationError) setInviteError(t("accessTab.inviteInvalid"));
      else toast.error(t("toast.actionFailed"));
    }
  };

  const revoke = async () => {
    try {
      await revokeInviteM.mutate(staffId);
      toast.success(t("accessTab.inviteRevoked"));
      accessQ.refetch();
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  if (staff.role === "owner") {
    return (
      <div data-f="F-10-031 F-00-037">
        <EmptyState compact title={t("accessTab.ownerHint")} />
      </div>
    );
  }

  return (
    <div
      data-f="F-10-031 F-10-131 F-10-063 F-10-064"
      className="flex flex-col gap-5"
    >
      {/* Ролевая модель «сотрудник + роль» одна на веб и приложение (F-10-063/064): другого экрана нет */}
      {/* F-00-041: права роли «Администратор» дают вести записи и связываться с клиентами — экраны журнала строит раздел journal */}
      <span data-f="F-00-041" hidden />
      {/* F-00-042: доступ мастера — приглашение по телефону, форма — AddStaffSheet (F-10-016) */}
      <span data-f="F-00-042" hidden />
      {/* F-11-037: роль «Колл-центр» — шаблон в списке ниже (templatesFor/ADMIN_ROLE_TEMPLATES),
          выдаётся сотруднику отдельно в каждой локации сети (роль — свойство доступа локации, не сети) */}
      <span data-f="F-11-037" hidden />
      {/* F-11-038: право «Доступ к данным клиентов по сети» — строка того же названия в группе
          «Окно записи» редактора прав ниже (permissions/catalog.ts, booking group, F-10-144) */}
      <span data-f="F-11-038" hidden />
      {/* F-09-084 (payroll, точечная правка по CONVENTIONS §1 «второй проход», qa/requests/payroll.md
          2026-09-26): шаблон роли «Бухгалтер» уже существует и выбирается в списке ниже (options =
          templatesFor(staff.role) → ROLE_TEMPLATE_COARSE.accountant, src/areas/staff/permissions/
          roleDefaults.ts) — набор прав открывает finance/payroll/reports/stock/billing и НЕ включает
          journal.* (весь раздел зарплаты, но не журнал записей). */}
      <span data-f="F-09-084" hidden />
      <SectionCard
        title={t("accessTab.title")}
        description={t("accessTab.hint")}
      >
        <div className="flex flex-col gap-4">
          <div data-f="F-00-040">
            <Switch
              checked={access.enabled}
              disabled={!canManage}
              onCheckedChange={(v) => void toggle(v)}
              label={t("accessTab.enable")}
              description={t("accessTab.enableHint")}
            />
          </div>

          {access.enabled && (
            <>
              <div className="flex flex-col gap-1.5" data-f="F-00-038">
                <FormField label={t("accessTab.loginPhone")} hint={t("accessTab.loginHint")} className="sm:max-w-sm">
                  <Input value={staff.phone || staff.email || "—"} disabled readOnly />
                </FormField>
                <button type="button" onClick={onOpenInfo} className="-mx-1 w-fit px-1 text-sm font-medium text-primary-text hover:underline">
                  {t("accessTab.openInfo")}
                </button>
              </div>

              <div
                className="flex flex-col gap-1.5"
                data-f="F-00-039 F-10-053 F-10-054 F-10-055 F-10-056 F-10-057 F-10-058 F-10-059 F-10-060 F-10-061"
              >
                <FormField label={t("accessTab.role")}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={roleId}
                      onValueChange={(v) =>
                        void changeRole(v as StaffRoleTemplateId)
                      }
                      disabled={!canManage}
                      options={options.map((id) => ({
                        value: id,
                        label: roleTemplateLabel(
                          id,
                          t(`roleTemplates.${id}.title` as never),
                          terms.master,
                        ),
                      }))}
                      className="sm:max-w-xs"
                      data-f="F-10-151"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Settings2 aria-hidden />}
                      rightIcon={
                        <ChevronDown
                          aria-hidden
                          className={rightsOpen ? "rotate-180" : ""}
                        />
                      }
                      onClick={() => setRightsOpen((v) => !v)}
                      aria-expanded={rightsOpen}
                    >
                      {t("accessTab.configureRights")}
                    </Button>
                  </div>
                </FormField>
                <p className="text-sm text-muted">
                  {t(`roleTemplates.${roleId}.description` as never)}
                </p>
              </div>

              <Collapse open={rightsOpen}>
                <div className="border-t border-border pt-4">
                  <PermissionsEditor
                    staffId={staffId}
                    businessId={staff.businessId}
                    staffName={staff.name}
                    roleTemplateId={roleId}
                    canManage={canManage}
                  />
                </div>
              </Collapse>

              <FormField label={t("accessTab.info")} optional>
                <Textarea
                  value={noteValue}
                  onChange={(e) => setInfo(e.target.value)}
                  onBlur={() => void saveInfo()}
                  disabled={!canManage}
                  rows={2}
                  placeholder={t("accessTab.infoPlaceholder")}
                />
              </FormField>
            </>
          )}
        </div>
      </SectionCard>

      {access.enabled && (
        <IpRestrictionSection
          staffId={staffId}
          canManage={canManage}
          isSelf={current.staffId === staffId}
        />
      )}

      {canManage && current.persona === "owner" && staff.role === "admin" && (
        <SectionCard title={t("transferOwner.sectionTitle")} description={t("transferOwner.sectionHint")}>
          <div data-f="F-10-149">
            <Button
              variant="outline"
              className="text-error hover:text-error"
              leftIcon={<Crown aria-hidden />}
              onClick={() => setTransferOpen(true)}
            >
              {t("transferOwner.action")}
            </Button>
          </div>
          <TransferOwnerModal
            open={transferOpen}
            onOpenChange={setTransferOpen}
            fromStaffId={current.staffId ?? ""}
            toStaffId={staffId}
            toStaffName={staff.name}
            onTransferred={() => accessQ.refetch()}
          />
        </SectionCard>
      )}

      {invite && invite.status === "pending" && (
        <div data-f="F-10-019 F-10-020">
        <SectionCard
          title={t("accessTab.inviteTitle")}
        >
          <div className="flex flex-col gap-3">
            <Badge tone="warning" className="w-fit">
              {t("status.invited")}
            </Badge>
            <p className="text-sm text-muted">
              {t("accessTab.inviteSentTo", {
                target: invite.email || invite.phone || "",
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                leftIcon={<RefreshCw aria-hidden />}
                onClick={() => void resend()}
                disabled={!canManage}
              >
                {t("row.resendInvite")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Copy aria-hidden />}
                onClick={() => void copyLink()}
              >
                {t("accessTab.copyLink")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-error hover:text-error"
                leftIcon={<XCircle aria-hidden />}
                onClick={() => void revoke()}
                disabled={!canManage}
              >
                {t("accessTab.revokeInvite")}
              </Button>
            </div>
          </div>
        </SectionCard>
        </div>
      )}

      {canManage && access.enabled && staff.status === "invited" && (!invite || invite.status === "revoked") && (
        <div data-f="F-10-019 F-10-020">
          <SectionCard title={t("accessTab.inviteTitle")} description={t("accessTab.noInvite")}>
            <form
              noValidate
              className="flex flex-col gap-3 sm:flex-row sm:items-start"
              onSubmit={(e) => {
                e.preventDefault();
                void sendInvite(inviteTarget ?? staff.phone ?? "");
              }}
            >
              <FormField label={t("accessTab.inviteTarget")} hint={t("accessTab.inviteTargetHint")} error={inviteError ?? undefined} className="flex-1">
                <Input
                  value={inviteTarget ?? staff.phone ?? ""}
                  onChange={(e) => {
                    setInviteTarget(e.target.value);
                    setInviteError(null);
                  }}
                  invalid={Boolean(inviteError)}
                  inputMode="tel"
                />
              </FormField>
              <Button type="submit" className="sm:mt-7" loading={sendInviteM.isPending}>
                {t("accessTab.inviteSend")}
              </Button>
            </form>
          </SectionCard>
        </div>
      )}

      {invite && invite.status === "accepted" && (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <Check aria-hidden className="h-4 w-4" />
          {t("accessTab.inviteAccepted")}
        </p>
      )}
    </div>
  );
}
