'use client';

/**
 * «Кто делает» — мастера услуги прямо в основной форме (У21, F-10-156, F-02-058, F-16-030): галочка — мастер
 * делает услугу; у отмеченного — своя цена и длительность. Пустое поле = базовая услуги, она видна серым (У22);
 * своё значение выделено и сбрасывается кнопкой. Всё — черновик формы, пишется общим «Сохранить» (У3).
 */
import Link from 'next/link';
import { RotateCcw, UserPlus } from 'lucide-react';
import type { Staff } from '@/domain/core';
import type { ServiceStaffEntry } from '@/domain/services';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { formatMoneyRange } from '@/lib/money';
import { CommitInput } from '@/areas/services/components/CommitInput';
import { Avatar } from '@/ui/Avatar';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';

export interface ServiceBase {
  priceMin?: number;
  priceMax?: number;
  durationMin?: number;
  durationMax?: number;
}

export interface ServiceStaffSectionProps {
  staffList: Staff[];
  value: ServiceStaffEntry[];
  onValueChange: (value: ServiceStaffEntry[]) => void;
  base: ServiceBase;
  canEdit: boolean;
}

export function ServiceStaffSection({ staffList, value, onValueChange, base, canEdit }: ServiceStaffSectionProps) {
  const t = useT('services');
  const format = useFormat();
  const basePrice = base.priceMin != null ? formatMoneyRange(base.priceMin, base.priceMax) : '';
  const baseDuration = base.durationMin != null ? format.durationRange(base.durationMin, base.durationMax) : '';
  const baseMinutes =
    base.durationMin != null
      ? base.durationMax && base.durationMax > base.durationMin
        ? `${base.durationMin}–${base.durationMax}`
        : String(base.durationMin)
      : '';

  if (staffList.length === 0) {
    return (
      <EmptyState
        compact
        variant="section"
        icon={<UserPlus aria-hidden />}
        title={t('staffTab.noStaffTitle')}
        action={
          <Link href="/biz/staff" className="text-sm font-medium text-primary-text hover:underline">
            {t('staffTab.createStaff')}
          </Link>
        }
      />
    );
  }

  const toggle = (staffId: string, on: boolean) => onValueChange(on ? [...value, { staffId }] : value.filter((e) => e.staffId !== staffId));
  const patch = (staffId: string, p: Partial<ServiceStaffEntry>) =>
    onValueChange(value.map((e) => (e.staffId === staffId ? { ...e, ...p } : e)));

  return (
    <div data-f="F-10-156 F-02-058 F-16-030" className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_10rem_7.5rem_2.5rem] items-center gap-2 px-1 text-xs font-medium text-muted max-sm:hidden">
        <span>{t('staffTab.colStaff')}</span>
        <span>{t('staffTab.colPrice')}</span>
        <span>{t('staffTab.colDuration')}</span>
        <span />
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {staffList.map((staff) => {
          const entry = value.find((e) => e.staffId === staff.id);
          const own = entry && (entry.price != null || entry.durationMin != null);
          return (
            <li key={staff.id} className="grid grid-cols-1 items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_10rem_7.5rem_2.5rem]">
              <Checkbox
                checked={Boolean(entry)}
                onCheckedChange={(on) => toggle(staff.id, on)}
                disabled={!canEdit}
                label={
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={staff.name} src={staff.avatarUrl} size="xs" colorIndex={staff.colorIndex} />
                    <span className="truncate font-medium text-fg">{staff.name}</span>
                  </span>
                }
              />
              {entry ? (
                <>
                  <div className="grid grid-cols-[1fr_1fr_2.5rem] gap-2 sm:contents">
                    <CommitInput
                      kind="money"
                      size="sm"
                      value={entry.price}
                      onCommit={(v) => patch(staff.id, { price: v })}
                      placeholder={basePrice}
                      emphasized={entry.price != null}
                      disabled={!canEdit}
                      aria-label={`${staff.name}: ${t('staffTab.colPrice')}`}
                    />
                    <CommitInput
                      kind="minutes"
                      size="sm"
                      value={entry.durationMin}
                      onCommit={(v) => patch(staff.id, { durationMin: v })}
                      placeholder={baseMinutes}
                      emphasized={entry.durationMin != null}
                      disabled={!canEdit}
                      aria-label={`${staff.name}: ${t('staffTab.colDurationMin')}`}
                    />
                    {own && canEdit ? (
                      <IconButton
                        size="sm"
                        variant="ghost"
                        icon={<RotateCcw aria-hidden />}
                        label={t('staffTab.resetToBase')}
                        onClick={() =>
                          patch(staff.id, {
                            price: undefined,
                            durationMin: undefined,
                          })
                        }
                      />
                    ) : (
                      <span />
                    )}
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted max-sm:hidden sm:col-span-3">{t('staffTab.notDoing')}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">
        {t('staffTab.baseHint', {
          price: basePrice || '—',
          duration: baseDuration || '—',
        })}
      </p>
    </div>
  );
}
