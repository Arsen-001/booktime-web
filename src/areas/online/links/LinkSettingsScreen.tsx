'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowRight, Pencil, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { coreGet, coreList } from '@/api/core';
import {
  computePackageDurationRange,
  computePackagePriceRange,
  contrastRatioToWhite,
  createOnlinePackage,
  deleteLink,
  deleteOnlinePackage,
  getGroupBookingRules,
  getLink,
  isHexColor,
  listOnlinePackages,
  listWidgetEvents,
  MIN_CONTRAST,
  updateGroupBookingRules,
  updateLink,
  updateOnlinePackage,
} from '@/api/online';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import type { LocaleCode, LocalizedText, Service } from '@/domain/core';
import type { BookingFlow, BookingLink, CategoryDisplay, GroupBookingRules, LinkBookingType, OnlinePackage, StaffDisplayField, StepKey, WidgetTheme } from '@/domain/online';
import { SHORT_STEPWISE_ORDER, STEP_KEYS, counterIdError } from '@/domain/online';
import { CLIENT_LOCALES } from '@/i18n/config';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { useLocale } from 'next-intl';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { PermissionGate } from '@/ui/PermissionGate';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { useConfirm, useToast } from '@/ui/Toast';
import { useOnlineAccess } from '@/areas/online/access';
import { HelpHint } from '@/areas/online/HelpHint';
import { useScrollToHash } from '@/areas/online/lib/useScrollToHash';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { DragReorderList } from '@/areas/online/links/DragReorderList';
import { isOrderService } from '@/domain/ordersPickup';

const PACKAGE_TEXT_LOCALES: LocaleCode[] = ['ru', 'en', 'hy'];
const EMPTY_PACKAGE_TEXT: LocalizedText = { ru: '', en: '', hy: '' };

/**
 * /biz/online/links/[linkId] — «Настроить» ссылку, всё на одной странице (F-03-014).
 * F-03-014/F-03-016 (починка g1-1-fix2): раньше «Основное», «Формат и шаги» и «Дизайн» держали своё
 * состояние и свою кнопку «Сохранить» внутри дочерних секций — 4 разные кнопки на одном экране, и правка
 * порядка шагов не попадала в состояние `dirty` нижней sticky-кнопки, поэтому «Сохранить» оставалась
 * disabled, а после reload порядок откатывался. Теперь ВСЁ редактируемое состояние ссылки живёт здесь,
 * секции — чисто представление (value/onChange), а единственная кнопка «Сохранить» внизу отправляет один
 * общий patch и включена, если dirty — изменилось хоть одно поле любой секции.
 */
