"use client";

/** Фильтры списка сотрудников (F-10-007, F-10-112): статус, учёт в лицензии, должность. */
import { emptyStaffFilters, type StaffListFilters } from "@/domain/staff";
import type { StaffPosition } from "@/domain/staff";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Select } from "@/ui/Select";
import { Sheet } from "@/ui/Sheet";

export interface StaffFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: StaffListFilters;
  onChange: (f: StaffListFilters) => void;
  positions: StaffPosition[];
}

export function StaffFiltersSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  positions,
}: StaffFiltersSheetProps) {
  const t = useT("staff");
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("filters.title")}
      size="sm"
      footer={
        <div className="grid w-full grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => onChange(emptyStaffFilters())}
          >
            {t("filters.reset")}
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            {t("filters.apply")}
          </Button>
        </div>
      }
    >
      <div data-f="F-10-007 F-10-112" className="flex flex-col gap-4">
        <FormField label={t("filters.license")}>
          <Select
            value={filters.license}
            onValueChange={(v) =>
              onChange({
                ...filters,
                license: v as StaffListFilters["license"],
              })
            }
            options={[
              { value: "all", label: t("filters.licenseAll") },
              { value: "paid", label: t("filters.licensePaid") },
              { value: "free", label: t("filters.licenseFree") },
            ]}
          />
        </FormField>
        <FormField label={t("filters.position")} optional>
          <Select
            value={filters.positionName ?? ""}
            onValueChange={(v) =>
              onChange({ ...filters, positionName: v || undefined })
            }
            options={[
              { value: "", label: t("filters.positionAll") },
              ...positions.map((p) => ({ value: p.name.ru, label: p.name.ru })),
            ]}
          />
        </FormField>
      </div>
    </Sheet>
  );
}
