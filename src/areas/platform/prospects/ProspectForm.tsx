'use client';

/** Правка места в карточке: название и где, чем ведут запись, сколько мастеров, контакты и ссылки. */
import { useState } from 'react';
import { updateProspect } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { BOOKING_SYSTEMS, PROSPECT_CATEGORIES, PROSPECT_DISTRICTS, type BookingSystem, type ProspectCard, type ProspectCategory, type ProspectDistrict, type ProspectPatch } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { useToast } from '@/ui/Toast';

interface Draft {
  name: string;
  category: ProspectCategory;
  district: ProspectDistrict;
  address: string;
  branches: string;
  staffEstimate: string;
  staffSource: string;
  bookingSystem: BookingSystem;
  bookingUrl: string;
  website: string;
  instagram: string;
  phone: string;
}

function draftOf(p: ProspectCard): Draft {
  return {
    name: p.name,
    category: p.category,
    district: p.district,
    address: p.address ?? '',
    branches: p.branches !== undefined ? String(p.branches) : '',
    staffEstimate: p.staffEstimate !== undefined ? String(p.staffEstimate) : '',
    staffSource: p.staffSource ?? '',
    bookingSystem: p.bookingSystem,
    bookingUrl: p.bookingUrl ?? '',
    website: p.website ?? '',
    instagram: p.instagram ?? '',
    phone: p.phone ?? '',
  };
}

const num = (s: string) => (s.trim() ? Math.max(0, Math.round(Number(s))) : null);

export function ProspectForm({ prospect, onDone }: { prospect: ProspectCard; onDone: () => void }) {
  const t = useT('platform');
  const tc = useT('common');
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => draftOf(prospect));
  const [error, setError] = useState(false);
  const save = useApiMutation((patch: ProspectPatch) => updateProspect(prospect.id, patch, prospect.version));
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 5);

  const submit = async () => {
    if (!d.name.trim()) return setError(true);
    try {
      await save.mutate({
        name: d.name.trim(),
        category: d.category,
        district: d.district,
        address: d.address,
        branches: num(d.branches),
        staffEstimate: num(d.staffEstimate),
        staffSource: d.staffSource,
        bookingSystem: d.bookingSystem,
        bookingUrl: d.bookingUrl,
        website: d.website,
        instagram: d.instagram,
        phone: d.phone,
      });
      toast.success(t('prospects.saved'));
      onDone();
    } catch (e) {
      toast.error((e as { code?: string }).code === 'conflict' ? t('prospects.conflict') : t('prospects.saveFailed'));
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <SectionCard title={t('prospects.aboutTitle')} padding="md">
        <div className="flex flex-col gap-4">
          <FormField label={t('prospects.field.name')} required error={error && !d.name.trim() ? t('prospects.nameRequired') : undefined}>
            <Input value={d.name} onChange={(e) => set({ name: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('prospects.field.category')}>
              <Select value={d.category} onValueChange={(v) => set({ category: v as ProspectCategory })} options={PROSPECT_CATEGORIES.map((c) => ({ value: c, label: t(`prospects.category.${c}`) }))} />
            </FormField>
            <FormField label={t('prospects.field.district')}>
              <Select
                value={d.district}
                onValueChange={(v) => set({ district: v as ProspectDistrict })}
                options={PROSPECT_DISTRICTS.map((x) => ({ value: x, label: x === 'unknown' ? t('prospects.districtUnknown') : tc(`districts.${x}`) }))}
              />
            </FormField>
          </div>
          <FormField label={t('prospects.field.address')} optional>
            <Input value={d.address} onChange={(e) => set({ address: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('prospects.field.staff')} optional>
              <Input inputMode="numeric" value={d.staffEstimate} onChange={(e) => set({ staffEstimate: digits(e.target.value) })} />
            </FormField>
            <FormField label={t('prospects.field.branches')} optional>
              <Input inputMode="numeric" value={d.branches} onChange={(e) => set({ branches: digits(e.target.value) })} />
            </FormField>
          </div>
          <FormField label={t('prospects.field.staffSource')} optional>
            <Input value={d.staffSource} onChange={(e) => set({ staffSource: e.target.value })} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('prospects.linksTitle')} padding="md">
        <div className="flex flex-col gap-4">
          <FormField label={t('prospects.field.system')}>
            <Select value={d.bookingSystem} onValueChange={(v) => set({ bookingSystem: v as BookingSystem })} options={BOOKING_SYSTEMS.map((s) => ({ value: s, label: t(`prospects.system.${s}`) }))} />
          </FormField>
          <FormField label={t('prospects.field.bookingUrl')} optional>
            <Input inputMode="url" value={d.bookingUrl} onChange={(e) => set({ bookingUrl: e.target.value })} />
          </FormField>
          <FormField label={t('prospects.field.website')} optional>
            <Input inputMode="url" value={d.website} onChange={(e) => set({ website: e.target.value })} />
          </FormField>
          <FormField label={t('prospects.field.instagram')} optional>
            <Input value={d.instagram} onChange={(e) => set({ instagram: e.target.value })} />
          </FormField>
          <FormField label={t('prospects.field.phone')} optional>
            <Input inputMode="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} />
          </FormField>
        </div>
      </SectionCard>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onDone}>
          {tc('actions.cancel')}
        </Button>
        <Button type="submit" className="flex-1" loading={save.isPending}>
          {t('prospects.save')}
        </Button>
      </div>
    </form>
  );
}
