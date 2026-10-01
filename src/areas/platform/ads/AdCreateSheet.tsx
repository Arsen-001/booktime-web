'use client';

/**
 * Новое объявление — секциями, а не стеной полей: «Что показываем» (картинка — обязательна для баннера, в пропорциях
 * места), «Где и кому» (чипами), «Когда и сколько». Для поставщика — сколько бизнесов его увидит, до сохранения (Р19).
 */
import { useGuardedClose } from '@/areas/platform/hooks/useGuardedClose';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { createAd } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useAdPlacements, useAdReach } from '@/areas/platform/hooks/usePlatformData';
import { DISTRICT_IDS } from '@/config/districts';
import { SPHERE_IDS } from '@/config/spheres';
import type { DistrictId, LocaleCode, SphereId } from '@/domain/core';
import type { AdInput, AdKind, AdSize } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, parse, today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { Chip } from '@/ui/Chip';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { FormField } from '@/ui/FormField';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { TagInput } from '@/ui/TagInput';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const SIZES: AdSize[] = ['any', 'individual', 'salonSmall', 'salonLarge'];

function emptyAd(kind: AdKind): AdInput {
  return {
    kind,
    title: '',
    text: '',
    advertiser: { name: kind === 'banner' ? 'BookTime' : '', contact: '' },
    placementId: '',
    target: { sphereIds: [], districts: [], size: 'any' },
    productKeywords: [],
    startDate: today(),
    endDate: addDays(today(), 13),
    price: 0,
  };
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function AdCreateSheet({ kind, onClose }: { kind: AdKind; onClose: () => void }) {
  const t = useT('platform');
  const tc = useT('common');
  const fmt = useFormat();
  const toast = useToast();
  const locale = useLocale() as LocaleCode;
  const placementsQ = useAdPlacements();
  const reachQ = useAdReach();
  const create = useApiMutation(createAd);
  const [initial] = useState<AdInput>(() => emptyAd(kind));
  const [form, setForm] = useState<AdInput>(initial);
  const onOpenChange = useGuardedClose(JSON.stringify(form) !== JSON.stringify(initial), onClose);
  const [showErrors, setShowErrors] = useState(false);
  const set = (patch: Partial<AdInput>) => setForm((f) => ({ ...f, ...patch }));
  const placements = (placementsQ.data ?? []).filter((p) => p.kind === kind);
  const placement = placements.find((p) => p.id === form.placementId);
  const days = form.endDate >= form.startDate ? parse(form.endDate).diff(parse(form.startDate), 'day') + 1 : 0;

  const errors = {
    title: !form.title.trim(),
    image: kind === 'banner' && !form.imageUrl,
    placement: !form.placementId,
    advertiser: kind === 'supplier' && !form.advertiser.name.trim(),
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = async () => {
    if (invalid) return setShowErrors(true);
    try {
      await create.mutate({ ...form, price: form.price || (placement ? placement.pricePerDay * days : 0) });
      toast.success(t('ads.saved'));
      onClose();
    } catch {
      toast.error(t('ads.saveFailed'));
    }
  };

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={kind === 'banner' ? t('ads.addBanner') : t('ads.addSupplier')}
      size="lg"
      footer={
        <Button fullWidth onClick={submit} loading={create.isPending}>
          {t('ads.save')}
        </Button>
      }
    >
      <form noValidate className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <SectionCard title={t('ads.sectionWhat')}>
          <div className="flex flex-col gap-4">
            <FormField label={t('ads.adTitle')} required error={showErrors && errors.title ? t('ads.titleRequired') : undefined}>
              <Input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} />
            </FormField>
            <FormField label={t('ads.text')} optional>
              <Textarea value={form.text ?? ''} onChange={(e) => set({ text: e.target.value })} rows={2} maxLength={160} />
            </FormField>
            <FormField label={t('ads.image')} required={kind === 'banner'} optional={kind !== 'banner'} error={showErrors && errors.image ? t('ads.imageRequired') : undefined} hint={t('ads.imageHint')}>
              <ImageUpload value={form.imageUrl ? [form.imageUrl] : []} onValueChange={(urls) => set({ imageUrl: urls[0] })} max={1} aspect="16/9" label={t('ads.imageAdd')} />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title={t('ads.sectionWhere')}>
          <div className="flex flex-col gap-4">
            <FormField label={t('ads.placement')} required error={showErrors && errors.placement ? t('ads.placementRequired') : undefined}>
              <ChoiceGroup
                value={form.placementId}
                onValueChange={(v) => set({ placementId: v })}
                options={placements.map((p) => ({ value: p.id, title: pickText(p.name, locale), description: t('ads.pricePerDayText', { price: fmt.money(p.pricePerDay) }) }))}
              />
            </FormField>
            <FormField label={t('ads.targetSpheres')} hint={t('ads.chipsHint')}>
              <div className="flex flex-wrap gap-2">
                {SPHERE_IDS.map((s) => (
                  <Chip key={s} selected={form.target.sphereIds.includes(s)} onClick={() => set({ target: { ...form.target, sphereIds: toggle<SphereId>(form.target.sphereIds, s) } })}>
                    {tc(`spheres.${s}`)}
                  </Chip>
                ))}
              </div>
            </FormField>
            <FormField label={t('ads.targetDistricts')} hint={t('ads.chipsHint')}>
              <div className="flex flex-wrap gap-2">
                {DISTRICT_IDS.map((d) => (
                  <Chip key={d} selected={form.target.districts.includes(d)} onClick={() => set({ target: { ...form.target, districts: toggle<DistrictId>(form.target.districts, d) } })}>
                    {tc(`districts.${d}`)}
                  </Chip>
                ))}
              </div>
            </FormField>
            <FormField label={t('ads.targetSize')}>
              <Select value={form.target.size} onValueChange={(v) => set({ target: { ...form.target, size: v as AdSize } })} options={SIZES.map((s) => ({ value: s, label: t(`ads.size.${s}`) }))} />
            </FormField>
            {kind === 'supplier' && (
              <>
                <FormField label={t('ads.minStars')} optional hint={t('ads.minStarsHint')}>
                  <Select
                    value={form.target.minStars ? String(form.target.minStars) : 'any'}
                    onValueChange={(v) => set({ target: { ...form.target, minStars: v === 'any' ? undefined : Number(v) } })}
                    options={[{ value: 'any', label: t('ads.minStarsAny') }, ...[3, 4, 5].map((n) => ({ value: String(n), label: t('ads.minStarsText', { n }) }))]}
                  />
                </FormField>
                {form.placementId === 'pl_stock' && (
                  <FormField label={t('ads.productKeywords')} hint={t('ads.productKeywordsHint')}>
                    <TagInput value={form.productKeywords} onValueChange={(v) => set({ productKeywords: v })} />
                  </FormField>
                )}
                {reachQ.data && <p className="rounded-xl bg-info-soft px-4 py-3 text-sm text-fg">{t('ads.reachBefore', { n: reachQ.data.optedIn, total: reachQ.data.businesses })}</p>}
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title={t('ads.sectionWhen')}>
          <div className="flex flex-col gap-4">
            <FormField label={t('ads.period')}>
              <DateRangePicker value={{ from: form.startDate, to: form.endDate }} onValueChange={(r) => set({ startDate: r.from ?? form.startDate, endDate: r.to ?? r.from ?? form.endDate })} min={today()} />
            </FormField>
            <FormField label={t('ads.price')} hint={placement ? t('ads.priceHint', { price: fmt.money(placement.pricePerDay * days), n: days }) : undefined}>
              <MoneyInput value={form.price || undefined} onValueChange={(v) => set({ price: v ?? 0 })} />
            </FormField>
            {kind === 'supplier' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t('ads.advertiserName')} required error={showErrors && errors.advertiser ? t('ads.advertiserRequired') : undefined}>
                  <Input value={form.advertiser.name} onChange={(e) => set({ advertiser: { ...form.advertiser, name: e.target.value } })} />
                </FormField>
                <FormField label={t('ads.advertiserContact')} optional>
                  <Input value={form.advertiser.contact} onChange={(e) => set({ advertiser: { ...form.advertiser, contact: e.target.value } })} />
                </FormField>
              </div>
            )}
          </div>
        </SectionCard>
      </form>
    </Sheet>
  );
}
