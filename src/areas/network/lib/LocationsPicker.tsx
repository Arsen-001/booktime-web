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
  // Ответ 32 (владелец 17.11.2026): замороженный за неуплату филиал в действиях сети неактивен с подписью
  // «заморожен» — его не отметить и не снять («Выбрать все/ничего» его не трогают); сервер его тоже не меняет
  const frozen = new Set(locations.filter((l) => l.business.status === "frozen").map((l) => l.business.id));
  const keptFrozen = value.filter((id) => frozen.has(id));
  const toggle = (id: Id, checked: boolean) => {
    if (frozen.has(id)) return;
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...locations.map((l) => l.business.id).filter((id) => !frozen.has(id)), ...keptFrozen])}
        >
          {t("form.selectAll")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(keptFrozen)}>
          {t("form.selectNone")}
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
        {locations.map((l) => (
          <li key={l.business.id}>
            <Checkbox
              checked={value.includes(l.business.id)}
              disabled={frozen.has(l.business.id)}
              onCheckedChange={(checked) => toggle(l.business.id, checked)}
              label={frozen.has(l.business.id) ? t("form.frozenBranch", { name: l.business.name }) : l.business.name}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
