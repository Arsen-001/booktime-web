"use client";

/**
 * «Добавить сотрудника» (F-10-015…018, F-10-022, F-10-023): роль → платный/бесплатный → имя, контакты,
 * должность/специализация. Счётчик мест в лицензии меняется вживую (F-10-017). Ассистент — без графика и бесплатно.
 */
import { useState } from "react";
import {
  addStaff,
  StaffValidationError,
  type AddStaffInput,
} from "@/api/staff";
import { useApiMutation } from "@/api/request";
import {
  seatsFor,
  totalSeatCost,
  type SeatCandidate,
} from "@/areas/staff/pricing";
import type { Id, Staff, StaffRole } from "@/domain/core";
import {
  ADMIN_ROLE_TEMPLATES,
  defaultRoleTemplateFor,
  roleTemplateLabel,
  type StaffPosition,
  type StaffRoleTemplateId,
} from "@/domain/staff";
import Link from "next/link";
import { useCurrent, useTerms } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { ChoiceGroup } from "@/ui/ChoiceGroup";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { PhoneInput } from "@/ui/PhoneInput";
import { Select } from "@/ui/Select";
import { Sheet } from "@/ui/Sheet";
import { Switch } from "@/ui/Switch";
import { useConfirm, useToast } from "@/ui/Toast";

export interface AddStaffSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id | undefined;
  locationIds: Id[];
  existingStaff: Staff[];
  assistantOf?: Id;
  positions: StaffPosition[];
  onCreated: (staff: Staff) => void;
}

interface Draft {
  role: StaffRole;
  name: string;
  phone: string;
  email: string;
  position: string;
  specialty: string;
  asAssistant: boolean;
  grantAccess: boolean;
  roleTemplateId: StaffRoleTemplateId;
}

function emptyDraft(): Draft {
  return {
    role: "master",
    name: "",
    phone: "",
    email: "",
    position: "",
    specialty: "",
    asAssistant: false,
    grantAccess: true,
    roleTemplateId: defaultRoleTemplateFor("master"),
  };
}

