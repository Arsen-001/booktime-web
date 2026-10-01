'use client';

/**
 * F-01-046: «Ресурсы» — окно записи → левая зона. Закрепляет за записью экземпляры ресурсов
 * (кресло, кабинет, аппарат). Booking.resourceIds хранит id ЭКЗЕМПЛЯРОВ (см. computeResourceFree
 * в api/journal.ts — сверяет b.resourceIds с instanceId), не самих ресурсов.
 */
import { useLocale } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import type { Id, Resource } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';

export interface ResourceInstanceOption {
  resource: Resource;
  resourceName: string;
  instanceId: Id;
  instanceName: string;
  occupied: boolean;
}

export interface ResourcesFieldProps {
  resources: Resource[];
  /** F-01-046 «Готово, когда»: занятый экземпляр нельзя выбрать на это время */
  occupiedInstanceIds: Set<Id>;
  value: Id[];
  onChange: (ids: Id[]) => void;
  disabled?: boolean;
}

export function ResourcesField({
  resources,
  occupiedInstanceIds,
  value,
  onChange,
  disabled,
}: ResourcesFieldProps) {
  const t = useT('journal');
  const locale = useLocale();

  // F-01-046: «Блок виден всегда, если в локации есть ресурсы; нет ресурсов — нет блока»
  if (resources.length === 0) return null;

  const allInstances: ResourceInstanceOption[] = resources.flatMap((r) =>
    r.instances.map((i) => ({
      resource: r,
      resourceName: pickText(r.name, locale),
      instanceId: i.id,
      instanceName: i.name,
      occupied: occupiedInstanceIds.has(i.id),
    })),
  );
  const selected = value
    .map((id) => allInstances.find((i) => i.instanceId === id))
    .filter((i): i is ResourceInstanceOption => Boolean(i));
  const available = allInstances.filter(
    (i) => !value.includes(i.instanceId) && !i.occupied,
  );

  const menuItems: DropdownMenuItem[] =
    available.length === 0
      ? [{ id: 'empty', label: t('window.left.resourcesNoneFree'), disabled: true }]
      : available.map((i) => ({
          id: i.instanceId,
          label: `${i.resourceName} — ${i.instanceName}`,
          onSelect: () => onChange([...value, i.instanceId]),
        }));

  return (
    <div data-f="F-01-046" className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">
        {t('window.left.resourcesTitle')}
      </span>
      {selected.length === 0 ? (
        <p className="text-xs text-muted">{t('window.left.resourcesNone')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((i) => (
            <span
              key={i.instanceId}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1 pr-1 pl-2.5 text-xs text-fg"
            >
              {i.resourceName} — {i.instanceName}
              {!disabled && (
                <button
                  type="button"
                  aria-label={t('window.left.resourcesRemove')}
                  onClick={() => onChange(value.filter((v) => v !== i.instanceId))}
                  className="flex size-5 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-fg"
                >
                  <Trash2 aria-hidden className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <DropdownMenu
          items={menuItems}
          trigger={(props) => (
            <IconButton
              {...props}
              icon={<Plus aria-hidden />}
              label={t('window.left.resourcesAdd')}
              variant="outline"
              size="sm"
              className="w-fit"
            />
          )}
        />
      )}
    </div>
  );
}
