"use client";

/**
 * «Информация» → свёрнутый блок «Юр. информация» (F-10-038; бывшая вкладка, С15 обзора «Сотрудники»): кадровые
 * данные, видны только владельцу и интеграциям с доступом к сотрудникам (блок гейтится правом staff.manage).
 * Данные грузятся, когда блок раскрыли (М1); сохраняется общей кнопкой карточки (С2).
 */
import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { getStaffLegalInfo, setStaffLegalInfo } from "@/api/staff";
import { optimistic, useApiMutation, useApiQuery } from "@/api/request";
import { useCardSection } from "@/areas/staff/components/card/cardForm";
import { emptyStaffLegalInfo, type StaffGender, type StaffLegalInfo } from "@/domain/staff";
import { useT } from "@/i18n/useT";
import { Skeleton } from "@/ui/Skeleton";
import { DatePicker } from "@/ui/DatePicker";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { PhoneInput } from "@/ui/PhoneInput";
import { Select } from "@/ui/Select";

const GENDERS: StaffGender[] = ["unknown", "male", "female"];

export function StaffLegalSection({ staffId, businessId }: { staffId: string; businessId: string }) {
  const legalQ = useApiQuery(["staff", "legal", staffId], () => getStaffLegalInfo(staffId));
  if (!legalQ.data)
    return (
      <div data-skeleton className="flex flex-col gap-5" aria-busy>
        <Skeleton variant="rect" className="h-12 w-full rounded-xl" />
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton variant="rect" className="h-16 rounded-xl" />
            <Skeleton variant="rect" className="h-16 rounded-xl" />
          </span>
        ))}
      </div>
    );
  return <LegalForm staffId={staffId} businessId={businessId} info={legalQ.data} />;
}

function LegalForm({ staffId, businessId, info }: { staffId: string; businessId: string; info: StaffLegalInfo }) {
  const t = useT("staff");
  const base = { ...emptyStaffLegalInfo(), ...info };
  const baseKey = JSON.stringify(base);
  const [draft, setDraft] = useState<StaffLegalInfo>(base);
  const [seenKey, setSeenKey] = useState(baseKey);
  if (baseKey !== seenKey) {
    setSeenKey(baseKey);
    if (JSON.stringify(draft) === seenKey) setDraft(base);
  }
  const dirty = JSON.stringify(draft) !== baseKey;
  const onDraftChange = (p: Partial<StaffLegalInfo>) => setDraft((d) => ({ ...d, ...p }));
  const legalM = useApiMutation(
    (a: { staffId: string; businessId: string; info: StaffLegalInfo }) => setStaffLegalInfo(a.staffId, a.businessId, a.info),
    { optimistic: optimistic<StaffLegalInfo, { staffId: string; info: StaffLegalInfo }>((a) => ["staff", "legal", a.staffId], (_old, a) => a.info) },
  );
  useCardSection("legal", dirty, async () => {
    await legalM.mutate({ staffId, businessId, info: draft });
    setSeenKey(JSON.stringify(draft));
  });

  return (
    <div data-f="F-10-038" className="flex flex-col gap-5">
      <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft/40 p-3 text-sm text-fg">
        <TriangleAlert
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <p>{t("legalTab.warning")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label={t("legalTab.firstName")}>
          <Input
            value={draft.firstName ?? ""}
            onChange={(e) => onDraftChange({ firstName: e.target.value })}
          />
        </FormField>
        <FormField label={t("legalTab.lastName")}>
          <Input
            value={draft.lastName ?? ""}
            onChange={(e) => onDraftChange({ lastName: e.target.value })}
          />
        </FormField>
        <FormField label={t("legalTab.middleName")} optional>
          <Input
            value={draft.middleName ?? ""}
            onChange={(e) => onDraftChange({ middleName: e.target.value })}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t("legalTab.citizenship")}>
          <Input
            value={draft.citizenship ?? ""}
            onChange={(e) => onDraftChange({ citizenship: e.target.value })}
          />
        </FormField>
        <FormField label={t("legalTab.gender")}>
          <Select
            value={draft.gender ?? "unknown"}
            onValueChange={(v) => onDraftChange({ gender: v as StaffGender })}
            options={GENDERS.map((g) => ({
              value: g,
              label: t(`legalTab.genderOptions.${g}`),
            }))}
          />
        </FormField>
      </div>

      <FormField
        label={t("legalTab.passportNo")}
        hint={t("legalTab.passportHint")}
      >
        <Input
          value={draft.passportNo ?? ""}
          onChange={(e) => onDraftChange({ passportNo: e.target.value })}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t("legalTab.taxId")} hint={t("legalTab.taxIdHint")}>
          <Input
            value={draft.taxId ?? ""}
            onChange={(e) => onDraftChange({ taxId: e.target.value })}
          />
        </FormField>
        <FormField label={t("legalTab.insuranceNo")}>
          <Input
            value={draft.insuranceNo ?? ""}
            onChange={(e) => onDraftChange({ insuranceNo: e.target.value })}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t("legalTab.hiredAt")}>
          <DatePicker
            value={draft.hiredAt ?? null}
            onValueChange={(d) => onDraftChange({ hiredAt: d ?? undefined })}
            clearable
          />
        </FormField>
        <FormField label={t("legalTab.permitEndAt")} optional>
          <DatePicker
            value={draft.permitEndAt ?? null}
            onValueChange={(d) =>
              onDraftChange({ permitEndAt: d ?? undefined })
            }
            clearable
          />
        </FormField>
      </div>

      <FormField label={t("legalTab.extraPhone")} optional className="max-w-64">
        <PhoneInput
          value={draft.extraPhone ?? ""}
          onValueChange={(v) => onDraftChange({ extraPhone: v })}
        />
      </FormField>
    </div>
  );
}