export function AddStaffSheet({
  open,
  onOpenChange,
  businessId,
  locationIds,
  existingStaff,
  positions,
  onCreated,
}: AddStaffSheetProps) {
  const t = useT("staff");
  const toast = useToast();
  const confirm = useConfirm();
  const { sphere } = useCurrent();
  const terms = useTerms();
  const create = useApiMutation(addStaff);

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "phone" | "email", string>>
  >({});
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(emptyDraft());
      setErrors({});
    }
  }

  // Счётчик мест «в лицензии» (F-10-017): считаем текущих + черновик места
  const draftCandidate: SeatCandidate = {
    id: "__draft__",
    role: draft.role,
    workplaces: draft.asAssistant ? [] : ["salon"],
    serviceIds: [],
    status: "active",
    hiredAt: "2099-01-01",
    assistantOnly: draft.asAssistant,
  };
  const previewStaff: (Staff | SeatCandidate)[] = draft.name.trim()
    ? [...existingStaff, draftCandidate]
    : existingStaff;
  const seats = seatsFor(previewStaff);
  const total = totalSeatCost(seats.values());
  const draftSeat = seats.get("__draft__");

  // С11: тот же номер уже у сотрудника бизнеса — приглашение ушло бы на один телефон дважды
  const phoneDigits = draft.phone.replace(/\D/g, "");
  const duplicate =
    phoneDigits.length >= 6
      ? existingStaff.find((s) => s.status !== "fired" && s.phone.replace(/\D/g, "") === phoneDigits)
      : undefined;
  const touched = Boolean(draft.name.trim() || phoneDigits || draft.email.trim());

  // С11: закрытие (Esc, крестик, «Отмена») с введённым — сначала «Закрыть без сохранения?»
  const requestOpenChange = async (next: boolean) => {
    if (!next && touched && !create.isPending) {
      const ok = await confirm({
        title: t("addStaffForm.leaveTitle"),
        description: t("addStaffForm.leaveText"),
        tone: "danger",
      });
      if (!ok) return;
    }
    onOpenChange(next);
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (duplicate) next.phone = t("addStaffForm.duplicatePhone", { name: duplicate.name });
    if (!draft.name.trim()) next.name = t("addStaffForm.nameRequired");
    if (draft.role === "master" && draft.phone.replace(/\D/g, "").length < 6)
      next.phone = t("addStaffForm.phoneRequired");
    if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email))
      next.email = t("addStaffForm.emailInvalid");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!businessId || !validate()) return;
    const input: AddStaffInput = {
      businessId,
      locationIds,
      name: draft.name.trim(),
      role: draft.role,
      phone: draft.phone || undefined,
      email: draft.email || undefined,
      position: draft.position || undefined,
      specialty: draft.specialty || undefined,
      sphereIds: [sphere],
      asAssistant: draft.role === "master" ? draft.asAssistant : false,
      grantAccess: draft.grantAccess,
      roleTemplateId: draft.roleTemplateId,
    };
    try {
      const staff = await create.mutate(input);
      toast.success(t("addStaffForm.success", { name: staff.name }));
      onOpenChange(false);
      onCreated(staff);
    } catch (e) {
      if (e instanceof StaffValidationError) {
        const message =
          e.field === "name"
            ? t("addStaffForm.nameRequired")
            : e.field === "phone"
              ? t("addStaffForm.phoneRequired")
              : t("addStaffForm.emailInvalid");
        setErrors((prev) => ({ ...prev, [e.field]: message }));
      } else {
        toast.error(t("addStaffForm.failed"));
      }
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => void requestOpenChange(o)}
      title={t("addStaffForm.title")}
      description={t("addStaffForm.description")}
      size="lg"
      footer={
        <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <span
            className="flex flex-col gap-0.5 text-sm text-muted"
            data-f="F-10-017 F-10-113 F-15-051"
          >
            {t("addStaffForm.seatCounter", {
              count: [...seats.values()].filter((s) => s.paid).length,
              total,
            })}
            <Link href="/biz/billing" className="text-xs text-accent hover:underline">
              {t("addStaffForm.billingLink")}
            </Link>
          </span>
          <div className="grid grid-cols-2 gap-2 md:flex md:w-auto md:justify-end">
            <Button variant="outline" onClick={() => void requestOpenChange(false)}>
              {t("addStaffForm.cancel")}
            </Button>
            <Button loading={create.isPending} onClick={submit}>
              {t("addStaffForm.save")}
            </Button>
          </div>
        </div>
      }
    >
      <form
        noValidate
        data-f="F-10-016 F-10-018 F-10-022 F-10-023"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
      >
        <ChoiceGroup
          value={draft.role}
          onValueChange={(v) =>
            setDraft((d) => ({
              ...d,
              role: v as StaffRole,
              roleTemplateId: defaultRoleTemplateFor(v as StaffRole),
            }))
          }
          aria-label={t("addStaffForm.role")}
          columns={2}
          options={[
            {
              value: "master",
              title: t("addStaffForm.roleMaster"),
              description: t("addStaffForm.roleMasterHint"),
            },
            {
              value: "admin",
              title: t("addStaffForm.roleAdmin"),
              description: t("addStaffForm.roleAdminHint"),
            },
          ]}
        />

        <FormField data-f="F-16-010" label={t("addStaffForm.name")} required error={errors.name}>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder={t("addStaffForm.namePlaceholder")}
            autoFocus
          />
        </FormField>

        {draft.role === "master" ? (
          <>
          <FormField
            label={t("addStaffForm.phone")}
            required
            error={errors.phone ?? (duplicate ? t("addStaffForm.duplicatePhone", { name: duplicate.name }) : undefined)}
            hint={t("addStaffForm.phoneHint")}
          >
            <PhoneInput
              value={draft.phone}
              onValueChange={(v) => {
                setDraft((d) => ({ ...d, phone: v }));
                setErrors((e) => ({ ...e, phone: undefined }));
              }}
              invalid={Boolean(errors.phone || duplicate)}
            />
          </FormField>
          {duplicate && (
            <Link data-f="F-10-016" href={`/biz/staff/${duplicate.id}`} className="-mt-2 w-fit text-sm font-medium text-primary-text hover:underline">
              {t("addStaffForm.openCard")}: {duplicate.name}
            </Link>
          )}
          </>
        ) : (
          <FormField
            label={t("addStaffForm.email")}
            error={errors.email}
            hint={t("addStaffForm.emailHint")}
          >
            <Input
              type="email"
              value={draft.email}
              onChange={(e) =>
                setDraft((d) => ({ ...d, email: e.target.value }))
              }
              placeholder="admin@example.com"
              invalid={Boolean(errors.email)}
            />
          </FormField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("addStaffForm.position")} optional>
            <Select
              options={[
                { value: "", label: t("addStaffForm.positionNone") },
                ...positions.map((p) => ({
                  value: p.name.ru,
                  label: p.name.ru,
                })),
              ]}
              value={
                positions.some((p) => p.name.ru === draft.position)
                  ? draft.position
                  : ""
              }
              onValueChange={(v) => setDraft((d) => ({ ...d, position: v }))}
            />
          </FormField>
          <FormField label={t("addStaffForm.specialty")} optional>
            <Input
              value={draft.specialty}
              onChange={(e) =>
                setDraft((d) => ({ ...d, specialty: e.target.value }))
              }
              placeholder={t("addStaffForm.specialtyPlaceholder")}
            />
          </FormField>
        </div>

        {draft.role === "master" && (
          <Switch
            checked={draft.asAssistant}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, asAssistant: v }))}
            label={t("addStaffForm.asAssistant")}
            description={t("addStaffForm.asAssistantHint")}
          />
        )}

        <div
          data-f="F-10-019"
          className="flex flex-col gap-3 rounded-xl border border-border p-3.5"
        >
          <Switch
            checked={draft.grantAccess}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, grantAccess: v }))}
            label={t("addStaffForm.grantAccess")}
            description={
              draft.role === "master"
                ? t("addStaffForm.grantAccessHintMaster")
                : t("addStaffForm.grantAccessHintAdmin")
            }
          />
          {draft.grantAccess && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <FormField label={t("accessTab.role")} className="flex-1">
                <Select
                  value={draft.roleTemplateId}
                  onValueChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      roleTemplateId: v as StaffRoleTemplateId,
                    }))
                  }
                  options={(draft.role === "master"
                    ? (["specialist", "viewer"] as StaffRoleTemplateId[])
                    : ADMIN_ROLE_TEMPLATES
                  ).map((id) => ({
                    value: id,
                    label: roleTemplateLabel(
                      id,
                      t(`roleTemplates.${id}.title` as never),
                      terms.master,
                    ),
                  }))}
                  data-f="F-10-151"
                />
              </FormField>
              <p className="text-xs text-muted sm:max-w-56">{t("addStaffForm.rightsLater")}</p>
            </div>
          )}
        </div>

        {draftSeat && (
          <p className="text-sm text-muted" data-f="F-10-018">
            {draftSeat.paid
              ? t("addStaffForm.paidNote", { price: draftSeat.price })
              : t("addStaffForm.freeNote")}
          </p>
        )}
      </form>
    </Sheet>
  );
}
