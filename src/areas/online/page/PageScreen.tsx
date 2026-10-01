'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Megaphone, Plus, Star, Trash2 } from 'lucide-react';
import { coreUpdate } from '@/api/core';
import {
  createPromoBlock,
  deletePromoBlock,
  getBusinessListability,
  getClientFieldsConfig,
  getStarCount,
  listPromoBlocks,
  updateClientFieldsConfig,
  updatePromoBlock,
} from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { CalendarVisibility } from '@/domain/core';
import type { PromoScreen } from '@/domain/online';
import { useT } from '@/i18n/useT';
import { useOnlineAccess } from '@/areas/online/access';
import { HelpHint } from '@/areas/online/HelpHint';
import { PagePreviewCard } from '@/areas/online/page/PagePreviewCard';
import Link from 'next/link';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { PermissionGate } from '@/ui/PermissionGate';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { Switch } from '@/ui/Switch';
import { TagInput } from '@/ui/TagInput';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

/**
 * /biz/online/page — страница для клиентов. Эта пачка (b02) кладёт сюда только «кто видит календарь»
 * (F-00-065) и индикатор пустых профилей в каталоге (F-00-072); бренд/контакты/галерею достраивают
 * следующие пачки (b03/b04) — они добавляют секции ниже, не трогая эти.
 */
