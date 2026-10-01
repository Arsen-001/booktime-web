'use client';

/**
 * /biz/resources/packages/[packageId] — форма пакета (F-16-109…122, F-16-172): четыре вкладки «Основные
 * настройки / Онлайн-запись / Ресурсы / Языки» (F-16-109), состав и порядок услуг (F-16-110…113),
 * стоимость (F-16-115/116), доступность и предоплата онлайн (F-16-117…119), ресурсы пакета (F-16-120),
 * переводы названия — тот же LocalizedNameField (F-16-121), правка/удаление (F-16-172).
 */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { GripVertical, Trash2 } from 'lucide-react';
import { coreList } from '@/api/core';
import {
  countFuturePackageBookings,
  deletePackage,
  getPackage,
  listResources,
  packageCanSequentialSame,
  packageDuration,
  packagePrice,
  packagePriceMethodsAvailable,
  packageUnconfiguredServiceIds,
  PACKAGE_DELETE_WORD,
  savePackage,
  toPackageServiceLite,
  validatePackageComposition,
  type PackageAvailabilityWindow,
  type PackagePricingMethod,
} from '@/api/resources';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { LocalizedText, ServicePackage } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { EntityMultiPicker } from '@/areas/resources/components/EntityMultiPicker';
import { LocalizedNameField } from '@/areas/resources/components/LocalizedNameField';
import { useResourcesRights } from '@/areas/resources/lib/rights';

export interface PackageFormScreenProps {
  packageId: string;
}

type Tab = 'main' | 'online' | 'resources' | 'languages';

const ONLINE_DESCRIPTION_MAX = 450;

