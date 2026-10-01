'use client';

/** Настройка мест сторис (F-00-160): число мест, где считаем, цена и наценки — в шторке, а не над доской. */
import { useGuardedClose } from '@/areas/platform/hooks/useGuardedClose';
import { useState } from 'react';
import { saveStoryConfig } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { UnitNumberField } from '@/areas/platform/components/UnitNumberField';
import type { StoryPlacesConfig } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

export function StoryConfigSheet({ config, onClose }: { config: StoryPlacesConfig; onClose: () => void }) {
  const t = useT('platform');
  const toast = useToast();
  const save = useApiMutation(saveStoryConfig);
  const [cfg, setCfg] = useState(config);
  const set = (patch: Partial<StoryPlacesConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const onOpenChange = useGuardedClose(JSON.stringify(cfg) !== JSON.stringify(config), onClose);

  const submit = async () => {
    try {
      await save.mutate({ ...cfg, lastPlacesCount: Math.min(cfg.lastPlacesCount, cfg.places) });
      toast.success(t('ads.configSaved'));
      onClose();
    } catch {
      toast.error(t('ads.saveFailed'));
    }
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title={t('ads.storiesConfigTitle')} description={t('ads.storiesConfigHint')} size="md" footer={<Button fullWidth onClick={submit} loading={save.isPending}>{t('ads.saveConfig')}</Button>}>
      <div className="flex flex-col gap-5">
        <FormField label={t('ads.placesCount')}>
          <SegmentedControl fullWidth value={String(cfg.places)} onValueChange={(v) => set({ places: Number(v) as StoryPlacesConfig['places'] })} options={[5, 6, 10].map((n) => ({ value: String(n), label: String(n) }))} />
        </FormField>
        <FormField label={t('ads.scope')}>
          <SegmentedControl fullWidth value={cfg.scope} onValueChange={(v) => set({ scope: v as StoryPlacesConfig['scope'] })} options={[{ value: 'city', label: t('ads.scopeCity') }, { value: 'district', label: t('ads.scopeDistrict') }]} />
        </FormField>
        <UnitNumberField label={t('ads.pricePerDay')} value={cfg.pricePerDay} unit={t('ads.coinsUnit')} onChange={(n) => set({ pricePerDay: n })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <UnitNumberField label={t('ads.lastPlacesCount')} value={cfg.lastPlacesCount} unit={t('ads.placesUnit')} onChange={(n) => set({ lastPlacesCount: n })} />
          <UnitNumberField label={t('ads.lastPlacesMarkup')} value={cfg.lastPlacesMarkup} unit="%" onChange={(n) => set({ lastPlacesMarkup: n })} />
        </div>
        <UnitNumberField label={t('ads.queueMarkup')} value={cfg.queueMarkup} unit="%" onChange={(n) => set({ queueMarkup: n })} />
      </div>
    </Sheet>
  );
}