export function LinkSettingsScreen({ linkId }: { linkId: string }) {
  const t = useT('online');
  const toast = useToast();
  const router = useRouter();
  const { full: hasAccess } = useOnlineAccess();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const linkQ = useApiQuery(['online-link', linkId], () => getLink(linkId));

  // ── основное ──
  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [description, setDescription] = useState('');
  const [bookingType, setBookingType] = useState<LinkBookingType>('mixed');
  const [defaultLocale, setDefaultLocale] = useState<LocaleCode>('ru');
  // ── формат и шаги (F-03-015…021) ──
  const [flow, setFlow] = useState<BookingFlow>('menu');
  const [order, setOrder] = useState<StepKey[]>(STEP_KEYS);
  const [hidden, setHidden] = useState<Partial<Record<StepKey, boolean>>>({});
  const [labels, setLabels] = useState<Partial<Record<StepKey, string>>>({});
  const [preselectedStaffId, setPreselectedStaffId] = useState('');
  const [preselectedServiceId, setPreselectedServiceId] = useState('');
  const [staffDisplayField, setStaffDisplayField] = useState<StaffDisplayField>('specialty');
  const [categoryDisplay, setCategoryDisplay] = useState<CategoryDisplay>('tags');
  const [staffForAllBookings, setStaffForAllBookings] = useState('');
  // ── дизайн (F-03-022…025) ──
  const [theme, setTheme] = useState<WidgetTheme>('light');
  const [color, setColor] = useState('#3b32c9'); // tokens-ok: цвет — данные (код для сайта салона / цвет кнопки по умолчанию)
  const [hidePrice, setHidePrice] = useState(false);
  const [hideDuration, setHideDuration] = useState(false);
  const [submitLabel, setSubmitLabel] = useState('');
  const [heroImages, setHeroImages] = useState<string[]>([]);

  const [dirty, setDirty] = useState(false);
  // F-03-014: уход со страницы (навигация, закрытие вкладки) молча теряет несохранённые правки —
  // предупреждаем, как в остальных экранах раздела (SettingsScreen).
  useUnsavedGuard(dirty);
  // Подхватываем поля из загруженной ссылки: правим состояние прямо при рендере (не в эффекте),
  // когда пришли свежие данные другой ссылки — так форма не «мигает» лишним рендером.
  const [loadedLinkId, setLoadedLinkId] = useState<string | null>(null);
  if (linkQ.data && linkQ.data.id !== loadedLinkId) {
    const l = linkQ.data;
    setName(l.name);
    setDescription(l.description ?? '');
    setBookingType(l.bookingType);
    setDefaultLocale(l.defaultLocale);
    setFlow(l.bookingFlow);
    setOrder(l.stepOrder.length ? l.stepOrder : STEP_KEYS);
    setHidden(l.stepHidden ?? {});
    setLabels(l.stepLabels ?? {});
    setPreselectedStaffId(l.preselectedStaffId ?? '');
    setPreselectedServiceId(l.preselectedServiceId ?? '');
    setStaffDisplayField(l.staffDisplayField);
    setCategoryDisplay(l.categoryDisplay);
    setStaffForAllBookings(l.staffForAllBookings ?? '');
    setTheme(l.theme);
    setColor(l.widgetButtonColor);
    setHidePrice(Boolean(l.hidePrice));
    setHideDuration(Boolean(l.hideDuration));
    setSubmitLabel(l.submitButtonLabel ?? '');
    setHeroImages(l.heroImageUrl ? [l.heroImageUrl] : []);
    setDirty(false);
    setLoadedLinkId(l.id);
  }

  // ⭐ React Compiler может выполнить эту функцию вне запроса — `linkQ.data!.businessId` внутри неё
  // падает при linkQ.data===undefined, даже с enabled:false (qa/measure/online/state-s1.md, п.2).
  const linkBusinessId = linkQ.data?.businessId;
  const locationsQ = useApiQuery(
    ['online-link-location', linkBusinessId],
    () => coreList('locations', { businessId: linkBusinessId ?? '' }),
    { enabled: Boolean(linkBusinessId) },
  );
  const staffQ = useApiQuery(
    ['online-link-staff', linkBusinessId],
    () => coreList('staff', (s) => s.businessId === linkBusinessId && s.status === 'active'),
    { enabled: Boolean(linkBusinessId) },
  );
  const servicesQ = useApiQuery(
    ['online-link-services', linkBusinessId],
    () => coreList('services', (s) => s.businessId === linkBusinessId && s.active && !isOrderService(s)),
    { enabled: Boolean(linkBusinessId) },
  );

  const saveMutation = useApiMutation((args: { id: string; patch: Parameters<typeof updateLink>[1] }) => updateLink(args.id, args.patch));
  const deleteMutation = useApiMutation(deleteLink);
  useScrollToHash(Boolean(linkQ.data));

  if (linkQ.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton variant="rect" className="h-9 w-64" />
        <Skeleton variant="rect" className="h-48 rounded-xl" />
      </div>
    );
  }
  if (linkQ.isError || !linkQ.data) return <ErrorState onRetry={linkQ.refetch} />;

  const link = linkQ.data;
  const location = locationsQ.data?.find((l) => l.id === link.locationId);
  const staff = staffQ.data ?? [];
  const services = servicesQ.data ?? [];

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  // F-03-017: пара «предвыбранный мастер + предвыбранная услуга» обязана быть совместима.
  const mismatch = Boolean(
    preselectedStaffId &&
      preselectedStaffId !== 'any' &&
      preselectedServiceId &&
      !staff.find((s) => s.id === preselectedStaffId)?.serviceIds.includes(preselectedServiceId),
  );
  const contrastOk = !isHexColor(color) || contrastRatioToWhite(color) >= MIN_CONTRAST;
  const colorValid = isHexColor(color) && contrastOk;
  const canSave = dirty && !mismatch && colorValid;

  const move = (key: StepKey, dir: -1 | 1) => {
    const i = order.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    markDirty(setOrder)(next);
  };

  const locked = flow === 'shortStepwise';

  const save = async () => {
    if (!canSave) return;
    try {
      await saveMutation.mutate({
        id: link.id,
        patch: {
          name: name.trim() || link.name,
          description: description.trim() || undefined,
          bookingType,
          defaultLocale,
          bookingFlow: flow,
          stepOrder: locked ? SHORT_STEPWISE_ORDER : order,
          stepHidden: hidden,
          stepLabels: labels,
          preselectedStaffId: (preselectedStaffId || undefined) as BookingLink['preselectedStaffId'],
          preselectedServiceId: preselectedServiceId || undefined,
          staffDisplayField,
          categoryDisplay,
          staffForAllBookings: staffForAllBookings || undefined,
          theme,
          widgetButtonColor: color,
          hidePrice,
          hideDuration,
          submitButtonLabel: submitLabel.trim() || undefined,
          ...(heroImages[0] && heroImages[0] !== link.heroImageUrl ? { heroImageUrl: heroImages[0], heroImageStatus: 'pending' as const } : {}),
        },
      });
      toast.success(t('linkSettings.saved'));
      setDirty(false);
    } catch {
      toast.error(t('linkSettings.saveFailed'));
    }
  };

  return (
    <PermissionGate permission={hasAccess ? undefined : 'online.manage'} fallback="message" className="mx-auto max-w-[760px]">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6" data-f="F-03-014 F-03-138">
        <PageHeader
          back={{ href: '/biz/online', label: t('linkSettings.back') }}
          title={
            editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => markDirty(setName)(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  autoFocus
                  className="max-w-xs"
                />
              </div>
            ) : (
              <button type="button" className="inline-flex items-center gap-2 hover:underline" onClick={() => setEditingName(true)}>
                {name}
                <Pencil aria-hidden className="size-4 text-muted" />
              </button>
            )
          }
          meta={
            <>
              {link.primary && (
                <Badge tone="primary" icon={<Star aria-hidden />}>
                  {t('links.card.primary')}
                </Badge>
              )}
              {location && <Badge tone="neutral">{t('links.card.forLocation', { name: location.name.ru })}</Badge>}
              <HelpHint screenKey="linkSettings" />
            </>
          }
          actions={
            <IconButton
              icon={<Trash2 aria-hidden />}
              label={link.primary ? t('links.card.deleteDisabled') : t('linkSettings.delete')}
              disabled={link.primary}
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              className={link.primary ? undefined : 'text-danger'}
            />
          }
        />

        <SectionCard title={t('linkSettings.mainTitle')} description={t('linkSettings.mainDescription')}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">{t('links.form.description')}</span>
              <Input value={description} onChange={(e) => markDirty(setDescription)(e.target.value)} maxLength={200} />
            </div>
            <div data-f="F-16-084" className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">{t('links.form.bookingType')}</span>
              <Select
                value={bookingType}
                onValueChange={(v) => markDirty(setBookingType)(v as LinkBookingType)}
                options={[
                  { value: 'individual', label: t('links.form.bookingTypeIndividual') },
                  { value: 'group', label: t('links.form.bookingTypeGroup') },
                  { value: 'mixed', label: t('links.form.bookingTypeMixed') },
                ]}
              />
            </div>
            <div data-f="F-15-139" className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">{t('links.form.defaultLocale')}</span>
              <Select
                value={defaultLocale}
                onValueChange={(v) => markDirty(setDefaultLocale)(v as LocaleCode)}
                options={CLIENT_LOCALES.map((l) => ({ value: l, label: t(`links.form.localeName.${l}` as 'links.form.localeName.hy') }))}
              />
              <span className="text-xs text-muted">{t('links.form.defaultLocaleHint')}</span>
            </div>
          </div>
        </SectionCard>

        <StepsSection
          staff={staff}
          services={services}
          flow={flow}
          onFlowChange={markDirty(setFlow)}
          order={order}
          onOrderChange={markDirty(setOrder)}
          onMove={move}
          locked={locked}
          hidden={hidden}
          onHiddenChange={markDirty(setHidden)}
          labels={labels}
          onLabelsChange={markDirty(setLabels)}
          preselectedStaffId={preselectedStaffId}
          onPreselectedStaffChange={markDirty(setPreselectedStaffId)}
          preselectedServiceId={preselectedServiceId}
          onPreselectedServiceChange={markDirty(setPreselectedServiceId)}
          staffDisplayField={staffDisplayField}
          onStaffDisplayFieldChange={markDirty(setStaffDisplayField)}
          categoryDisplay={categoryDisplay}
          onCategoryDisplayChange={markDirty(setCategoryDisplay)}
          staffForAllBookings={staffForAllBookings}
          staffForAllBookingsName={staff.find((s) => s.id === staffForAllBookings)?.name}
          onStaffForAllBookingsChange={markDirty(setStaffForAllBookings)}
          mismatch={mismatch}
        />
        <section id="design" className="scroll-mt-24">
        <DesignSection
          theme={theme}
          onThemeChange={markDirty(setTheme)}
          color={color}
          onColorChange={markDirty(setColor)}
          colorError={!contrastOk ? t('linkSettings.design.contrastLow') : !isHexColor(color) ? t('linkSettings.design.colorInvalid') : undefined}
          hidePrice={hidePrice}
          onHidePriceChange={markDirty(setHidePrice)}
          hideDuration={hideDuration}
          onHideDurationChange={markDirty(setHideDuration)}
          submitLabel={submitLabel}
          onSubmitLabelChange={markDirty(setSubmitLabel)}
          heroImages={heroImages}
          onHeroImagesChange={markDirty(setHeroImages)}
          heroImageStatus={link.heroImageStatus}
          heroImageUrl={link.heroImageUrl}
        />
        </section>
        {(link.bookingType === 'group' || link.bookingType === 'mixed') && (
          <GroupBookingSection linkId={link.id} />
        )}
        {(link.bookingType === 'individual' || link.bookingType === 'mixed') && (
          <PackagesSection businessId={link.businessId} />
        )}
        <SalesSection link={link} />
        <AnalyticsSection
          link={link}
          onSave={async (patch) => {
            try {
              await saveMutation.mutate({ id: link.id, patch });
              toast.success(t('linkSettings.saved'));
            } catch {
              toast.error(t('linkSettings.saveFailed'));
            }
          }}
        />

        {/* О26: панель «Сохранить» появляется только когда есть несохранённые правки — и не закрывает поля: на
            телефоне StickyActionBar сам оставляет под собой место, на десктопе прилипает к низу формы её ширины. */}
        {dirty && (
          <StickyActionBar desktop="sticky" summary={t('linkSettings.unsaved')}>
            <Button variant="ghost" onClick={() => setLoadedLinkId(null)}>
              {t('linkSettings.discard')}
            </Button>
            <Button onClick={save} disabled={!canSave} loading={saveMutation.isPending}>
              {t('linkSettings.save')}
            </Button>
          </StickyActionBar>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title={t('links.delete.title')}
        description={t('links.delete.description')}
        confirmLabel={t('links.delete.confirm')}
        onConfirm={async () => {
          try {
            await deleteMutation.mutate(link.id);
            toast.success(t('links.delete.done'));
            router.push('/biz/online');
          } catch {
            toast.error(t('links.delete.failed'));
          }
        }}
      />
    </PermissionGate>
  );
}

const STEP_TITLE_KEY = {
  staff: 'linkSettings.steps.staff',
  service: 'linkSettings.steps.service',
  time: 'linkSettings.steps.time',
} as const;

/**
 * Формат и шаги записи (F-03-015…021, F-03-069, F-03-070) — чистое представление: всё состояние и
 * единственная кнопка «Сохранить» живут в LinkSettingsScreen (F-03-014).
 */
function StepsSection({
  staff,
  services,
  flow,
  onFlowChange,
  order,
  onOrderChange,
  onMove,
  locked,
  hidden,
  onHiddenChange,
  labels,
  onLabelsChange,
  preselectedStaffId,
  onPreselectedStaffChange,
  preselectedServiceId,
  onPreselectedServiceChange,
  staffDisplayField,
  onStaffDisplayFieldChange,
  categoryDisplay,
  onCategoryDisplayChange,
  staffForAllBookings,
  staffForAllBookingsName,
  onStaffForAllBookingsChange,
  mismatch,
}: {
  staff: { id: string; name: string; serviceIds: string[] }[];
  services: { id: string; name: import('@/domain/core').LocalizedText }[];
  flow: BookingFlow;
  onFlowChange: (v: BookingFlow) => void;
  order: StepKey[];
  onOrderChange: (v: StepKey[]) => void;
  onMove: (key: StepKey, dir: -1 | 1) => void;
  locked: boolean;
  hidden: Partial<Record<StepKey, boolean>>;
  onHiddenChange: (v: Partial<Record<StepKey, boolean>>) => void;
  labels: Partial<Record<StepKey, string>>;
  onLabelsChange: (v: Partial<Record<StepKey, string>>) => void;
  preselectedStaffId: string;
  onPreselectedStaffChange: (v: string) => void;
  preselectedServiceId: string;
  onPreselectedServiceChange: (v: string) => void;
  staffDisplayField: StaffDisplayField;
  onStaffDisplayFieldChange: (v: StaffDisplayField) => void;
  categoryDisplay: CategoryDisplay;
  onCategoryDisplayChange: (v: CategoryDisplay) => void;
  staffForAllBookings: string;
  staffForAllBookingsName: string | undefined;
  onStaffForAllBookingsChange: (v: string) => void;
  mismatch: boolean;
}) {
  const t = useT('online');
  const locale = useLocale();

  return (
    <SectionCard title={t('linkSettings.sections.steps')} description={t('linkSettings.sections.stepsHint')}>
      <div className="flex flex-col gap-5">
        <div data-f="F-03-015">
        <FormField label={t('linkSettings.steps.flow')}>
          <ChoiceGroup
            columns={1}
            value={flow}
            onValueChange={(v) => onFlowChange(v as BookingFlow)}
            options={[
              { value: 'stepwise', title: t('linkSettings.steps.flowStepwise'), description: t('linkSettings.steps.flowStepwiseHint') },
              { value: 'shortStepwise', title: t('linkSettings.steps.flowShort'), description: t('linkSettings.steps.flowShortHint') },
              { value: 'menu', title: t('linkSettings.steps.flowMenu'), description: t('linkSettings.steps.flowMenuHint') },
            ]}
          />
        </FormField>
        </div>

        <div className="flex flex-col gap-2" data-f="F-03-016">
          <p className="text-sm font-medium text-fg">{t('linkSettings.steps.order')}</p>
          <p className="text-sm text-muted">{locked ? t('linkSettings.steps.orderLockedHint') : t('linkSettings.steps.orderHint')}</p>
          <DragReorderList
            order={locked ? SHORT_STEPWISE_ORDER : order}
            disabled={locked}
            items={(locked ? SHORT_STEPWISE_ORDER : order).map((key) => ({ key, content: t(STEP_TITLE_KEY[key]) }))}
            onReorder={(next) => onOrderChange(next as StepKey[])}
            renderExtra={(key, i) =>
              !locked && (
                <div className="flex gap-1">
                  <IconButton icon={<ArrowUp aria-hidden />} label={t('linkSettings.steps.moveUp')} size="sm" variant="ghost" disabled={i === 0} onClick={() => onMove(key as StepKey, -1)} />
                  <IconButton icon={<ArrowDown aria-hidden />} label={t('linkSettings.steps.moveDown')} size="sm" variant="ghost" disabled={i === order.length - 1} onClick={() => onMove(key as StepKey, 1)} />
                </div>
              )
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-f="F-03-016">
          {STEP_KEYS.map((key) =>
            key === 'time' ? (
              <div key={key} data-f="F-03-019">
                <FormField label={t('linkSettings.steps.labelTime')} optional>
                  <Input value={labels.time ?? ''} onChange={(e) => onLabelsChange({ ...labels, time: e.target.value || undefined })} />
                </FormField>
              </div>
            ) : (
              <FormField key={key} label={t(key === 'staff' ? 'linkSettings.steps.labelStaff' : 'linkSettings.steps.labelService')} optional>
                <Input value={labels[key] ?? ''} onChange={(e) => onLabelsChange({ ...labels, [key]: e.target.value || undefined })} />
              </FormField>
            ),
          )}
        </div>

        <div className="border-t border-border pt-4" data-f="F-03-017 F-03-069 F-03-070">
          <p className="mb-2 text-sm font-medium text-fg">{t('linkSettings.steps.staffStepTitle')}</p>
          <div className="flex flex-col gap-3">
            <FormField label={t('linkSettings.steps.preselectedStaff')}>
              <Select
                value={preselectedStaffId}
                onValueChange={onPreselectedStaffChange}
                options={[
                  { value: '', label: t('linkSettings.steps.preselectedNone') },
                  { value: 'any', label: t('linkSettings.steps.preselectedAny') },
                  ...staff.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </FormField>
            {mismatch && <p className="text-sm text-danger">{t('linkSettings.steps.mismatchError')}</p>}
            <Switch
              checked={Boolean(hidden.staff)}
              onCheckedChange={(v) => onHiddenChange({ ...hidden, staff: v })}
              disabled={!preselectedStaffId || preselectedStaffId === 'any'}
              label={t('linkSettings.steps.hideStaffStep')}
            />
            <FormField label={t('linkSettings.steps.staffDisplay')}>
              <Select
                value={staffDisplayField}
                onValueChange={(v) => onStaffDisplayFieldChange(v as StaffDisplayField)}
                options={[
                  { value: 'specialty', label: t('linkSettings.steps.staffDisplaySpecialty') },
                  { value: 'position', label: t('linkSettings.steps.staffDisplayPosition') },
                ]}
              />
            </FormField>
            {/* О25: «Любой специалист» и «Сотрудник для всех записей» — общие для бизнеса, живут в «Правилах записи» */}
            <div className="flex flex-col gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-muted">
              <p>{t('linkSettings.steps.staffRulesMoved')}</p>
              {staffForAllBookings && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-fg">{t('linkSettings.steps.ownStaffForAll', { name: staffForAllBookingsName ?? '—' })}</span>
                  <Button size="sm" variant="ghost" onClick={() => onStaffForAllBookingsChange('')}>
                    {t('linkSettings.steps.ownStaffForAllReset')}
                  </Button>
                </div>
              )}
              <Link href="/biz/online/settings#staff-choice" className="inline-flex min-h-11 w-fit items-center gap-1 font-medium text-primary-text hover:underline">
                {t('linkSettings.steps.staffRulesLink')}
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4" data-f="F-03-018 F-03-020">
          <p className="mb-2 text-sm font-medium text-fg">{t('linkSettings.steps.serviceStepTitle')}</p>
          <div className="flex flex-col gap-3">
            <FormField label={t('linkSettings.steps.preselectedService')}>
              <Select
                value={preselectedServiceId}
                onValueChange={onPreselectedServiceChange}
                options={[{ value: '', label: t('linkSettings.steps.preselectedNone') }, ...services.map((s) => ({ value: s.id, label: pickText(s.name, locale) }))]}
              />
            </FormField>
            <FormField label={t('linkSettings.steps.categoryDisplay')}>
              <ChoiceGroup
                columns={2}
                value={categoryDisplay}
                onValueChange={(v) => onCategoryDisplayChange(v as CategoryDisplay)}
                options={[
                  { value: 'tags', title: t('linkSettings.steps.categoryTags') },
                  { value: 'list', title: t('linkSettings.steps.categoryList') },
                ]}
              />
            </FormField>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/**
 * Дизайн: тема, цвет, изображение, скрытие цены/длительности (F-03-022…025) — чистое представление,
 * без своей кнопки «Сохранить» (F-03-014): всё сохраняет общая кнопка внизу экрана.
 */
function DesignSection({
  theme,
  onThemeChange,
  color,
  onColorChange,
  colorError,
  hidePrice,
  onHidePriceChange,
  hideDuration,
  onHideDurationChange,
  submitLabel,
  onSubmitLabelChange,
  heroImages,
  onHeroImagesChange,
  heroImageStatus,
  heroImageUrl,
}: {
  theme: WidgetTheme;
  onThemeChange: (v: WidgetTheme) => void;
  color: string;
  onColorChange: (v: string) => void;
  colorError?: string;
  hidePrice: boolean;
  onHidePriceChange: (v: boolean) => void;
  hideDuration: boolean;
  onHideDurationChange: (v: boolean) => void;
  submitLabel: string;
  onSubmitLabelChange: (v: string) => void;
  heroImages: string[];
  onHeroImagesChange: (v: string[]) => void;
  heroImageStatus?: 'pending' | 'approved';
  heroImageUrl?: string;
}) {
  const t = useT('online');

  return (
    <SectionCard title={t('linkSettings.sections.design')} description={t('linkSettings.sections.designHint')}>
      <div className="flex flex-col gap-5">
        <div data-f="F-03-023">
        <FormField label={t('linkSettings.design.theme')}>
          <ChoiceGroup
            columns={2}
            value={theme}
            onValueChange={(v) => onThemeChange(v as WidgetTheme)}
            options={[
              { value: 'light', title: t('linkSettings.design.themeLight') },
              { value: 'dark', title: t('linkSettings.design.themeDark') },
            ]}
          />
        </FormField>
        </div>

        <div className="flex flex-col gap-2" data-f="F-03-024">
          <FormField label={t('linkSettings.design.color')} hint={t('linkSettings.design.colorHint')} error={colorError}>
            <div className="flex items-center gap-2">
              <span className="size-9 shrink-0 rounded-lg border border-border" style={isHexColor(color) ? { backgroundColor: color } : undefined} aria-hidden />
              <Input value={color} onChange={(e) => onColorChange(e.target.value)} className="max-w-40 font-mono" />
              <Button variant="ghost" size="sm" onClick={() => onColorChange('#3b32c9')}> {/* tokens-ok: цвет кнопки по умолчанию — данные */}
                {t('linkSettings.design.colorReset')}
              </Button>
            </div>
          </FormField>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4" data-f="F-03-022">
          <Switch checked={hidePrice} onCheckedChange={onHidePriceChange} label={t('linkSettings.design.hidePrice')} />
          <Switch checked={hideDuration} onCheckedChange={onHideDurationChange} label={t('linkSettings.design.hideDuration')} />
          <FormField label={t('linkSettings.design.submitLabel')} optional hint={t('linkSettings.design.submitLabelHint')}>
            <Input value={submitLabel} onChange={(e) => onSubmitLabelChange(e.target.value)} maxLength={30} />
          </FormField>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4" data-f="F-03-025">
          <p className="text-sm font-medium text-fg">{t('linkSettings.design.hero')}</p>
          <p className="text-sm text-muted">{t('linkSettings.design.heroHint')}</p>
          <ImageUpload
            value={heroImages}
            onValueChange={onHeroImagesChange}
            aspect="16/9"
            maxSizeMb={12}
            label={t('linkSettings.design.heroUpload')}
          />
          {heroImageUrl && heroImageStatus === 'pending' && (
            <Badge tone="warning" size="sm" variant="soft" className="w-fit">
              {t('linkSettings.design.heroPending')}
            </Badge>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

/** Кнопка онлайн-продаж абонементов и сертификатов (F-03-107) — сеть у нас одна на бизнес, поэтому выбор — Вкл/Выкл */
function SalesSection({ link }: { link: BookingLink }) {
  const t = useT('online');
  const toast = useToast();
  const businessQ = useApiQuery(['online-link-business', link.businessId], () => coreGet('businesses', link.businessId));
  const saveMutation = useApiMutation((v: string | undefined) => updateLink(link.id, { onlineSalesNetworkId: v }));
  const networkId = businessQ.data?.networkId;
  const enabled = Boolean(link.onlineSalesNetworkId);

  return (
    <div data-f="F-03-107 F-06-150">
      <SectionCard title={t('linkSettings.sections.sales')} description={t('linkSettings.sections.salesHint')}>
        {!networkId ? (
          <p className="text-sm text-muted">{t('linkSettings.sales.noNetwork')}</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg">{t('linkSettings.sales.toggle')}</span>
            <Switch
              checked={enabled}
              disabled={saveMutation.isPending}
              onCheckedChange={async (v) => {
                try {
                  await saveMutation.mutate(v ? networkId : undefined);
                  toast.success(t('settings.saved'));
                } catch {
                  toast.error(t('settings.saveFailed'));
                }
              }}
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/** Аналитика: Meta Pixel, GA4, Client ID, журнал событий (F-03-117…122) */
function AnalyticsSection({ link, onSave }: { link: BookingLink; onSave: (patch: Parameters<typeof updateLink>[1]) => Promise<void> }) {
  const t = useT('online');
  const [metaPixelId, setMetaPixelId] = useState(link.metaPixelId ?? '');
  const [ga4StreamId, setGa4StreamId] = useState(link.ga4StreamId ?? '');
  // Неверный формат не сохраняем: ID уходит в адрес скрипта на странице салона (сервер проверяет так же)
  const [idErrors, setIdErrors] = useState<{ metaPixel?: boolean; ga4?: boolean }>({});
  // Пусто — '' (а не undefined): так сервер понимает «убрать счётчик»
  const saveCounter = (kind: 'metaPixel' | 'ga4', value: string) => {
    const bad = counterIdError(kind, value);
    setIdErrors((p) => ({ ...p, [kind]: bad }));
    if (bad) return;
    const clean = kind === 'ga4' ? value.trim().toUpperCase() : value.trim();
    const current = (kind === 'ga4' ? link.ga4StreamId : link.metaPixelId) ?? '';
    if (clean === current) return;
    if (kind === 'ga4') setGa4StreamId(clean);
    void onSave(kind === 'ga4' ? { ga4StreamId: clean } : { metaPixelId: clean });
  };
  const [passClientId, setPassClientId] = useState(Boolean(link.passClientId));
  const [gaParamIndex, setGaParamIndex] = useState(link.gaClientIdParamIndex ?? '');
  const eventsQ = useApiQuery(['online-widget-events', link.id], () => listWidgetEvents(link.id));

  return (
    <div data-f="F-03-117 F-13-078">
      <SectionCard title={t('linkSettings.sections.analytics')} description={t('linkSettings.sections.analyticsHint')}>
        <div className="flex flex-col gap-4">
          <div data-f="F-03-118 F-13-082">
            <FormField
              label={t('linkSettings.analytics.metaPixel')}
              hint={t('linkSettings.analytics.metaPixelHint')}
              error={idErrors.metaPixel ? t('linkSettings.analytics.metaPixelInvalid') : undefined}
            >
              <Input
                value={metaPixelId}
                onChange={(e) => setMetaPixelId(e.target.value)}
                onBlur={() => saveCounter('metaPixel', metaPixelId)}
                inputMode="numeric"
                invalid={Boolean(idErrors.metaPixel)}
                placeholder="123456789012345"
              />
            </FormField>
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-4" data-f="F-03-119">
            <FormField
              label={t('linkSettings.analytics.ga4')}
              hint={t('linkSettings.analytics.ga4Hint')}
              error={idErrors.ga4 ? t('linkSettings.analytics.ga4Invalid') : undefined}
            >
              <Input
                value={ga4StreamId}
                onChange={(e) => setGa4StreamId(e.target.value)}
                onBlur={() => saveCounter('ga4', ga4StreamId)}
                autoCapitalize="characters"
                invalid={Boolean(idErrors.ga4)}
                placeholder="G-XXXXXXXXXX"
              />
            </FormField>
            <div data-f="F-03-120 F-13-081" className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg">{t('linkSettings.analytics.passClientId')}</span>
              <Switch checked={passClientId} onCheckedChange={async (v) => { setPassClientId(v); await onSave({ passClientId: v }); }} />
            </div>
            {passClientId && (
              <FormField label={t('linkSettings.analytics.paramIndex')} optional>
                <Input value={gaParamIndex} onChange={(e) => setGaParamIndex(e.target.value)} onBlur={() => onSave({ gaClientIdParamIndex: gaParamIndex.trim() || undefined })} />
              </FormField>
            )}
            <p className="text-sm text-muted" data-f="F-03-122 F-13-084">{t('linkSettings.analytics.goalsHint')}</p>
            <p className="text-sm text-muted">{t('linkSettings.analytics.consentNote')}</p>
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-4" data-f="F-03-121 F-13-083">
            <p className="text-sm font-medium text-fg">{t('linkSettings.analytics.eventsLog')}</p>
            {(eventsQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">{t('linkSettings.analytics.eventsEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm text-muted">
                {(eventsQ.data ?? []).slice(0, 10).map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span className="font-mono text-xs">{e.type}</span>
                    <span>{e.at.slice(11, 16)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

/** Групповая запись: несколько мест в одной записи и «Записаться ещё» (F-03-076, F-03-102) */
function GroupBookingSection({ linkId }: { linkId: string }) {
  const t = useT('online');
  const toast = useToast();
  const rulesQ = useApiQuery(['online-group-rules', linkId], () => getGroupBookingRules(linkId));
  // F-03-102/076: тумблер и зависимое поле читают ОДИН и тот же `rules` — оптимистичная правка (готовый
  // хелпер `optimistic`, как в других разделах) обновляет кэш запроса сразу по клику, а не через
  // 400–1200мс моковой задержки, поэтому оба места остаются согласованы кадр в кадр даже при двух
  // быстрых кликах подряд. `disabled` во время сохранения не даёт второму клику стартовать до того, как
  // первый долетел (была гонка — снимок ловил Switch «выключен» при уже включённом зависимом поле).
  const saveMutation = useApiMutation((patch: Parameters<typeof updateGroupBookingRules>[1]) => updateGroupBookingRules(linkId, patch), {
    optimistic: optimistic<GroupBookingRules, Parameters<typeof updateGroupBookingRules>[1]>(['online-group-rules', linkId], (old, patch) => ({
      ...old,
      ...patch,
    })),
  });
  const rules = rulesQ.data;
  if (!rules) return null;

  const save = async (patch: Parameters<typeof updateGroupBookingRules>[1]) => {
    try {
      await saveMutation.mutate(patch);
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <div data-f="F-03-076">
      <SectionCard title={t('linkSettings.sections.group')} description={t('linkSettings.sections.groupHint')}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg">{t('linkSettings.group.extraSeats')}</span>
            <Switch checked={rules.allowExtraSeats} disabled={saveMutation.isPending} onCheckedChange={(v) => save({ allowExtraSeats: v })} />
          </div>
          {rules.allowExtraSeats && (
            <FormField label={t('linkSettings.group.maxSeats')}>
              <Input
                type="number"
                min={1}
                max={20}
                value={rules.maxSeatsPerBooking}
                onChange={(e) => save({ maxSeatsPerBooking: Math.max(1, Number(e.target.value) || 1) })}
              />
            </FormField>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4" data-f="F-03-102 F-16-088">
            <span className="text-sm font-medium text-fg">{t('linkSettings.group.multiEvent')}</span>
            <Switch checked={rules.allowMultiEvent} disabled={saveMutation.isPending} onCheckedChange={(v) => save({ allowMultiEvent: v })} />
          </div>
          {rules.allowMultiEvent && (
            <FormField label={t('linkSettings.group.maxEvents')}>
              <Input
                type="number"
                min={1}
                max={10}
                value={rules.maxEventsPerBooking}
                onChange={(e) => save({ maxEventsPerBooking: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
              />
            </FormField>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

/**
 * Пакеты услуг / комплексы для онлайн-записи (F-03-130). ⭐ Сущность и данные — временно в срезе online
 * (домен ещё не построил раздел «Услуги»/resources, см. комментарий у OnlinePackage в domain/online.ts
 * и qa/requests/online.md); тумблер, название/описание/картинка и переводы работают на моках.
 * ИСПРАВЛЕНО: раньше создать/удалить пакет из кабинета было нельзя («заведёт раздел «Услуги»») — по тому же
 * образцу, что и лист ожидания (WaitlistRequest), CRUD теперь тут; переезд сущности в «Услуги» не меняет API.
 */
function PackagesSection({ businessId }: { businessId: string }) {
  const t = useT('online');
  const toast = useToast();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const packagesQ = useApiQuery(['online-packages', businessId], () => listOnlinePackages(businessId));
  const servicesQ = useApiQuery(['online-packages-services', businessId], () => coreList('services', (s) => s.businessId === businessId && !isOrderService(s)));
  const deleteMutation = useApiMutation((id: string) => deleteOnlinePackage(id));

  if (packagesQ.isLoading || servicesQ.isLoading) return <Skeleton variant="rect" className="h-32 rounded-xl" />;
  if (packagesQ.isError || !packagesQ.data) return null;

  const removePackage = async (p: OnlinePackage) => {
    const ok = await confirm({ title: t('linkSettings.packages.deleteConfirm.title'), confirmLabel: t('linkSettings.packages.deleteConfirm.confirm'), tone: 'danger' });
    if (!ok) return;
    try {
      await deleteMutation.mutate(p.id);
      toast.success(t('linkSettings.packages.deleted'));
      packagesQ.refetch();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <div data-f="F-03-130">
      <SectionCard
        title={t('linkSettings.sections.packages')}
        description={t('linkSettings.sections.packagesHint')}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
            {t('linkSettings.packages.new')}
          </Button>
        }
      >
        {packagesQ.data.length === 0 ? (
          <p className="text-sm text-muted">{t('linkSettings.packages.empty')}</p>
        ) : (
          <div className="flex flex-col gap-4 divide-y divide-border">
            {packagesQ.data.map((p, i) => (
              <div key={p.id} className={i > 0 ? 'pt-4' : undefined}>
                <PackageCard
                  pkg={p}
                  services={(servicesQ.data ?? []).filter((s) => p.serviceIds.includes(s.id))}
                  onSaved={packagesQ.refetch}
                  onDelete={() => removePackage(p)}
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Sheet open={createOpen} onOpenChange={setCreateOpen} title={t('linkSettings.packages.new')}>
        <NewPackageForm
          businessId={businessId}
          services={servicesQ.data ?? []}
          onCreated={() => {
            setCreateOpen(false);
            packagesQ.refetch();
          }}
        />
      </Sheet>
    </div>
  );
}

function NewPackageForm({ businessId, services, onCreated }: { businessId: string; services: Service[]; onCreated: () => void }) {
  const t = useT('online');
  const locale = useLocale();
  const toast = useToast();
  const [name, setName] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [mode, setMode] = useState<OnlinePackage['mode']>('simultaneous');
  const [error, setError] = useState('');
  const mutation = useApiMutation(() => createOnlinePackage({ businessId, name: name.trim(), serviceIds, mode }));

  const toggle = (id: string) => setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (!name.trim()) return setError(t('linkSettings.packages.errors.name'));
    if (serviceIds.length < 2 || serviceIds.length > 10) return setError(t('linkSettings.packages.errors.services'));
    setError('');
    try {
      await mutation.mutate(undefined);
      toast.success(t('linkSettings.packages.created'));
      onCreated();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FormField label={t('linkSettings.packages.nameLabel')}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </FormField>
      <FormField label={t('linkSettings.packages.servicesLabel')} hint={t('linkSettings.packages.servicesHint')}>
        <div className="flex flex-col gap-1.5 rounded-xl border border-border p-2">
          {services.length === 0 ? (
            <p className="p-2 text-sm text-muted">{t('linkSettings.packages.noServices')}</p>
          ) : (
            services.map((s) => (
              <Checkbox key={s.id} checked={serviceIds.includes(s.id)} onCheckedChange={() => toggle(s.id)} label={pickText(s.name, locale)} />
            ))
          )}
        </div>
      </FormField>
      <FormField label={t('linkSettings.packages.modeLabel')}>
        <Select
          value={mode}
          onValueChange={(v) => setMode(v as OnlinePackage['mode'])}
          options={[
            { value: 'simultaneous', label: t('linkSettings.packages.mode.simultaneous') },
            { value: 'sequentialSame', label: t('linkSettings.packages.mode.sequentialSame') },
            { value: 'sequentialMulti', label: t('linkSettings.packages.mode.sequentialMulti') },
          ]}
        />
      </FormField>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button fullWidth loading={mutation.isPending} onClick={submit}>
        {t('linkSettings.packages.create')}
      </Button>
    </div>
  );
}

function PackageCard({ pkg, services, onSaved, onDelete }: { pkg: OnlinePackage; services: Service[]; onSaved: () => void; onDelete: () => void }) {
  const t = useT('online');
  const locale = useLocale();
  const toast = useToast();
  const format = useFormat();
  // F-03-115: онлайн-название/описание пакета — свой перевод на каждый язык, не одна строка на все сразу
  const [textLocale, setTextLocale] = useState<LocaleCode>('ru');
  const [onlineName, setOnlineName] = useState<LocalizedText>(pkg.onlineName ?? EMPTY_PACKAGE_TEXT);
  const [description, setDescription] = useState<LocalizedText>(pkg.description ?? EMPTY_PACKAGE_TEXT);
  const [imageUrls, setImageUrls] = useState<string[]>(pkg.imageUrl ? [pkg.imageUrl] : []);
  const mutation = useApiMutation((patch: Parameters<typeof updateOnlinePackage>[1]) => updateOnlinePackage(pkg.id, patch));

  const save = async (patch: Parameters<typeof updateOnlinePackage>[1]) => {
    try {
      await mutation.mutate(patch);
      toast.success(t('settings.saved'));
      onSaved();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  const price = computePackagePriceRange(services);
  const duration = computePackageDurationRange(services, pkg.mode);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-fg">{pickText(pkg.name, locale)}</p>
          <p className="text-sm text-muted">
            {services.map((s) => pickText(s.name, locale)).join(' + ')} · {t(`linkSettings.packages.mode.${pkg.mode}`)}
          </p>
          <p className="text-sm text-muted">
            {format.moneyRange(price.min, price.max)} · {format.durationRange(duration.min, duration.max)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={pkg.online} onCheckedChange={(v) => save({ online: v })} aria-label={t('serviceCard.onlineToggle')} />
          <IconButton icon={<Trash2 aria-hidden className="size-4" />} label={t('linkSettings.packages.delete')} onClick={onDelete} />
        </div>
      </div>

      <Tabs variant="pill" value={textLocale} onValueChange={(v) => setTextLocale(v as LocaleCode)} items={PACKAGE_TEXT_LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))} />
      <FormField label={t('serviceCard.onlineName')} hint={t('serviceCard.onlineNameHint')}>
        <Input
          value={onlineName[textLocale] ?? ''}
          onChange={(e) => setOnlineName((prev) => ({ ...prev, [textLocale]: e.target.value }))}
          onBlur={() => save({ onlineName })}
          maxLength={60}
        />
      </FormField>
      <FormField label={t('serviceCard.description')} optional>
        <Input
          value={description[textLocale] ?? ''}
          onChange={(e) => setDescription((prev) => ({ ...prev, [textLocale]: e.target.value.slice(0, 450) }))}
          onBlur={() => save({ description })}
          maxLength={450}
        />
      </FormField>
      <FormField label={t('serviceCard.image')} optional>
        <ImageUpload
          value={imageUrls}
          onValueChange={(urls) => {
            setImageUrls(urls);
            save({ imageUrl: urls[0] });
          }}
          aspect="16/9"
          maxSizeMb={12}
          label={t('serviceCard.imageUpload')}
        />
      </FormField>
      {pkg.mode === 'sequentialMulti' && (
        <p className="text-xs text-muted" data-f="F-03-130">
          {t('linkSettings.packages.multiStaffHint')}
        </p>
      )}
      <p className="text-xs text-muted">{t('linkSettings.packages.oneAtATime')}</p>
    </div>
  );
}