export function PackageFormScreen({ packageId }: PackageFormScreenProps) {
  const t = useT('resources');
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const canManage = useResourcesRights().editServiceResources;

  const [tab, setTab] = useState<Tab>('main');

  const pkgQ = useApiQuery(['resources', 'package', packageId], () => getPackage(packageId), { enabled: ready });
  const servicesQ = useApiQuery(['resources', 'services-for-form', businessId], () => coreList('services', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const resourcesForPickQ = useApiQuery(['resources', 'list', businessId], () => listResources(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const futureBookingsQ = useApiQuery(['resources', 'package-future-bookings', packageId], () => countFuturePackageBookings(packageId), { enabled: ready });

  const eligibleServices = useMemo(() => (servicesQ.data ?? []).filter((s) => s.kind === 'individual' && !s.servicePackage), [servicesQ.data]);
  const servicesById = useMemo(() => toPackageServiceLite(servicesQ.data ?? []), [servicesQ.data]);

  // Черновик — загружается из данных пакета один раз при смене id (правило проекта: во время рендера, не в useEffect)
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [name, setName] = useState<LocalizedText>({ ru: '' });
  const [categoryId, setCategoryId] = useState('');
  const [items, setItems] = useState<{ serviceId: string; qty: number }[]>([]);
  const [mode, setMode] = useState<ServicePackage['mode']>('sequentialAny');
  const [pricingMethod, setPricingMethod] = useState<PackagePricingMethod>('sumServices');
  const [manualPrice, setManualPrice] = useState<number | undefined>(undefined);
  const [discountPercent, setDiscountPercent] = useState<number | undefined>(10);
  const [onlineBookable, setOnlineBookable] = useState(false);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [availability, setAvailability] = useState<PackageAvailabilityWindow>({ enabled: false, days: 'any' });
  const [prepaymentRequired, setPrepaymentRequired] = useState(false);
  const [wholeResourceIds, setWholeResourceIds] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');

  if (pkgQ.data && loadedId !== packageId) {
    const p = pkgQ.data;
    setName(p.name);
    setCategoryId(p.categoryId);
    setItems((p.servicePackage?.items ?? []).map((it) => ({ serviceId: it.serviceId, qty: 1 })).reduce<{ serviceId: string; qty: number }[]>((acc, cur) => {
      const found = acc.find((a) => a.serviceId === cur.serviceId);
      if (found) found.qty += 1;
      else acc.push(cur);
      return acc;
    }, []));
    setMode(p.servicePackage?.mode ?? 'sequentialAny');
    setPricingMethod(p.extra.pricingMethod);
    setManualPrice(p.extra.manualPrice);
    setDiscountPercent(p.extra.discountPercent ?? 10);
    setOnlineBookable(p.onlineBookable);
    setDescription(p.description?.ru ?? '');
    setPhotos(p.photos ?? []);
    setAvailability(p.extra.availability);
    setPrepaymentRequired(p.extra.prepaymentRequired);
    setWholeResourceIds(p.extra.wholePackageResourceIds);
    setLoadedId(packageId);
  }

  const categoriesQ = useApiQuery(['resources', 'service-categories', businessId], () => coreList('serviceCategories', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });

  const save = useApiMutation((patch: Parameters<typeof savePackage>[1]) => savePackage(packageId, patch));
  const remove = useApiMutation(() => deletePackage(packageId));

  const flatItems = useMemo(() => items.flatMap((i) => Array.from({ length: i.qty }, () => ({ serviceId: i.serviceId, order: 0 }))), [items]);
  const composition = validatePackageComposition(items);
  const duration = packageDuration(items, servicesById, mode);
  const priceResult = packagePrice(items, servicesById, pricingMethod, manualPrice, discountPercent);
  const availableMethods = packagePriceMethodsAvailable(items, servicesById);
  const canSequentialSame = packageCanSequentialSame(items, servicesById);
  const unconfigured = packageUnconfiguredServiceIds(items, servicesById);
  const serviceOptions = useMemo(() => eligibleServices.map((s) => ({ id: s.id, label: pickText(s.name, locale) })), [eligibleServices, locale]);
  const resourceOptions = useMemo(
    () => (resourcesForPickQ.data ?? []).filter((r) => r.active).map((r) => ({ id: r.id, label: pickText(r.name, locale) })),
    [resourcesForPickQ.data, locale],
  );

  const onPickServices = (nextIds: string[]) => {
    // EntityMultiPicker работает с уникальными id — количество (qty) сохраняем, новые добавляются с qty=1
    const counts = new Map<string, number>();
    for (const id of nextIds) counts.set(id, (items.find((i) => i.serviceId === id)?.qty ?? 1));
    setItems(nextIds.map((id) => ({ serviceId: id, qty: counts.get(id) ?? 1 })));
  };
  const changeQty = (serviceId: string, delta: number) => {
    setItems((prev) => prev.map((i) => (i.serviceId === serviceId ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  };
  const removeItem = (serviceId: string) => setItems((prev) => prev.filter((i) => i.serviceId !== serviceId));
  const moveItem = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const payload = {
    name,
    categoryId,
    items: flatItems.map((it, i) => ({ serviceId: it.serviceId, order: i })),
    mode,
    onlineBookable,
    description: { ru: description },
    photos,
    extra: { pricingMethod, manualPrice, discountPercent, availability, prepaymentRequired, wholePackageResourceIds: wholeResourceIds },
  };
  // Снимок сохранённого: от него «есть несохранённое» — кнопка «Сохранить» и вопрос при уходе (раньше их не было)
  const payloadJson = JSON.stringify(payload);
  const [baseline, setBaseline] = useState<string | null>(null);
  if (loadedId === packageId && baseline === null) setBaseline(payloadJson);
  const dirty = Boolean(canManage && baseline !== null && baseline !== payloadJson);
  const { confirmLeave } = useUnsavedGuard(dirty);

  if (pkgQ.isError) {
    return (
      <div className="mx-auto w-full max-w-[760px]">
        {/* Путь назад и при ошибке — как у карточки ресурса */}
        <PageHeader title={t('packages.title')} back={{ href: '/biz/resources/packages' }} />
        <ErrorState onRetry={pkgQ.refetch} />
      </div>
    );
  }

  const submit = async () => {
    if (!name.ru.trim()) {
      setNameError(t('form.nameRequired'));
      setTab('main');
      toast.error(t('form.fixErrors'));
      return;
    }
    // Раньше неверный состав молча ничего не делал — показываем, где ошибка
    if (composition !== 'ok') {
      setTab('main');
      toast.error(composition === 'tooFew' ? t('packages.tooFew') : t('packages.tooMany'));
      return;
    }
    try {
      await save.mutate(payload);
      setBaseline(payloadJson);
      toast.success(t('form.updated'));
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const doDelete = async () => {
    try {
      await remove.mutate(undefined);
      toast.success(t('packages.deleted'));
      router.push('/biz/resources/packages');
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const tabItems = [
    { value: 'main' as const, label: t('packages.tabs.main') },
    { value: 'online' as const, label: t('packages.tabs.online') },
    { value: 'resources' as const, label: t('packages.tabs.resources') },
    { value: 'languages' as const, label: t('packages.tabs.languages') },
  ];

  return (
    <div data-f="F-16-109 F-16-172" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={pkgQ.data ? pickText(pkgQ.data.name, locale) : t('detail.loading')}
        back={{ href: '/biz/resources/packages' }}
        actions={
          canManage && pkgQ.data ? (
            <Button variant="ghost" className="text-danger" leftIcon={<Trash2 aria-hidden className="size-4" />} onClick={() => setDeleteOpen(true)}>
              {t('detail.delete')}
            </Button>
          ) : undefined
        }
      />

      {!ready || pkgQ.isLoading || !pkgQ.data ? (
        <Skeleton lines={10} />
      ) : (
        <>
          <Tabs items={tabItems} value={tab} onValueChange={(v) => setTab(v as Tab)} />

          {tab === 'main' && (
            <div className="flex flex-col gap-6">
              <LocalizedNameField
                value={name}
                onValueChange={(v) => {
                  setName(v);
                  if (v.ru.trim()) setNameError(undefined);
                }}
                labels={{ ru: t('form.nameRu'), en: t('form.nameEn') }}
                placeholder={t('packages.namePlaceholder')}
                error={nameError}
              />
              <FormField label={t('packages.category')}>
                <Select
                  disabled={!canManage}
                  value={categoryId}
                  onValueChange={setCategoryId}
                  options={(categoriesQ.data ?? []).map((c) => ({ value: c.id, label: pickText(c.name, locale) }))}
                />
              </FormField>
              <FormField label={t('packages.typeLabel')}>
                <Input value={t('packages.typeValue')} disabled readOnly />
              </FormField>

              <div data-f="F-16-110 F-16-111 F-16-112" className="flex flex-col gap-3 border-t border-border pt-5">
                <p className="text-sm font-semibold text-fg">{t('packages.servicesTitle')}</p>
                <EntityMultiPicker
                  options={serviceOptions}
                  value={items.map((i) => i.serviceId)}
                  onValueChange={onPickServices}
                  title={t('packages.servicesTitle')}
                  placeholder={t('packages.servicesPlaceholder')}
                  searchPlaceholder={t('form.servicesSearch')}
                  emptyText={t('form.servicesEmpty')}
                  disabled={!canManage}
                />
                {items.length === 0 ? (
                  <p className="text-sm text-muted">{t('packages.servicesEmptyHint')}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {items.map((item, i) => {
                      const svc = eligibleServices.find((s) => s.id === item.serviceId);
                      const notConfigured = unconfigured.includes(item.serviceId);
                      return (
                        <li key={item.serviceId} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2">
                          {mode !== 'parallel' && (
                            <span className="flex flex-col text-muted">
                              <button type="button" disabled={!canManage || i === 0} onClick={() => moveItem(i, -1)} aria-label={t('packages.moveUp')} className="disabled:opacity-30">
                                <GripVertical aria-hidden className="size-4" />
                              </button>
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-fg">{svc ? pickText(svc.name, locale) : item.serviceId}</span>
                            {notConfigured && <Badge tone="warning">{t('packages.notConfiguredItem')}</Badge>}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" disabled={!canManage} onClick={() => changeQty(item.serviceId, -1)} aria-label="−">
                              −
                            </Button>
                            <span className="w-6 text-center text-sm tabular-nums">{item.qty}</span>
                            <Button variant="outline" size="sm" disabled={!canManage} onClick={() => changeQty(item.serviceId, 1)} aria-label="+">
                              +
                            </Button>
                          </span>
                          <IconButton icon={<Trash2 aria-hidden />} label={t('packages.removeService')} variant="ghost" size="sm" disabled={!canManage} onClick={() => removeItem(item.serviceId)} />
                        </li>
                      );
                    })}
                  </ul>
                )}
                {composition === 'tooFew' && <p className="text-sm text-danger">{t('packages.tooFew')}</p>}
                {composition === 'tooMany' && <p className="text-sm text-danger">{t('packages.tooMany')}</p>}
              </div>

              <div data-f="F-16-113" className="flex flex-col gap-3 border-t border-border pt-5">
                <p className="text-sm font-semibold text-fg">{t('packages.orderTitle')}</p>
                <ChoiceGroup
                  columns={1}
                  value={mode}
                  onValueChange={(v) => setMode(v as ServicePackage['mode'])}
                  options={[
                    { value: 'parallel', title: t('packages.orderParallel'), description: t('packages.orderParallelHint') },
                    {
                      value: 'sequentialSame',
                      title: t('packages.orderSequentialSame'),
                      description: t('packages.orderSequentialSameHint'),
                      disabled: !canSequentialSame,
                    },
                    { value: 'sequentialAny', title: t('packages.orderSequentialAny'), description: t('packages.orderSequentialAnyHint') },
                  ]}
                />
                <p data-f="F-16-114" className="text-sm text-muted">{t("packages.durationValue", { value: format.durationRange(duration.min, duration.max) })}</p>
              </div>

              <div data-f="F-16-115 F-16-116 F-06-185" className="flex flex-col gap-3 border-t border-border pt-5">
                <p className="text-sm font-semibold text-fg">{t('packages.priceTitle')}</p>
                <ChoiceGroup
                  columns={1}
                  value={pricingMethod}
                  onValueChange={(v) => setPricingMethod(v as PackagePricingMethod)}
                  options={[
                    { value: 'sumServices', title: t('packages.priceSum'), disabled: !availableMethods.includes('sumServices') },
                    { value: 'manual', title: t('packages.priceManual') },
                    { value: 'discountPercent', title: t('packages.priceDiscount'), disabled: !availableMethods.includes('discountPercent') },
                  ]}
                />
                {pricingMethod === 'manual' && (
                  <FormField label={t('packages.manualPriceLabel')}>
                    <MoneyInput value={manualPrice} onValueChange={setManualPrice} disabled={!canManage} />
                  </FormField>
                )}
                {pricingMethod === 'discountPercent' && (
                  <FormField label={t('packages.discountLabel')}>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={discountPercent ?? 0}
                      onChange={(e) => setDiscountPercent(Number(e.target.value))}
                      disabled={!canManage}
                    />
                  </FormField>
                )}
                <p className="text-sm text-muted">{t('packages.priceValue', { value: format.moneyRange(priceResult.min, priceResult.max) })}</p>
              </div>
            </div>
          )}

          {tab === 'online' && (
            <div data-f="F-16-117 F-16-118 F-16-119" className="flex flex-col gap-6">
              <Switch checked={onlineBookable} onCheckedChange={setOnlineBookable} disabled={!canManage} label={t('packages.onlineSwitch')} description={t('packages.onlineSwitchHint')} />
              <FormField label={t('packages.onlineDescription')} hint={t('packages.onlineDescriptionHint', { max: ONLINE_DESCRIPTION_MAX })}>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, ONLINE_DESCRIPTION_MAX))}
                  rows={3}
                  disabled={!canManage}
                  maxLength={ONLINE_DESCRIPTION_MAX}
                />
              </FormField>
              <FormField label={t('packages.onlineImage')}>
                <ImageUpload value={photos} onValueChange={setPhotos} max={1} aspect="16/9" disabled={!canManage} />
              </FormField>

              <div className="flex flex-col gap-3 border-t border-border pt-5">
                <Switch
                  checked={availability.enabled}
                  onCheckedChange={(v) => setAvailability((a) => ({ ...a, enabled: v }))}
                  disabled={!canManage}
                  label={t('packages.limitedSwitch')}
                  description={t('packages.limitedSwitchHint')}
                />
                {availability.enabled && (
                  <div className="flex flex-col gap-3 pl-1">
                    <div className="flex gap-3">
                      <FormField label={t('packages.dateFrom')} className="flex-1">
                        <DatePicker value={availability.dateFrom ?? null} onValueChange={(d) => setAvailability((a) => ({ ...a, dateFrom: d ?? undefined }))} disabled={!canManage} />
                      </FormField>
                      <FormField label={t('packages.dateTo')} className="flex-1">
                        <DatePicker value={availability.dateTo ?? null} onValueChange={(d) => setAvailability((a) => ({ ...a, dateTo: d ?? undefined }))} disabled={!canManage} />
                      </FormField>
                    </div>
                    <FormField label={t('packages.days')}>
                      <Select
                        disabled={!canManage}
                        value={availability.days}
                        onValueChange={(v) => setAvailability((a) => ({ ...a, days: v as PackageAvailabilityWindow['days'] }))}
                        options={[
                          { value: 'any', label: t('packages.daysAny') },
                          { value: 'weekdays', label: t('packages.daysWeekdays') },
                          { value: 'weekend', label: t('packages.daysWeekend') },
                        ]}
                      />
                    </FormField>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-5">
                <Switch checked={prepaymentRequired} onCheckedChange={setPrepaymentRequired} disabled={!canManage} label={t('packages.prepaySwitch')} description={t('packages.prepaySwitchHint')} />
              </div>
            </div>
          )}

          {tab === 'resources' && (
            <div data-f="F-16-120" className="flex flex-col gap-4">
              <p className="text-sm text-muted">{t('packages.resourcesHint')}</p>
              {resourcesForPickQ.isLoading ? (
                <Skeleton lines={3} />
              ) : resourceOptions.length === 0 ? (
                <EmptyState compact title={t('packages.resourcesEmpty')} />
              ) : (
                <EntityMultiPicker
                  options={resourceOptions}
                  value={wholeResourceIds}
                  onValueChange={setWholeResourceIds}
                  title={t('packages.resourcesTitle')}
                  placeholder={t('packages.resourcesPlaceholder')}
                  searchPlaceholder={t('form.servicesSearch')}
                  emptyText={t('form.servicesEmpty')}
                  disabled={!canManage}
                />
              )}
              <p className="text-xs text-muted">{t('packages.serviceResourcesHint')}</p>
            </div>
          )}

          {tab === 'languages' && (
            <div data-f="F-16-121" className="flex flex-col gap-3">
              <p className="text-sm text-muted">{t('packages.languagesHint')}</p>
              <LocalizedNameField
                value={name}
                onValueChange={setName}
                labels={{ ru: t('form.nameRu'), en: t('form.nameEn') }}
                placeholder={t('packages.namePlaceholder')}
              />
            </div>
          )}

          <p data-f="F-16-122 F-16-135" className="text-xs text-muted">{t("packages.notPackagedHint")}</p>
        </>
      )}

      {canManage && pkgQ.data && (
        <StickyActionBar desktop="inline">
          <Button variant="ghost" onClick={async () => (await confirmLeave()) && router.push('/biz/resources/packages')}>
            {t('form.cancel')}
          </Button>
          <Button loading={save.isPending} disabled={!dirty} onClick={submit}>
            {t('form.save')}
          </Button>
        </StickyActionBar>
      )}

      <Modal
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleteWord('');
        }}
        title={t('packages.deleteTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('form.cancel')}
            </Button>
            <Button variant="danger" disabled={deleteWord.trim() !== PACKAGE_DELETE_WORD} loading={remove.isPending} onClick={doDelete}>
              {t('detail.delete')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg">{t('packages.deleteWarning')}</p>
          {Boolean(futureBookingsQ.data) && <p className="text-sm text-warning">{t('packages.deleteFutureBookings', { count: futureBookingsQ.data ?? 0 })}</p>}
          <p className="text-sm text-muted">{t('packages.deleteTypeWord', { word: PACKAGE_DELETE_WORD })}</p>
          <Input value={deleteWord} onChange={(e) => setDeleteWord(e.target.value)} placeholder={PACKAGE_DELETE_WORD} />
        </div>
      </Modal>
    </div>
  );
}
