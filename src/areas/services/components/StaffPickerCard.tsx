'use client';

/**
 * «Чей профиль» — выпадающий с шевроном; у каждого мастера видно, сколько у него на этом экране (У28): «Сона · 4».
 * Смена мастера при несохранённом черновике спрашивает экран (beforeChange).
 */
import type { StaffContentCounts } from '@/api/services';
import { useT } from '@/i18n/useT';
import type { StaffPickerResult } from '@/areas/services/components/useStaffPicker';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';

export interface StaffPickerCardProps {
  picker: StaffPickerResult;
  kind: keyof StaffContentCounts;
  beforeChange?: () => Promise<boolean>;
}

export function StaffPickerCard({ picker, kind, beforeChange }: StaffPickerCardProps) {
  const t = useT('services');
  if (picker.fixed) return null;
  return (
    <SectionCard title={t('photos.whoLabel')} padding="sm">
      {picker.isLoading ? (
        // Тот же выпадающий (неактивный), пока мастера читаются — карточка сразу своей высоты
        <Select aria-label={t('photos.whoLabel')} options={[]} value="" onValueChange={() => {}} placeholder={t('photos.whoPlaceholder')} disabled />
      ) : (
        <Select
          aria-label={t('photos.whoLabel')}
          options={picker.staffList.map((s) => {
            const n = picker.counts[s.id]?.[kind] ?? 0;
            return {
              value: s.id,
              label: n ? t('picker.withCount', { name: s.name, count: n }) : t('picker.empty', { name: s.name }),
            };
          })}
          value={picker.staffId}
          onValueChange={async (id) => {
            if (beforeChange && !(await beforeChange())) return;
            picker.setStaffId(id);
          }}
          placeholder={t('photos.whoPlaceholder')}
        />
      )}
    </SectionCard>
  );
}
