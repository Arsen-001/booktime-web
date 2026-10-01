"use client";

/**
 * «Разрешить доступ к локации только с IP-адресов» (F-10-091): дополнительный слой проверки —
 * сотрудник входит только из перечисленных сетей. Маска «/8», «/16» пропускает по началу адреса
 * (динамические адреса провайдера). Демо-«Проверить адрес» — своей настоящей проверки входа в
 * прототипе без бэкенда нет, поэтому подписано как демонстрация.
 */
import { useState } from "react";
import { ShieldAlert, Wifi } from "lucide-react";
import { checkIpAllowed, getIpRestriction, setIpRestriction } from "@/api/staff";
import { useApiMutation, useApiQuery } from "@/api/request";
import { isValidIpRange, parseIpRanges } from "@/domain/staff";
import type { Id } from "@/domain/core";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Collapse } from "@/ui/Collapse";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";
import { Switch } from "@/ui/Switch";
import { useToast } from "@/ui/Toast";

export interface IpRestrictionSectionProps {
  staffId: Id;
  canManage: boolean;
  /** Это карточка того, кто сейчас смотрит кабинет — предупредить перед включением (F-10-091 ❓ самозапрет) */
  isSelf: boolean;
}

export function IpRestrictionSection({ staffId, canManage, isSelf }: IpRestrictionSectionProps) {
  const t = useT("staff");
  const toast = useToast();
  const q = useApiQuery(["staff", "ipRestriction", staffId], () => getIpRestriction(staffId));
  const setM = useApiMutation(
    (args: { enabled: boolean; ranges: string[] }) => setIpRestriction(staffId, args),
  );
  const [enabledDraft, setEnabledDraft] = useState<boolean | null>(null);
  const [rangesTextDraft, setRangesTextDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkIp, setCheckIp] = useState("");
  const [checkResult, setCheckResult] = useState<boolean | null>(null);

  if (!q.data) return <Skeleton variant="rect" className="h-28 rounded-2xl" />;

  const enabled = enabledDraft ?? q.data.enabled;
  const rangesText = rangesTextDraft ?? q.data.ranges.join(", ");

  const save = async (nextEnabled: boolean) => {
    const ranges = parseIpRanges(rangesText);
    if (nextEnabled) {
      const bad = ranges.find((r) => !isValidIpRange(r));
      if (bad) {
        setError(t("accessTab.ipInvalid", { value: bad }));
        return;
      }
    }
    setError(null);
    try {
      await setM.mutate({ enabled: nextEnabled, ranges });
      setEnabledDraft(nextEnabled);
      toast.success(t("cardView.saved"));
      q.refetch();
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  const toggle = (v: boolean) => {
    if (v && isSelf) {
      setConfirmOpen(true);
      return;
    }
    void save(v);
  };

  const runCheck = async () => {
    if (!checkIp.trim()) return;
    const allowed = await checkIpAllowed(staffId, checkIp.trim());
    setCheckResult(allowed);
  };

  return (
    <SectionCard title={t("accessTab.ipTitle")} description={t("accessTab.ipHint")}>
      <div className="flex flex-col gap-4" data-f="F-10-091">
        <Switch
          checked={enabled}
          disabled={!canManage}
          onCheckedChange={toggle}
          label={t("accessTab.ipEnable")}
        />
        <Collapse open={enabled}>
          <div className="flex flex-col gap-4">
            <FormField
              label={t("accessTab.ipRanges")}
              hint={t("accessTab.ipRangesHint")}
              error={error ?? undefined}
            >
              <Input
                value={rangesText}
                onChange={(e) => {
                  setRangesTextDraft(e.target.value);
                  setError(null);
                }}
                onBlur={() => void save(true)}
                disabled={!canManage}
                placeholder="192.57.11.33, 192.57.11.33/16"
              />
            </FormField>
            <div className="flex flex-wrap items-end gap-2">
              <FormField label={t("accessTab.ipCheckLabel")} className="max-w-xs flex-1">
                <Input
                  value={checkIp}
                  onChange={(e) => {
                    setCheckIp(e.target.value);
                    setCheckResult(null);
                  }}
                  placeholder="192.57.11.33"
                />
              </FormField>
              <Button variant="outline" size="sm" leftIcon={<Wifi aria-hidden />} onClick={() => void runCheck()}>
                {t("accessTab.ipCheckButton")}
              </Button>
              {checkResult !== null && (
                <Badge tone={checkResult ? "success" : "danger"}>
                  {checkResult ? t("accessTab.ipCheckAllowed") : t("accessTab.ipCheckBlocked")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted">{t("accessTab.ipDemoNote")}</p>
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
        onConfirm={() => save(true)}
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
