"use client";

/**
 * «Информация» → свёрнутый блок «Дополнительно» (бывшая вкладка «Настройки», С15 обзора «Сотрудники»):
 * F-10-036 «Внешний ID», F-10-037 «Доступен для ассистирования», F-10-097 «Данные клиента в уведомлениях» и
 * галочка «Ассистент» (С9 — бесплатное место). Данные грузятся, когда блок раскрыли (М1); черновик сохраняется
 * общей кнопкой карточки (С2).
 */
import { useState } from "react";
import { getStaffCardSettings, setStaffAssistantOnly, setStaffCardSettings } from "@/api/staff";
import { optimistic, useApiMutation, useApiQuery } from "@/api/request";
import type { StaffCardData } from "@/api/staff";
import { useCardSection } from "@/areas/staff/components/card/cardForm";
import type { Staff } from "@/domain/core";
import { emptyStaffCardSettings, type StaffCardSettings } from "@/domain/staff";
import { useT } from "@/i18n/useT";
import { Checkbox } from "@/ui/Checkbox";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { Skeleton } from "@/ui/Skeleton";

interface ExtraDraft extends StaffCardSettings {
  assistantOnly: boolean;
}

export function StaffExtraSection({ staff }: { staff: Staff }) {
  const settingsQ = useApiQuery(["staff", "cardSettings", staff.id], () => getStaffCardSettings(staff.id));
  if (!settingsQ.data)
    return (
      <div data-skeleton className="flex flex-col gap-5" aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton variant="rect" className="h-10 w-full rounded-xl" />
          </span>
        ))}
      </div>
    );
  return <ExtraForm staff={staff} settings={settingsQ.data} />;
}

function ExtraForm({ staff, settings }: { staff: Staff; settings: StaffCardSettings }) {
  const t = useT("staff");
  const base: ExtraDraft = { ...emptyStaffCardSettings(), ...settings, assistantOnly: Boolean(staff.assistantOnly) };
  const baseKey = JSON.stringify(base);
  const [draft, setDraft] = useState<ExtraDraft>(base);
  const [seenKey, setSeenKey] = useState(baseKey);
  if (baseKey !== seenKey) {
    setSeenKey(baseKey);
    if (JSON.stringify(draft) === seenKey) setDraft(base);
  }
  const dirty = JSON.stringify(draft) !== baseKey;
  const patch = (p: Partial<ExtraDraft>) => setDraft((d) => ({ ...d, ...p }));
  const settingsM = useApiMutation((a: { staffId: string; patch: StaffCardSettings }) => setStaffCardSettings(a.staffId, a.patch), {
    optimistic: optimistic<StaffCardSettings, { staffId: string; patch: StaffCardSettings }>(
      (a) => ["staff", "cardSettings", a.staffId],
      (old, a) => ({ ...old, ...a.patch }),
    ),
  });
  const assistantM = useApiMutation((a: { staffId: string; value: boolean }) => setStaffAssistantOnly(a.staffId, a.value), {
    optimistic: optimistic<StaffCardData, { staffId: string; value: boolean }>(
      (a) => ["staff", "card", a.staffId],
      (old, a) => ({ ...old, staff: { ...old.staff, assistantOnly: a.value || undefined } }),
    ),
  });

  useCardSection("extra", dirty, async () => {
    const { assistantOnly, ...rest } = draft;
    await settingsM.mutate({ staffId: staff.id, patch: rest });
    if (assistantOnly !== Boolean(staff.assistantOnly)) await assistantM.mutate({ staffId: staff.id, value: assistantOnly });
    setSeenKey(JSON.stringify(draft));
  });

  return (
    <div data-f="F-10-036 F-10-037 F-13-073 F-13-074 F-13-075 F-13-076" className="flex flex-col gap-5">
      {staff.role === "master" && (
        <Checkbox
          checked={draft.assistantOnly}
          onCheckedChange={(v) => patch({ assistantOnly: v })}
          label={t("settingsTab.assistantOnlyLabel")}
          description={t("settingsTab.assistantOnlyHint")}
        />
      )}
      <Checkbox
        checked={draft.assistantAvailable ?? false}
        onCheckedChange={(v) => patch({ assistantAvailable: v })}
        label={t("settingsTab.assistLabel")}
        description={t("settingsTab.assistLabelHint")}
      />
      <div data-f="F-10-097">
        <Checkbox
          checked={draft.sendClientContactsInNotify ?? false}
          onCheckedChange={(v) => patch({ sendClientContactsInNotify: v })}
          label={t("settingsTab.notifyDataLabel")}
          description={t("settingsTab.notifyDataHint")}
        />
      </div>
      <FormField label={t("settingsTab.externalId")} hint={t("settingsTab.externalIdHint")} className="max-w-sm">
        <Input value={draft.externalId ?? ""} onChange={(e) => patch({ externalId: e.target.value })} placeholder="EMP-00123" />
      </FormField>
    </div>
  );
}
