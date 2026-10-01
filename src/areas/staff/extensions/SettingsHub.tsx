"use client";

/**
 * Вклад раздела «staff» в хаб настроек /biz/settings (хост «settingsHub»): запрет домашних записей
 * в часы смены (⭐ F-00-047) и карточка «Где хранятся ваши данные» (F-10-154). Посмотреть вклад без
 * хозяина хоста: /dev/ext/settingsHub/staff
 */
import { useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import {
  getBusinessSecuritySettings,
  setBlockHomeVisitDuringShift,
} from "@/api/staff";
import { useApiMutation, useApiQuery } from "@/api/request";
import type { SettingsHubExtProps } from "@/extensions/types";
import { useT } from "@/i18n/useT";
import { Modal } from "@/ui/Modal";
import { SectionCard } from "@/ui/SectionCard";
import { Switch } from "@/ui/Switch";
import { useToast } from "@/ui/Toast";

export default function StaffSettingsHub({ businessId }: SettingsHubExtProps) {
  const t = useT("staff");
  const toast = useToast();
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const q = useApiQuery(["staff", "securitySettings", businessId], () =>
    getBusinessSecuritySettings(businessId),
  );
  const setM = useApiMutation((value: boolean) =>
    setBlockHomeVisitDuringShift(businessId, value),
  );

  const toggle = async (value: boolean) => {
    try {
      await setM.mutate(value);
      toast.success(t("cardView.saved"));
      q.refetch();
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionCard title={t("settingsHub.homeVisitTitle")}>
        <div data-f="F-00-047">
          {/* Пока настройка читается — тот же переключатель с подписью (неактивный): карточка сразу своей высоты */}
          <Switch
            checked={q.data?.blockHomeVisitDuringShift ?? false}
            disabled={!q.data}
            onCheckedChange={(v) => void toggle(v)}
            label={t("settingsHub.homeVisitLabel")}
            description={t("settingsHub.homeVisitHint")}
          />
        </div>
      </SectionCard>

      <button
        type="button"
        data-f="F-10-154"
        onClick={() => setDataModalOpen(true)}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left shadow-xs transition-colors hover:bg-surface-2/60"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <ShieldCheck aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-fg">{t("settingsHub.dataTitle")}</span>
          <span className="block text-sm text-muted">{t("settingsHub.dataSubtitle")}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </button>

      <Modal
        open={dataModalOpen}
        onOpenChange={setDataModalOpen}
        title={t("settingsHub.dataTitle")}
        description={t("settingsHub.dataModalHint")}
      >
        <ul className="flex flex-col gap-3 text-sm text-fg">
          <li>{t("settingsHub.dataPoint1")}</li>
          <li>{t("settingsHub.dataPoint2")}</li>
          <li>{t("settingsHub.dataPoint3")}</li>
          <li>{t("settingsHub.dataPoint4")}</li>
        </ul>
      </Modal>
    </div>
  );
}
