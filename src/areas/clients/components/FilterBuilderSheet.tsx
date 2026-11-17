'use client';

/**
 * Фильтры базы (F-04-017…036): три группы — «По визитам», «По клиентам», «По продажам». Открыта одна группа за раз, первая
 * раскрыта сразу; в заголовке группы — сколько условий в ней уже выбрано (ux-r1 №14, ux-r5 №23). Выбор — чипами, а не
 * столбиками радиокнопок (ux-r1 №12). Статусы записей — из ядра (core-rules №3).
 */
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { countClientsMatching } from '@/api/clients';
import { useApiQuery } from '@/api/request';
import type { ClientsFilterState, FilterGroupId } from '@/domain/clients';
import { emptyFilterState } from '@/domain/clients';
import type { Id, LocalizedText } from '@/domain/core';
import { ClientsGroup } from '@/areas/clients/components/filters/ClientsGroup';
import { SalesGroup } from '@/areas/clients/components/filters/SalesGroup';
import { VisitsGroup } from '@/areas/clients/components/filters/VisitsGroup';
import { useT } from '@/i18n/useT';
import { Accordion } from '@/ui/Accordion';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';

export interface FilterBuilderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ClientsFilterState;
  onApply: (value: ClientsFilterState) => void;
  staffOptions: { value: Id; label: string }[];
  serviceOptions: { value: Id; label: LocalizedText }[];
  categoryOptions: string[];
  /** Для живого счётчика «Показать N клиентов» на кнопке применения (ux-r5) */
  businessId?: Id;
  locationIds?: Id[];
  /** Без права «все клиенты» (F-04-199) — счёт по тем же клиентам, что покажет список */
  onlyStaffId?: Id;
}

/** Сколько условий выбрано в группе — для счётчика в заголовке */
function conditionsIn(group: FilterGroupId, f: ClientsFilterState): number {
  const g = f[group] as Record<string, unknown>;
  return Object.values(g).filter(
    (v) =>
      v !== undefined &&
      (!Array.isArray(v) || v.length > 0) &&
      (typeof v !== 'object' || Array.isArray(v) || Object.values(v as object).some((x) => x !== undefined)),
  ).length;
}

export function FilterBuilderSheet({
  open,
  onOpenChange,
  value,
  onApply,
  staffOptions,
  serviceOptions,
  categoryOptions,
  businessId,
  locationIds,
  onlyStaffId,
}: FilterBuilderSheetProps) {
  const t = useT('clients');
  const [draft, setDraft] = useState<ClientsFilterState>(value);

  // Живой счётчик на кнопке «Показать N клиентов» (ux-r5): пересчитывается на каждое изменение черновика — тот же
  // отбор, что покажет список (режим api — сервер); пока считается новый, видно прежнее число
  const countQ = useApiQuery(
    ['clients', 'filter-count', businessId, locationIds, onlyStaffId, draft],
    () => countClientsMatching({ businessId: businessId ?? '', locationIds, filters: draft, onlyStaffId }),
    { enabled: open && Boolean(businessId) },
  );
  const matchCount = open ? countQ.data : undefined;

  // Черновик синхронизируется с уже применёнными фильтрами при каждом открытии
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(value);
  }

  const title = (group: FilterGroupId) => {
    const n = conditionsIn(group, draft);
    return (
      <span className="flex items-center gap-2">
        {t(`filters.groups.${group}`)}
        {n > 0 && <Badge tone="primary">{n}</Badge>}
      </span>
    );
  };
  const clearGroup = (group: FilterGroupId) => (
    <Button
      variant="ghost"
      size="sm"
      leftIcon={<RotateCcw aria-hidden />}
      className="self-start"
      onClick={() => setDraft((d) => ({ ...d, [group]: emptyFilterState()[group] }) as ClientsFilterState)}
    >
      {t('filters.clearGroup')}
    </Button>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('filters.title')}
      size="lg"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2 md:flex md:w-auto md:justify-end">
          <Button variant="ghost" onClick={() => setDraft(emptyFilterState())}>
            {t('filters.clearAll')}
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            {matchCount === undefined ? t('filters.apply') : t('filters.applyCount', { count: matchCount })}
          </Button>
        </div>
      }
    >
      <div data-f="F-04-017 F-04-036">
        <Accordion
          items={[
            {
              id: 'visits',
              defaultOpen: true,
              title: title('visits'),
              content: (
                <div className="flex flex-col gap-5">
                  <VisitsGroup draft={draft} setDraft={setDraft} staffOptions={staffOptions} serviceOptions={serviceOptions} />
                  {clearGroup('visits')}
                </div>
              ),
            },
            {
              id: 'clients',
              title: title('clients'),
              content: (
                <div className="flex flex-col gap-5">
                  <ClientsGroup draft={draft} setDraft={setDraft} categoryOptions={categoryOptions} />
                  {clearGroup('clients')}
                </div>
              ),
            },
            {
              id: 'sales',
              title: title('sales'),
              content: (
                <div className="flex flex-col gap-5">
                  <SalesGroup draft={draft} setDraft={setDraft} />
                  {clearGroup('sales')}
                </div>
              ),
            },
          ]}
        />
      </div>
    </Sheet>
  );
}
