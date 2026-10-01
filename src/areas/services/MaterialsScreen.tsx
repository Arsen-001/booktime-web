'use client';

/**
 * /biz/services/materials — материалы, которыми работает мастер (F-00-089), и стерилизация инструмента
 * (F-00-090). Владелец/админ выбирают мастера; мастер видит только себя. Товары склада с «Показывать
 * клиентам» показаны отдельным read-only блоком (F-00-144, api stock.listClientMaterials).
 * Правки — черновик с «Сохранить» внизу и вопросом при уходе (У3, У17); по умолчанию — первый мастер с материалами (У28).
 */
import { useState } from 'react';
import { PackageSearch } from 'lucide-react';
import Link from 'next/link';
import { getSterilization, getStaffMaterials, MATERIAL_TAG_IDS, saveMaterialsProfile } from '@/api/services';
import { listClientMaterials } from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { FormSaveBar } from '@/areas/services/components/FormSaveBar';
import { StaffPickerCard } from '@/areas/services/components/StaffPickerCard';
import { useStaffPicker } from '@/areas/services/components/useStaffPicker';
import { Chip } from '@/ui/Chip';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { TagInput } from '@/ui/TagInput';
import { Textarea } from '@/ui/Textarea';
import type { SterilizationMethod } from '@/domain/services';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

const METHODS: SterilizationMethod[] = ['autoclave', 'craftBags', 'disposable'];

export function MaterialsScreen() {
  const t = useT('services');
  const { ready, businessId, activeLocationIds } = useCurrent();
  const canEdit = useCan('services.edit');
  const toast = useToast();
  const picker = useStaffPicker('materials');
  const staffId = picker.staffId;

  const enabled = ready && Boolean(businessId) && Boolean(staffId);
  const materialsQ = useApiQuery(['services', 'staffMaterials', staffId], () => getStaffMaterials(staffId!), { enabled });
  const sterilizationQ = useApiQuery(['services', 'sterilization', staffId], () => getSterilization(staffId!), { enabled });
  const locationId = activeLocationIds[0];
  const stockQ = useApiQuery(['services', 'clientMaterials', businessId, locationId], () => listClientMaterials(businessId!, locationId!), {
    enabled: ready && Boolean(businessId) && Boolean(locationId),
  });

  const saveM = useApiMutation((d: { presetIds: string[]; custom: string[]; methods: SterilizationMethod[]; note: string }) =>
    saveMaterialsProfile(
      staffId ?? '',
      businessId ?? '',
      { presetIds: d.presetIds, custom: d.custom },
      { methods: d.methods, note: d.note.trim() || undefined },
    ),
  );

  const [presetIds, setPresetIds] = useState<string[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [methods, setMethods] = useState<SterilizationMethod[]>([]);
  const [note, setNote] = useState('');
  const [initial, setInitial] = useState<string>('');
  const [filledFor, setFilledFor] = useState<string | undefined>(undefined);

  const bothLoaded = !materialsQ.isLoading && !sterilizationQ.isLoading;
  if (filledFor !== staffId && materialsQ.data && bothLoaded) {
    const d = {
      presetIds: materialsQ.data.presetIds,
      custom: materialsQ.data.custom,
      methods: sterilizationQ.data?.methods ?? [],
      note: sterilizationQ.data?.note ?? '',
    };
    setPresetIds(d.presetIds);
    setCustom(d.custom);
    setMethods(d.methods);
    setNote(d.note);
    setInitial(JSON.stringify(d));
    setFilledFor(staffId);
  }
  const current = { presetIds, custom, methods, note };
  const dirty = filledFor === staffId && initial !== '' && JSON.stringify(current) !== initial;
  const { confirmLeave } = useUnsavedGuard(dirty);

  const loading = !picker.ready || materialsQ.isLoading || sterilizationQ.isLoading || (Boolean(staffId) && filledFor !== staffId);
  if (picker.isError) return <ErrorState onRetry={picker.refetch} />;
  if (materialsQ.isError) return <ErrorState onRetry={materialsQ.refetch} />;

  const togglePreset = (id: string, checked: boolean) => setPresetIds(checked ? [...presetIds, id] : presetIds.filter((p) => p !== id));
  const toggleMethod = (m: SterilizationMethod, checked: boolean) => setMethods(checked ? [...methods, m] : methods.filter((x) => x !== m));

  const save = async () => {
    try {
      await saveM.mutate(current);
      setInitial(JSON.stringify(current));
      toast.success(t('materials.saved'));
    } catch {
      toast.error(t('materials.saveFailed'));
    }
  };

  return (
    <div data-f="F-00-089 F-00-090" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('materials.title')} description={t('materials.subtitle')} />

      <StaffPickerCard picker={picker} kind="materials" beforeChange={confirmLeave} />

      {/* Скелетон = та же форма: галочки и поля неактивны, пока профиль мастера читается — ничего не сдвигается */}
      {!loading && !staffId ? (
        <ErrorState compact title={t('photos.noStaff')} />
      ) : (
        <>
          <SectionCard title={t('materials.tagsTitle')} description={t('materials.tagsHint')}>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MATERIAL_TAG_IDS.map((id) => (
                  <Checkbox
                    key={id}
                    checked={presetIds.includes(id)}
                    onCheckedChange={(v) => togglePreset(id, v)}
                    disabled={!canEdit || loading}
                    label={t(`materials.tags.${id}` as never)}
                  />
                ))}
              </div>
              <TagInput value={custom} onValueChange={setCustom} placeholder={t('materials.customPlaceholder')} disabled={!canEdit || loading} />
            </div>
          </SectionCard>

          <SectionCard title={t('materials.sterilizationTitle')} description={t('materials.sterilizationHint')}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                {METHODS.map((m) => (
                  <Checkbox
                    key={m}
                    checked={methods.includes(m)}
                    onCheckedChange={(v) => toggleMethod(m, v)}
                    disabled={!canEdit || loading}
                    label={t(`materials.method.${m}` as never)}
                  />
                ))}
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('materials.notePlaceholder')}
                rows={2}
                disabled={!canEdit || loading}
              />
            </div>
          </SectionCard>

          <SectionCard title={t('materials.stockTitle')} description={t('materials.stockHint')}>
            {stockQ.isLoading ? (
              // Те же чипы материалов — полосами
              <div className="flex flex-wrap gap-2" aria-busy>
                {['14ch', '18ch', '12ch'].map((w) => (
                  <Chip key={w}>
                    <SkeletonText width={w} />
                  </Chip>
                ))}
              </div>
            ) : (stockQ.data ?? []).length === 0 ? (
              <EmptyState
                compact
                icon={<PackageSearch aria-hidden />}
                title={t('materials.stockEmpty')}
                action={
                  <Link href="/biz/stock" className="text-sm font-medium text-primary-text hover:underline">
                    {t('materials.stockOpen')}
                  </Link>
                }
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(stockQ.data ?? []).map((item) => (
                  <Chip key={item.id}>{item.brand ? `${item.brand} · ${item.name}` : item.name}</Chip>
                ))}
              </div>
            )}
          </SectionCard>
          <FormSaveBar dirty={dirty} saving={saveM.isPending} canEdit={canEdit} onSave={() => void save()} />
        </>
      )}
    </div>
  );
}
