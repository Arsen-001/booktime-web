"use client";

/**
 * F-01-134…136: создание пакета (комплекса) — несколько услуг у нескольких мастеров одним визитом.
 * «Комплекс» как настройка услуги (раздел «Услуги») ещё не построен — пакет собирается прямо здесь
 * из отдельных услуг; слоты считает computePackageSlots() раздела schedule (F-02-069), см.
 * qa/requests/journal.md и комментарий у createPackageBooking() в api/journal.ts.
 */
import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import type { Id, ISODate, Service, Staff } from "@/domain/core";
import type { PackageOrderMode } from "@/domain/journal";
import { coreCreate, findClientByPhone } from "@/api/core";
import {
  createPackageBooking,
  getPackageSlots,
  type PackagePlanStep,
} from "@/api/journal";
import { useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { useJournalHourFormat } from "@/areas/journal/lib/useJournalHourFormat";
import { normalizePhone } from "@/lib/phone";
import { nowDateTime } from "@/lib/date";
import { pickText } from "@/lib/text";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Modal } from "@/ui/Modal";
import { PhoneInput } from "@/ui/PhoneInput";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { useToast } from "@/ui/Toast";

export interface PackageCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  locationId: Id;
  date: ISODate;
  services: Service[];
  staffList: Staff[];
  onCreated: () => void;
}

interface StepDraft {
  serviceId: Id;
  staffId: Id;
}

