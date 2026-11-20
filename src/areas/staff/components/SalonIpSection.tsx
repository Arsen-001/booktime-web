"use client";

/**
 * «Вход только с IP салона» (F-10-091, ответ 22, вернули 20.11.2026) в карточке сотрудника → «Доступ».
 * Галочка — у сотрудника; адреса — общий список салона (для всех с галочкой). Сервер проверяет адрес на каждом запросе
 * кабинета: не с адреса салона — сотрудник видит «Вход закрыт: адрес не салона» (src/shell/biz/SalonIpGate.tsx), а здесь
 * появляется его попытка с кнопкой «Добавить этот адрес» — салон сменил интернет, владелец открывает вход одним нажатием.
 * «Добавить мой адрес» — тот же путь для владельца, который настраивает вход, находясь в салоне.
 */
import { useState } from "react";
import { ShieldAlert, Wifi } from "lucide-react";
import { SalonIpError, addSalonIp, setSalonIpOnly, setSalonIps } from "@/api/staff";
import { useApiMutation } from "@/api/request";
import { ipAllowedBy, isValidIpRange, normalizeIp, type SalonIpSettings } from "@/domain/staff";
import type { Id } from "@/domain/core";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Collapse } from "@/ui/Collapse";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { FormField } from "@/ui/FormField";
import { SectionCard } from "@/ui/SectionCard";
import { Switch } from "@/ui/Switch";
import { TagInput } from "@/ui/TagInput";
import { useToast } from "@/ui/Toast";

export interface SalonIpSectionProps {
  staffId: Id;
  businessId: Id;
  /** Галочка сотрудника (StaffAccessInfo.salonIpOnly) */
  enabled: boolean;
  /** Адреса салона и попытки; нет — список не читается (нет права staff.manage) */
  settings?: SalonIpSettings;
  canManage: boolean;
  /** Это карточка того, кто сейчас смотрит кабинет — предупредить перед включением (F-10-091 ❓ самозапрет) */
  isSelf: boolean;
}

export function SalonIpSection({ staffId, businessId, enabled, settings, canManage, isSelf }: SalonIpSectionProps) {
  const t = useT("staff");
  const f = useFormat();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const flagM = useApiMutation((v: boolean) => setSalonIpOnly(staffId, v));
  const listM = useApiMutation((ips: string[]) => setSalonIps(businessId, ips));
  const addM = useApiMutation((ip: string) => addSalonIp(businessId, ip));

  const ips = settings?.ips ?? [];
  const attempts = (settings?.attempts ?? []).filter((a) => a.staffId === staffId);
  const currentIp = settings?.currentIp ?? "";
  const currentAllowed = currentIp ? ipAllowedBy(ips, currentIp) : false;

  const saveFlag = async (v: boolean) => {
    try {
      await flagM.mutate(v);
      toast.success(t("cardView.saved"));
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  const toggle = (v: boolean) => {
    if (v && isSelf) {
      setConfirmOpen(true);
      return;
    }
    void saveFlag(v);
  };

  const saveList = async (next: string[]) => {
    const bad = next.map(normalizeIp).find((x) => !isValidIpRange(x));
    if (bad !== undefined) {
      setError(t("accessTab.ipInvalid", { value: bad }));
      return;
    }
    setError(null);
    try {
      await listM.mutate(next);
      toast.success(t("cardView.saved"));
    } catch (e) {
      if (e instanceof SalonIpError) setError(t("accessTab.ipInvalid", { value: e.value }));
      else toast.error(t("toast.actionFailed"));
    }
  };

  const add = async (ip: string) => {
    setAdding(ip);
    try {
      await addM.mutate(ip);
      toast.success(t("accessTab.ipAdded"));
    } catch {
      toast.error(t("toast.actionFailed"));
    } finally {
      setAdding(null);
    }
  };

  return (
    <SectionCard title={t("accessTab.ipTitle")} description={t("accessTab.ipHint")}>
      <div className="flex flex-col gap-4" data-f="F-10-091">
        <Switch
          checked={enabled}
          disabled={!canManage || flagM.isPending}
          onCheckedChange={toggle}
          label={t("accessTab.ipEnable")}
          description={t("accessTab.ipEnableHint")}
        />
        <Collapse open={enabled && Boolean(settings)}>
          <div className="flex flex-col gap-4">
            {attempts.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft/40 p-4" role="status">
                <div className="flex items-start gap-2">
                  <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{t("accessTab.ipAttemptsTitle")}</p>
                    <p className="text-xs text-muted">{t("accessTab.ipAttemptsHint")}</p>
                  </div>
                </div>
                <ul className="flex flex-col gap-2">
                  {attempts.map((a, i) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 text-sm text-fg">
                        {t("accessTab.ipAttemptLine", { when: f.dateTime(a.lastAt), ip: a.ip, count: a.attempts })}
                      </span>
                      {/* Главная кнопка — у последней попытки (скорее всего, это новый адрес салона), у прежних — обычные */}
                      <Button
                        size="sm"
                        variant={i === 0 ? "primary" : "outline"}
                        disabled={!canManage || (adding !== null && adding !== a.ip)}
                        loading={adding === a.ip}
                        onClick={() => void add(a.ip)}
                      >
                        {t("accessTab.ipAddThis")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <FormField
              label={t("accessTab.ipListLabel")}
              hint={ips.length ? t("accessTab.ipListHint") : t("accessTab.ipListEmpty")}
              error={error ?? undefined}
            >
              <TagInput
                value={ips}
                onValueChange={(next) => void saveList(next)}
                disabled={!canManage || listM.isPending}
                invalid={Boolean(error)}
                placeholder="37.252.64.10"
              />
            </FormField>

            {currentIp && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <Wifi aria-hidden className="size-4 shrink-0" />
                <span>{t("accessTab.ipCurrent", { ip: currentIp })}</span>
                {currentAllowed ? (
                  <Badge tone="success">{t("accessTab.ipCurrentAllowed")}</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canManage || (adding !== null && adding !== currentIp)}
                    loading={adding === currentIp}
                    onClick={() => void add(currentIp)}
                  >
                    {t("accessTab.ipAddCurrent")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </Collapse>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
        title={t("accessTab.ipSelfLockTitle")}
        description={t("accessTab.ipSelfLockDescription")}
        confirmLabel={t("accessTab.ipEnable")}
        onConfirm={() => saveFlag(true)}
      />
      {isSelf && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <ShieldAlert aria-hidden className="size-3.5 shrink-0" />
          {t("accessTab.ipSelfNote")}
        </p>
      )}
    </SectionCard>
  );
}
