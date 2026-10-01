'use client';

/**
 * Список индивидуальных значений для категорий/отдельных позиций (F-09-016, F-09-032). Принадлежит разделу «payroll».
 * Общий для услуг и товаров — различаются только список целей (categories/items) и разрешена ли категория.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { OverrideTargetType, PayoutOverride, PayoutValue } from '@/domain/payroll';
import { DEFAULT_PAYOUT } from '@/domain/payroll';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Combobox, type ComboboxOption } from '@/ui/Combobox';
import { EmptyState } from '@/ui/EmptyState';
import { PayoutValueField } from '@/areas/payroll/scheme/PayoutValueField';

export interface OverrideTargetOption {
  id: string;
  label: string;
  type: OverrideTargetType;
}

export interface OverridesEditorProps {
  overrides: PayoutOverride[];
  onChange: (overrides: PayoutOverride[]) => void;
  targets: OverrideTargetOption[];
}

function targetKey(type: OverrideTargetType, id: string): string {
  return `${type}:${id}`;
}

export function OverridesEditor({ overrides, onChange, targets }: OverridesEditorProps) {
  const t = useT('payroll');
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const targetLabel = (o: PayoutOverride): string => targets.find((x) => x.id === o.targetId && x.type === o.targetType)?.label ?? o.targetId;

  const usedKeys = new Set(overrides.map((o) => targetKey(o.targetType, o.targetId)));
  const options: ComboboxOption[] = targets
    .filter((x) => !usedKeys.has(targetKey(x.type, x.id)))
    .map((x) => ({
      value: targetKey(x.type, x.id),
      label: x.label,
      description: x.type === 'category' ? t('scheme.overrides.categoryTag') : undefined,
    }));

  function addTarget(key: string | null) {
    if (!key) return;
    const [type, id] = key.split(':') as [OverrideTargetType, string];
    onChange([...overrides, { targetType: type, targetId: id, payout: { ...DEFAULT_PAYOUT } }]);
    setPendingKey(null);
  }

  function updatePayout(index: number, payout: PayoutValue) {
    const next = overrides.slice();
    next[index] = { ...next[index], payout };
    onChange(next);
  }

  function remove(index: number) {
    onChange(overrides.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {overrides.length === 0 ? (
        <EmptyState variant="inline" title={t('scheme.overrides.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {overrides.map((o, i) => (
            <li key={targetKey(o.targetType, o.targetId)} className="flex items-end gap-2 rounded-lg border border-border bg-surface-2/50 p-2.5">
              <div className="min-w-0 flex-1">
                <PayoutValueField label={targetLabel(o)} value={o.payout} onValueChange={(v) => updatePayout(i, v)} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t('scheme.overrides.remove')}
                onClick={() => remove(i)}
                className="mb-0.5 shrink-0 px-2 text-muted hover:text-danger"
              >
                <X aria-hidden className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {options.length > 0 && (
        <div className="flex items-center gap-2">
          <Combobox
            options={options}
            value={pendingKey}
            onValueChange={(key) => addTarget(key)}
            placeholder={t('scheme.overrides.pickPlaceholder')}
            emptyText={t('scheme.overrides.pickEmpty')}
            className="min-w-0 flex-1"
          />
          <Plus aria-hidden className="size-4 shrink-0 text-muted" />
        </div>
      )}
    </div>
  );
}