export function PackageCreateModal({
  open,
  onOpenChange,
  businessId,
  locationId,
  date,
  services,
  staffList,
  onCreated,
}: PackageCreateModalProps) {
  const t = useT("journal");
  const tc = useT("common");
  const locale = useLocale();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const toast = useToast();
  const { staffId: ownStaffId } = useCurrent();
  const [order, setOrder] = useState<PackageOrderMode>("sequential_one");
  const [steps, setSteps] = useState<StepDraft[]>([
    { serviceId: services[0]?.id ?? "", staffId: staffList[0]?.id ?? "" },
    {
      serviceId: services[1]?.id ?? services[0]?.id ?? "",
      staffId: staffList[0]?.id ?? "",
    },
  ]);
  const [phone, setPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [chosenSlot, setChosenSlot] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const planSteps: PackagePlanStep[] = useMemo(
    () =>
      steps
        .filter((s) => s.serviceId && s.staffId)
        .map((s) => {
          const svc = services.find((x) => x.id === s.serviceId)!;
          // F-01-134 fix (defense in depth): "sequential_one" means ONE master for the whole
          // package by definition — force every step's staffId to the first step's, so a stray
          // desync in `steps` state can never make the slot search intersect two different
          // people's schedules (the actual bug: it silently reported "no free time" for a master
          // who WAS free, because it was checking their schedule against someone else's too).
          const staffId =
            order === "sequential_one" ? (steps[0]?.staffId ?? s.staffId) : s.staffId;
          return {
            serviceId: svc.id,
            staffId,
            durationMin: svc.durationMin,
            bufferAfterMin: svc.bufferAfterMin,
            name: pickText(svc.name, locale),
            price: svc.priceMin,
          };
        }),
    [steps, services, locale, order],
  );

  const slotsQuery = useApiQuery(
    [
      "journal",
      "package-slots",
      locationId,
      date,
      JSON.stringify(planSteps),
      order,
    ],
    () => getPackageSlots(locationId, date, planSteps, order),
    { enabled: open && planSteps.length >= 2 },
  );

  const handleCreate = async () => {
    if (planSteps.length < 2 || !chosenSlot) return;
    setSaving(true);
    try {
      const normalized = phone ? normalizePhone(phone) : undefined;
      let clientId: Id | undefined;
      if (normalized) {
        const existing = await findClientByPhone(businessId, normalized);
        clientId = existing
          ? existing.id
          : (
              await coreCreate("clients", {
                businessId,
                phone: normalized,
                name: clientName || normalized,
                gender: "unknown",
                tags: [],
                noShowCount: 0,
                createdAt: nowDateTime(),
              })
            ).id;
      }
      await createPackageBooking({
        businessId,
        locationId,
        clientId,
        start: chosenSlot,
        order,
        steps: planSteps,
        createdBy: ownStaffId ?? "",
      });
      toast.success(tc("states.saved"));
      onCreated();
      onOpenChange(false);
    } catch {
      toast.error(tc("states.actionFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("window.package.createTitle")}
      size="md"
    >
      <div data-f="F-01-134 F-01-135 F-16-126" className="flex flex-col gap-4">
        <FormField label={t("window.package.orderLabel")}>
          <SegmentedControl
            value={order}
            onValueChange={(v) => {
              const next = v as PackageOrderMode;
              setOrder(next);
              // F-01-134 fix: switching TO "sequential_one" must re-sync every step's staffId to the
              // first one right away — otherwise the disabled selects below still show (and the slot
              // search still uses) whatever master they last had, and free-slot lookup intersects the
              // wrong two people's schedules.
              if (next === "sequential_one") {
                setSteps((prev) =>
                  prev.map((s) => ({ ...s, staffId: prev[0]?.staffId ?? "" })),
                );
              }
            }}
            options={[
              {
                value: "sequential_one",
                label: t("window.package.orderSequential"),
              },
              { value: "parallel", label: t("window.package.orderParallel") },
            ]}
          />
        </FormField>

        <div className="flex flex-col gap-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                className="flex-1"
                value={step.serviceId}
                onValueChange={(v) =>
                  setSteps((prev) =>
                    prev.map((s, j) => (j === i ? { ...s, serviceId: v } : s)),
                  )
                }
                options={services.map((s) => ({
                  value: s.id,
                  label: pickText(s.name, locale),
                }))}
              />
              <Select
                className="flex-1"
                value={step.staffId}
                onValueChange={(v) =>
                  setSteps((prev) =>
                    // F-01-134 fix: in "sequential_one" every step shares ONE master — changing the
                    // (only enabled) first select must push the new value onto every other step too,
                    // not just its own; otherwise the disabled selects keep showing (and the slot
                    // search keeps using) the master's PREVIOUS value.
                    order === "sequential_one"
                      ? prev.map((s) => ({ ...s, staffId: v }))
                      : prev.map((s, j) => (j === i ? { ...s, staffId: v } : s)),
                  )
                }
                disabled={order === "sequential_one" && i > 0}
                options={staffList.map((s) => ({ value: s.id, label: s.name }))}
              />
              {steps.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSteps((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Plus aria-hidden />}
            onClick={() =>
              setSteps((prev) => [
                ...prev,
                {
                  serviceId: services[0]?.id ?? "",
                  staffId:
                    order === "sequential_one"
                      ? (prev[0]?.staffId ?? "")
                      : (staffList[0]?.id ?? ""),
                },
              ])
            }
          >
            {t("window.package.addStep")}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FormField label={t("window.phone")}>
            <PhoneInput value={phone} onValueChange={setPhone} />
          </FormField>
          <FormField label={t("window.clientName")} optional>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label={t("window.package.slotsLabel")}>
          {slotsQuery.isLoading ? (
            <p className="text-sm text-muted">{tc("states.loading")}</p>
          ) : (slotsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-danger">{t("window.package.noSlots")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(slotsQuery.data ?? []).slice(0, 8).map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => setChosenSlot(slot.start)}
                  className={`min-h-9 rounded-lg border px-3 text-sm ${chosenSlot === slot.start ? "border-primary bg-primary-soft text-primary-text" : "border-border text-fg hover:bg-surface-2"}`}
                >
                  {format.time(slot.start)}
                </button>
              ))}
            </div>
          )}
        </FormField>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tc("actions.cancel")}
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!chosenSlot || planSteps.length < 2}
            onClick={handleCreate}
          >
            {tc("actions.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
