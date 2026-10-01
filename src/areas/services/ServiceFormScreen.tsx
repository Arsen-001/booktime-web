'use client';

/**
 * /biz/services/new и /biz/services/[serviceId] — карточка услуги (хост «serviceCard»).
 * Основное: название на hy/ru/en (У18), категория, тип, онлайн-запись сразу под названием (У20, У24), цена и
 * длительность (У14, У23), кто делает (У21, У22), описание и фото, настройки записи. Вкладки «Материалы» и «Для чека».
 * Сохранение одно на всю форму — липкая полоса внизу, несохранённое видно, уход спрашивает (У3, У17).
 * Удаление — F-16-170 (предупреждение по числу будущих записей, «Отменить» 5 с).
 * Вклады разделов (28.09) — вкладками после своих: хозяин передаёт registerAfterSave/onDirtyChange, вклад пишет своё
 * после сохранения услуги (одна кнопка «Сохранить» на всё). Посещённая вкладка вклада остаётся смонтированной
 * (скрыта), иначе её шаг «после сохранения» отписался бы при переключении. Вклад «online» здесь не показываем:
 * его тумблер и окно времени дублируют «Онлайн-запись» формы (У20/У24) и писали бы мимо черновика.
 */
import { useState } from 'react';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import { useServiceSaveSteps } from '@/extensions/saveHooks';
import { useExtensions } from '@/extensions/useExtensions';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { listPriceLockedServiceIds } from '@/api/network';
import { useApiQuery } from '@/api/request';
import { deleteService, getServiceDeleteImpact, restoreServices } from '@/api/services';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { pickText } from '@/lib/text';
import { BookingSettingsSection, WRAP_SEGMENTS } from '@/areas/services/components/BookingSettingsSection';
import { FormSaveBar } from '@/areas/services/components/FormSaveBar';
import { ServiceReminderField } from '@/areas/services/components/ServiceReminderField';
import { focusField } from '@/areas/services/components/focusField';
import { LocalizedTextField } from '@/areas/services/components/LocalizedTextField';
import { OnlineBookingBlock } from '@/areas/services/components/OnlineBookingBlock';
import { PriceDurationSection } from '@/areas/services/components/PriceDurationSection';
import { ReceiptSection } from '@/areas/services/components/ReceiptSection';
import { ServiceMaterialsTab } from '@/areas/services/components/ServiceMaterialsTab';
import { ServiceStaffSection } from '@/areas/services/components/ServiceStaffSection';
import { UpsellSection } from '@/areas/services/components/UpsellSection';
import { FIELD_IDS, useServiceForm, type ServiceFormErrorKey } from '@/areas/services/useServiceForm';
import type { ServiceKind } from '@/domain/core';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';
import { useConfirm, useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

const ERROR_ORDER: ServiceFormErrorKey[] = ['name', 'category', 'duration', 'durationMax', 'price', 'priceMax'];

export function ServiceFormScreen() {
  const t = useT('services');
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const locale = useLocale() as 'ru' | 'en';
  const canEdit = useCan('services.edit');
  const f = useServiceForm();
  // Сеть4: сеть запретила менять цену этой услуги в филиалах (F-11-082) — цена только для чтения
  const lockedQ = useApiQuery(['network', 'price-locked', f.businessId], () => listPriceLockedServiceIds(f.businessId!), {
    enabled: Boolean(f.businessId) && Boolean(f.serviceId),
  });
  const priceLocked = Boolean(f.serviceId && lockedQ.data?.includes(f.serviceId));
  const { draft, set, errors } = f;
  const [tab, setTab] = useState<string>('main');
  // Вклады разделов в карточку услуги (хост serviceCard)
  const tDyn = useTDynamic();
  const extensions = useExtensions('serviceCard').filter((e) => e.area !== 'online');
  const saveSteps = useServiceSaveSteps();
  const [visitedExt, setVisitedExt] = useState<string[]>([]);
  const [extDirty, setExtDirty] = useState<Record<string, boolean>>({});
  const anyExtDirty = Object.values(extDirty).some(Boolean);
  const dirty = f.dirty || anyExtDirty;
  const { confirmLeave } = useUnsavedGuard(dirty);
  const openTab = (value: string) => {
    setTab(value);
    if (value.startsWith('ext:') && !visitedExt.includes(value)) setVisitedExt((v) => [...v, value]);
  };

  if (f.isError) return <ErrorState onRetry={f.retry} />;

  const toList = () => router.push('/biz/services');
  const cancel = async () => {
    if (await confirmLeave()) toList();
  };

  const save = async () => {
    const e = f.validate();
    const first = ERROR_ORDER.find((k) => e[k]);
    if (first) {
      f.setErrors(e);
      setTab('main');
      focusField(FIELD_IDS[first]);
      return;
    }
    try {
      const saved = f.dirty || f.isNew ? await f.save() : undefined;
      const serviceId = saved?.id ?? f.serviceId;
      // Вклады пишут своё после услуги; ошибка вклада не откатывает услугу — тост и остаёмся на форме
      const failed = serviceId ? await saveSteps.runAfter(serviceId) : [];
      f.markSaved();
      if (failed.length > 0) {
        toast.error(t('form.extSaveFailed'));
        return;
      }
      setExtDirty({});
      if (draft.online && draft.staff.length === 0) toast.info(t('form.savedNoStaff'));
      else toast.success(f.isNew ? t('form.created') : t('form.saved'));
      toList();
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const doDelete = async () => {
    if (!f.serviceId || !f.snapshot) return;
    const impact = await getServiceDeleteImpact(f.serviceId);
    const parts: string[] = [];
    if (impact.staffCount) parts.push(t('delete.impactStaff', { count: impact.staffCount }));
    if (impact.futureBookings) parts.push(t('delete.impactBookings', { count: impact.futureBookings }));
    const name = pickText(f.snapshot.name, locale);
    const ok = await confirm({
      title: t('delete.title', { name }),
      description: parts.length ? parts.join(' · ') : t('delete.noImpact'),
      tone: 'danger',
      confirmLabel: t('delete.confirm'),
    });
    if (!ok) return;
    const snapshot = f.snapshot;
    try {
      await deleteService(f.serviceId, f.businessId ?? '');
      f.markSaved();
      toast.success(t('delete.done', { name }), {
        action: {
          label: t('delete.undo'),
          onClick: () => void restoreServices([snapshot]),
        },
        durationMs: 5000,
      });
      toList();
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const err = (k: ServiceFormErrorKey) => (errors[k] ? t(errors[k] as never) : undefined);
  // Скелетон = та же форма (поля неактивны и пусты), пока услуга читается: пришли данные — поля заполнились, ничего не сдвинулось
  const disabled = !canEdit || f.loading;

  return (
    <div data-f="F-00-082 F-16-170" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={
          f.isNew ? t('form.newTitle') : f.loading && !f.snapshot ? <SkeletonText width="16ch" /> : pickText(f.snapshot?.name, locale) || t('form.editTitle')
        }
        description={f.isNew ? t('form.subtitle') : undefined}
        back={{ href: '/biz/services', label: t('title') }}
        actions={
          !f.isNew && canEdit ? (
            <Button variant="ghost" leftIcon={<Trash2 aria-hidden />} disabled={f.loading} onClick={() => void doDelete()}>
              {t('delete.button')}
            </Button>
          ) : undefined
        }
      />
      <>
          <Tabs
            value={tab}
            onValueChange={openTab}
            items={[
              { value: 'main', label: t('tabs.main') },
              {
                value: 'materials',
                label: t('tabs.materials'),
                disabled: f.isNew,
              },
              { value: 'receipt', label: t('tabs.receipt') },
              ...extensions.map((e) => ({ value: `ext:${e.area}`, label: tDyn(e.labelKey), disabled: f.isNew })),
            ]}
          />

          {tab === 'main' && (
            <div className="flex flex-col gap-6">
              <SectionCard title={t('form.mainTitle')}>
                <div className="flex flex-col gap-4">
                  <div data-f="F-03-115 F-15-141 F-15-142">
                    <LocalizedTextField
                      id={FIELD_IDS.name}
                      label={t('form.nameLabel')}
                      required
                      value={draft.name}
                      onValueChange={(v) => set('name', v)}
                      error={err('name')}
                      autoTranslated={draft.autoTranslated}
                      onEdited={(l) =>
                        l !== 'ru' &&
                        set('autoTranslated', {
                          ...draft.autoTranslated,
                          [l]: false,
                        })
                      }
                      disabled={disabled}
                    />
                  </div>
                  <FormField id={FIELD_IDS.category} label={t('form.categoryLabel')} required error={err('category')}>
                    <Select
                      options={f.categories.map((c) => ({
                        value: c.id,
                        label: pickText(c.name, locale),
                      }))}
                      value={draft.categoryId}
                      onValueChange={(v) => set('categoryId', v)}
                      placeholder={t('form.categoryPlaceholder')}
                      disabled={disabled}
                    />
                  </FormField>
                  <OnlineBookingBlock
                    online={draft.online}
                    onOnlineChange={(v) => set('online', v)}
                    window={draft.window}
                    onWindowChange={(w) => set('window', w)}
                    noStaff={!f.loading && draft.staff.length === 0}
                    disabled={disabled}
                  />
                  <div data-f="F-16-028 F-01-193" className="flex flex-col gap-3">
                    <FormField label={t('form.kindLabel')}>
                      <SegmentedControl
                        fullWidth
                        className={WRAP_SEGMENTS}
                        options={[
                          {
                            value: 'individual',
                            label: t('form.kindIndividual'),
                            disabled: f.loading,
                          },
                          { value: 'group', label: t('form.kindGroup'), disabled: f.loading },
                        ]}
                        value={draft.kind}
                        onValueChange={(v) => set('kind', v as ServiceKind)}
                      />
                    </FormField>
                    {draft.kind === 'group' && (
                      <FormField label={t('form.capacityLabel')}>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={draft.capacity}
                          onChange={(e) => set('capacity', Math.max(2, Number(e.target.value.replace(/\D/g, '')) || 2))}
                          disabled={disabled}
                        />
                      </FormField>
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title={t('form.priceDurationTitle')}>
                <PriceDurationSection draft={draft} set={set} errors={errors} disabled={disabled} priceLocked={priceLocked} />
              </SectionCard>

              <SectionCard title={t('staffTab.title')} description={t('staffTab.description')}>
                <ServiceStaffSection
                  staffList={f.staffList}
                  value={draft.staff}
                  onValueChange={(v) => set('staff', v)}
                  base={{
                    priceMin: draft.free ? 0 : draft.priceMin,
                    priceMax: draft.priceRange ? draft.priceMax : undefined,
                    durationMin: draft.durationMin,
                    durationMax: draft.durationRange ? draft.durationMax : undefined,
                  }}
                  canEdit={canEdit}
                />
              </SectionCard>

              <SectionCard title={t('upsell.title')} description={t('upsell.description')}>
                <UpsellSection
                  businessId={f.businessId}
                  serviceId={f.serviceId}
                  value={draft.upsell}
                  onValueChange={(v) => set('upsell', v)}
                  disabled={disabled}
                />
              </SectionCard>

              <SectionCard title={t('form.aboutTitle')}>
                <div className="flex flex-col gap-4">
                  <LocalizedTextField
                    multiline
                    label={t('form.descriptionLabel')}
                    value={draft.description}
                    onValueChange={(v) => set('description', v)}
                    disabled={disabled}
                  />
                  <FormField label={t('form.photosLabel')} hint={t('form.photosHint')}>
                    <ImageUpload value={draft.photos} onValueChange={(v) => set('photos', v)} max={6} aspect="square" disabled={disabled} />
                  </FormField>
                </div>
              </SectionCard>

              <SectionCard title={t('form.timingTitle')}>
                <BookingSettingsSection draft={draft} set={set} disabled={disabled} />
                {f.serviceId && f.businessId && (
                  <div className="mt-4">
                    <ServiceReminderField businessId={f.businessId} serviceId={f.serviceId} />
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {tab === 'materials' && f.serviceId && (
            <SectionCard title={t('tabs.materials')}>
              <div data-f="F-00-089">
                <ServiceMaterialsTab serviceId={f.serviceId} />
              </div>
            </SectionCard>
          )}

          {tab === 'receipt' && <ReceiptSection draft={draft} set={set} disabled={disabled} />}

          {f.serviceId &&
            f.businessId &&
            extensions
              .filter((e) => visitedExt.includes(`ext:${e.area}`))
              .map((e) => (
                <div key={e.area} hidden={tab !== `ext:${e.area}`}>
                  <SectionCard title={tDyn(e.labelKey)}>
                    <ExtensionSlot
                      entry={e}
                      props={{
                        mode: 'edit',
                        serviceId: f.serviceId!,
                        businessId: f.businessId!,
                        registerAfterSave: saveSteps.registerAfterSave,
                        onDirtyChange: (d: boolean) => setExtDirty((prev) => (prev[e.area] === d ? prev : { ...prev, [e.area]: d })),
                      }}
                    />
                  </SectionCard>
                </div>
              ))}

          <FormSaveBar
            dirty={dirty}
            saving={f.saving}
            isNew={f.isNew}
            canEdit={canEdit}
            onSave={() => void save()}
            onCancel={() => void cancel()}
          />
      </>
    </div>
  );
}
