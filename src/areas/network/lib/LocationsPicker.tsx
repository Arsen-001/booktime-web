"use client";

/**
 * Общий чеклист «в каких филиалах» для форм b03 (сетевая услуга/сотрудник/товар/должность/тип дня).
 * Файл принадлежит разделу network — переиспользуется только внутри своих экранов.
 */
import type { Id } from "@/domain/core";
import type { NetworkLocationRow } from "@/api/network";
import { Checkbox } from "@/ui/Checkbox";
import { Button } from "@/ui/Button";
import { useT } from "@/i18n/useT";

export function LocationsPicker({
  locations,
  value,
  onChange,
}: {
  locations: NetworkLocationRow[];
  value: Id[];
  onChange: (ids: Id[]) => void;
}) {
  const t = useT("network");
  const toggle = (id: Id, checked: boolean) => {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(locations.map((l) => l.business.id))}
        >
          {t("form.selectAll")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
          {t("form.selectNone")}
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
        {locations.map((l) => (
          <li key={l.business.id}>
            <Checkbox
              checked={value.includes(l.business.id)}
              onCheckedChange={(checked) => toggle(l.business.id, checked)}
              label={l.business.name}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