export function PageScreen() {
  const t = useT('online');
  const toast = useToast();
  const { businessId, staffId, ready } = useCurrent();
  const { full: hasAccess } = useOnlineAccess();

  const listabilityQ = useApiQuery(['online-listability', businessId], () => getBusinessListability(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const visibilityMutation = useApiMutation((v: CalendarVisibility) => coreUpdate('staff', staffId!, { calendarVisibility: v }));
  const clientFieldsQ = useApiQuery(['online-page-client-fields', businessId], () => getClientFieldsConfig(businessId!), {
    enabled: ready && Boolean(businessId),
  });

  // До данных — та же страница: заголовки и предпросмотр на месте, мастера — строками-скелетонами
  const loading = !ready || listabilityQ.isLoading || clientFieldsQ.isLoading;
  const skeletonCount = useSkeletonCount('online-listability', { loading, count: listabilityQ.data?.length, fallback: 4, max: 20 });
  if (listabilityQ.isError) return <ErrorState onRetry={listabilityQ.refetch} />;

  const me = listabilityQ.data?.find((x) => x.staff.id === staffId);
  const currentVisibility: CalendarVisibility = me?.staff.calendarVisibility ?? 'all';

  return (
    <PermissionGate permission={hasAccess ? undefined : 'online.manage'} fallback="message" className="mx-auto w-full max-w-[760px]">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6" aria-busy={loading || undefined}>
        <PageHeader title={t('nav.page')} description={t('page.subtitle')} meta={<HelpHint screenKey="page" />} />

        <PagePreviewCard businessId={businessId} />

        {(me || (loading && staffId)) && (
          <div data-f="F-00-065">
            <SectionCard title={t('page.visibility.title')} description={t('page.visibility.description')}>
              <SegmentedControl
                fullWidth
                size="sm"
                value={loading ? '' : currentVisibility}
                onValueChange={async (v) => {
                  if (loading) return;
                  try {
                    await visibilityMutation.mutate(v as CalendarVisibility);
                    toast.success(t('page.visibility.saved'));
                    listabilityQ.refetch();
                  } catch {
                    toast.error(t('page.visibility.saveFailed'));
                  }
                }}
                options={[
                  { value: 'all', label: t('page.visibility.all') },
                  { value: 'link', label: t('page.visibility.link') },
                  {
                    value: 'mine',
                    // На телефоне полная подпись «Только мои клиенты» не помещается в третий сегмент рядом с двумя
                    // другими — короче версия показывается < sm, полная — от sm и шире (F-00-065, minor из b02).
                    label: (
                      <>
                        <span className="sm:hidden">{t('page.visibility.mineShort')}</span>
                        <span className="hidden sm:inline">{t('page.visibility.mine')}</span>
                      </>
                    ),
                  },
                ]}
              />
            </SectionCard>
          </div>
        )}

        <div data-f="F-00-072">
          <SectionCard title={t('page.listability.title')} description={t('page.listability.description')}>
            <ul className="flex flex-col divide-y divide-border">
              {loading &&
                Array.from({ length: skeletonCount }, (_, i) => (
                  <li key={i} aria-hidden className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-sm font-medium text-fg">
                      <SkeletonText width="14ch" />
                    </span>
                    <Badge tone="neutral" size="sm">
                      <SkeletonText width="8ch" />
                    </Badge>
                  </li>
                ))}
              {(listabilityQ.data ?? []).map(({ staff, check }) => (
                <li key={staff.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm font-medium text-fg">{staff.name}</span>
                  {check.listable ? (
                    <Badge tone="success" size="sm" icon={<CheckCircle2 aria-hidden />}>
                      {t('page.listability.ok')}
                    </Badge>
                  ) : (
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      <Badge tone="warning" size="sm" icon={<Circle aria-hidden />}>
                        {t(`page.listability.missing.${check.missing[0]}` as never)}
                      </Badge>
                      {/* О27: у «чего не хватает» — сразу куда идти исправлять */}
                      <Link
                        href={check.missing[0] === 'schedule' ? '/biz/schedule' : `/biz/staff/${staff.id}`}
                        className="inline-flex min-h-11 items-center text-sm font-medium text-primary-text hover:underline"
                      >
                        {t(`page.listability.fix.${check.missing[0]}` as never)}
                      </Link>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        {clientFieldsQ.data && (
          <PartnerBrandsCard businessId={businessId!} config={clientFieldsQ.data} onSaved={clientFieldsQ.refetch} />
        )}

        {businessId && <StarsCard businessId={businessId} />}
        {businessId && <PromoBlocksCard businessId={businessId} />}
      </div>
    </PermissionGate>
  );
}

/** Звёздочка вместо отзывов (F-00-116/117, F-03-105) — только число */
function StarsCard({ businessId }: { businessId: string }) {
  const t = useT('online');
  const starsQ = useApiQuery(['online-page-stars', businessId], () => getStarCount(businessId, 'business', businessId));
  return (
    <div data-f="F-03-105">
      <SectionCard title={t('page.stars.title')} description={t('page.stars.description')}>
        <Badge tone="warning" icon={<Star aria-hidden />} size="md">
          {starsQ.data ?? 0}
        </Badge>
      </SectionCard>
    </div>
  );
}

/** Промоблок в виджете (F-03-106) */
function PromoBlocksCard({ businessId }: { businessId: string }) {
  const t = useT('online');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [screens, setScreens] = useState<PromoScreen[]>(['menu']);
  const [error, setError] = useState('');

  const listQ = useApiQuery(['online-promo', businessId], () => listPromoBlocks(businessId));
  const createMutation = useApiMutation(createPromoBlock);
  const updateMutation = useApiMutation((args: { id: string; patch: Parameters<typeof updatePromoBlock>[2] }) => updatePromoBlock(businessId, args.id, args.patch));
  const deleteMutation = useApiMutation((id: string) => deletePromoBlock(businessId, id));

  const reset = () => {
    setEditId(undefined);
    setTitle('');
    setDescription('');
    setButtonText('');
    setButtonLink('');
    setScreens(['menu']);
    setError('');
  };

  const SCREEN_OPTIONS: { value: PromoScreen; label: string }[] = [
    { value: 'menu', label: t('page.promo.screenMenu') },
    { value: 'service', label: t('page.promo.screenService') },
    { value: 'staff', label: t('page.promo.screenStaff') },
    { value: 'success', label: t('page.promo.screenSuccess') },
  ];

  return (
    <div data-f="F-03-106 F-06-165">
      <SectionCard
        title={t('page.promo.title')}
        description={t('page.promo.description')}
        actions={
          <Button size="sm" variant="secondary" onClick={() => { reset(); setOpen(true); }}>
            <Plus aria-hidden />
            {t('page.promo.add')}
          </Button>
        }
      >
        {(listQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t('page.promo.empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {(listQ.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-col gap-1 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex min-h-11 min-w-0 flex-1 items-center text-left"
                    onClick={() => {
                      setEditId(p.id);
                      setTitle(p.title);
                      setDescription(p.description ?? '');
                      setButtonText(p.buttonText ?? '');
                      setButtonLink(p.buttonLink ?? '');
                      setScreens(p.screens);
                      setOpen(true);
                    }}
                  >
                    <span className="flex items-center gap-1.5 truncate font-medium text-fg">
                      <Megaphone aria-hidden className="size-3.5 shrink-0 text-muted" />
                      {p.title}
                    </span>
                  </button>
                  <Switch
                    checked={p.enabled}
                    onCheckedChange={async (v) => {
                      await updateMutation.mutate({ id: p.id, patch: { enabled: v } });
                      listQ.refetch();
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => { await deleteMutation.mutate(p.id); listQ.refetch(); }}
                    className="flex size-11 shrink-0 items-center justify-center text-muted hover:text-danger"
                    aria-label={t('page.promo.delete')}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
                {p.status === 'pending' && (
                  <Badge tone="warning" size="sm" variant="soft" className="w-fit">
                    {t('page.promo.pending')}
                  </Badge>
                )}
                {p.status === 'rejected' && (
                  <div className="flex flex-col gap-0.5">
                    <Badge tone="danger" size="sm" variant="soft" className="w-fit">
                      {t('page.promo.rejected')}
                    </Badge>
                    {p.reasonNote && <p className="text-xs text-muted">{p.reasonNote}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('page.promo.formTitle')}
        footer={
          <Button
            fullWidth
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={async () => {
              if (!title.trim()) {
                setError(t('page.promo.titleRequired'));
                return;
              }
              try {
                if (editId) {
                  // Правка текста/картинки/ссылки — новое содержимое, снова ждёт проверки (F-00-168, F-03-106).
                  await updateMutation.mutate({
                    id: editId,
                    patch: { title: title.trim(), description: description.trim() || undefined, buttonText: buttonText.trim() || undefined, buttonLink: buttonLink.trim() || undefined, screens, status: 'pending', reasonNote: undefined },
                  });
                } else {
                  await createPromoBlockCall();
                }
                toast.success(t('settings.saved'));
                setOpen(false);
                reset();
                listQ.refetch();
              } catch {
                toast.error(t('page.brands.saveFailed'));
              }
            }}
          >
            {t('settings.save')}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <FormField label={t('page.promo.fieldTitle')} required error={error || undefined}>
            <Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 50))} maxLength={50} />
          </FormField>
          <FormField label={t('page.promo.fieldDescription')} optional>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 220))} maxLength={220} rows={2} />
          </FormField>
          <FormField label={t('page.promo.fieldButtonText')} optional>
            <Input value={buttonText} onChange={(e) => setButtonText(e.target.value.slice(0, 20))} maxLength={20} />
          </FormField>
          <FormField label={t('page.promo.fieldButtonLink')} optional>
            <Input value={buttonLink} onChange={(e) => setButtonLink(e.target.value)} placeholder="https://" />
          </FormField>
          <FormField label={t('page.promo.fieldScreens')}>
            <div className="flex flex-col gap-2">
              {SCREEN_OPTIONS.map((opt) => (
                <Checkbox
                  key={opt.value}
                  checked={screens.includes(opt.value)}
                  onCheckedChange={(v) => setScreens(v ? [...screens, opt.value] : screens.filter((s) => s !== opt.value))}
                  label={opt.label}
                />
              ))}
            </div>
          </FormField>
        </div>
      </Sheet>
    </div>
  );

  async function createPromoBlockCall() {
    await createMutation.mutate({
      businessId,
      title: title.trim(),
      description: description.trim() || undefined,
      buttonText: buttonText.trim() || undefined,
      buttonLink: buttonLink.trim() || undefined,
      screens,
    });
  }
}

/** Бренды партнёров на странице записи (F-03-104) */
function PartnerBrandsCard({
  businessId,
  config,
  onSaved,
}: {
  businessId: string;
  config: Awaited<ReturnType<typeof getClientFieldsConfig>>;
  onSaved: () => void;
}) {
  const t = useT('online');
  const toast = useToast();
  const [brands, setBrands] = useState(config.partnerBrands);
  const mutation = useApiMutation((patch: Parameters<typeof updateClientFieldsConfig>[1]) => updateClientFieldsConfig(businessId, patch));

  const save = async () => {
    try {
      await mutation.mutate({ partnerBrands: brands });
      toast.success(t('page.brands.saved'));
      onSaved();
    } catch {
      toast.error(t('page.brands.saveFailed'));
    }
  };

  return (
    <div data-f="F-03-104">
      <SectionCard title={t('page.brands.title')} description={t('page.brands.description')}>
        <div className="flex flex-col gap-3">
          <TagInput value={brands} onValueChange={setBrands} placeholder={t('page.brands.placeholder')} />
          <div>
            <Button size="sm" onClick={save} loading={mutation.isPending}>
              {t('settings.save')}
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
