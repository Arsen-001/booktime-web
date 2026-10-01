'use client';

/**
 * /biz/services/templates — «Добавить из шаблона» (F-00-083, F-00-173, У25): готовые услуги сферы по категориям с
 * «Выбрать все»; то, что уже есть в каталоге (тот же набор слов в названии), помечено «уже есть» и не отмечается;
 * категория предлагается из существующих; до добавления правятся цена, длительность и мастера.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { addFromTemplates, listCategories, listServiceRows, listStaffForPicker, listTemplates } from '@/api/services';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent, useSphere } from '@/demo/hooks';
import { isSameServiceName, matchCategory, type ServiceTemplateItem, type TemplatePick } from '@/domain/services';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { formatMoney } from '@/lib/money';
import { pickText } from '@/lib/text';
import { StaffCell } from '@/areas/services/catalog/StaffCell';
import { CommitInput } from '@/areas/services/components/CommitInput';
import { DurationInput } from '@/areas/services/components/DurationInput';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Collapse } from '@/ui/Collapse';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

export function TemplatesScreen() {
  const t = useT('services');
  const router = useRouter();
  const toast = useToast();
  const format = useFormat();
  const locale = useLocale() as 'ru' | 'en';
  const { ready, businessId } = useCurrent();
  const sphere = useSphere();
  const enabled = ready && Boolean(businessId);
  const [picks, setPicks] = useState<Record<string, TemplatePick>>({});

  const q = useApiQuery(['services', 'templates', sphere.id], () => listTemplates(sphere.id), { enabled: ready });
  const rowsQ = useApiQuery(['services', 'rows', businessId], () => listServiceRows(businessId ?? ''), { enabled });
  const categoriesQ = useApiQuery(['services', 'categories', businessId], () => listCategories(businessId ?? ''), { enabled });
  const staffQ = useApiQuery(['services', 'staffPicker', businessId], () => listStaffForPicker(businessId ?? ''), { enabled });
  const addM = useApiMutation((list: TemplatePick[]) => addFromTemplates(businessId ?? '', sphere.id, list));

  const items = q.data ?? [];
  const existing = rowsQ.data ?? [];
  const categories = categoriesQ.data ?? [];
  const staffList = staffQ.data ?? [];
  const exists = (tpl: ServiceTemplateItem) => existing.some((r) => isSameServiceName(r.service.name, tpl.name));
  const groups = [...new Set(items.map((i) => i.categoryName.ru))].map((ru) => ({
    title: items.find((i) => i.categoryName.ru === ru)!.categoryName,
    items: items.filter((i) => i.categoryName.ru === ru),
  }));

  const makePick = (tpl: ServiceTemplateItem): TemplatePick => ({
    templateId: tpl.id,
    priceMin: tpl.priceMin,
    durationMin: tpl.durationMin,
    categoryId: matchCategory(tpl.categoryName, categories)?.id,
    // Один мастер — сразу он (иначе услуга без мастера и «Опубликовать» онлайн-запись недоступна)
    staffIds: staffList.length === 1 ? [staffList[0].id] : [],
  });
  const toggle = (tpl: ServiceTemplateItem, on: boolean) =>
    setPicks((prev) => {
      const next = { ...prev };
      if (on) next[tpl.id] = prev[tpl.id] ?? makePick(tpl);
      else delete next[tpl.id];
      return next;
    });
  const update = (id: string, patch: Partial<TemplatePick>) => setPicks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const count = Object.keys(picks).length;
  const { confirmLeave } = useUnsavedGuard(count > 0 && !addM.isPending);

  const apply = async () => {
    try {
      const created = await addM.mutate(Object.values(picks));
      toast.success(t('templates.added', { count: created.length }));
      router.push('/biz/services');
    } catch {
      toast.error(t('templates.addFailed'));
    }
  };

  const loading = q.isLoading || rowsQ.isLoading || categoriesQ.isLoading;

  return (
    <div data-f="F-00-083 F-00-173" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('templates.title')} description={t('templates.subtitle')} back={{ href: '/biz/services', label: t('title') }} />
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : loading ? (
        <Skeleton lines={6} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Sparkles aria-hidden />} title={t('templates.empty')} />
      ) : (
        groups.map((g) => {
          const free = g.items.filter((i) => !exists(i));
          const pickedFree = free.filter((i) => picks[i.id]).length;
          return (
            <SectionCard
              key={g.title.ru}
              title={pickText(g.title, locale)}
              actions={
                free.length > 0 ? (
                  <Checkbox
                    checked={pickedFree === free.length}
                    indeterminate={pickedFree > 0 && pickedFree < free.length}
                    onCheckedChange={(on) => free.forEach((i) => toggle(i, on))}
                    label={t('templates.selectAll')}
                  />
                ) : undefined
              }
            >
              <ul className="flex flex-col divide-y divide-border">
                {g.items.map((tpl) => {
                  const pick = picks[tpl.id];
                  const dup = exists(tpl);
                  const tplName = pickText(tpl.name, locale);
                  return (
                    <li key={tpl.id} className="flex flex-col gap-3 py-3">
                      <div className="flex min-h-10 items-center gap-3">
                        <Checkbox checked={Boolean(pick)} onCheckedChange={(on) => toggle(tpl, on)} aria-label={tplName} />
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-fg">{tplName}</span>
                          {dup && (
                            <Badge tone="warning" size="sm">
                              {t('templates.exists')}
                            </Badge>
                          )}
                        </span>
                        {!pick && (
                          <span className="shrink-0 text-sm text-muted tabular-nums">
                            {formatMoney(tpl.priceMin)} · {format.duration(tpl.durationMin)}
                          </span>
                        )}
                      </div>
                      <Collapse open={Boolean(pick)}>
                        {pick && (
                          <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface-2/60 p-3 sm:grid-cols-2">
                            <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-fg">
                              {t('form.priceLabel')}
                              <CommitInput
                                kind="money"
                                size="sm"
                                value={pick.priceMin}
                                onCommit={(v) => update(tpl.id, { priceMin: v ?? 0 })}
                                aria-label={`${tplName}: ${t('form.priceLabel')}`}
                              />
                            </label>
                            <div className="flex min-w-0 flex-col gap-1 text-sm font-medium text-fg">
                              {t('form.durationLabel')}
                              <DurationInput
                                value={pick.durationMin}
                                onValueChange={(v) =>
                                  update(tpl.id, {
                                    durationMin: v || tpl.durationMin,
                                  })
                                }
                                aria-label={tplName}
                              />
                            </div>
                            <div className="flex min-w-0 flex-col gap-1 text-sm font-medium text-fg">
                              {t('form.categoryLabel')}
                              <Select
                                aria-label={`${tplName}: ${t('form.categoryLabel')}`}
                                options={[
                                  {
                                    value: '',
                                    label: t('templates.newCategory', {
                                      name: pickText(tpl.categoryName, locale),
                                    }),
                                  },
                                  ...categories.map((c) => ({
                                    value: c.id,
                                    label: pickText(c.name, locale),
                                  })),
                                ]}
                                value={pick.categoryId ?? ''}
                                onValueChange={(v) => update(tpl.id, { categoryId: v || undefined })}
                                size="sm"
                              />
                            </div>
                            <div className="flex min-w-0 flex-col gap-1 text-sm font-medium text-fg">
                              {t('staffTab.title')}
                              <div className="rounded-md border border-border-strong/40 bg-surface">
                                <StaffCell
                                  staffIds={pick.staffIds}
                                  staffList={staffList}
                                  canEdit
                                  onCommit={(staffIds) => update(tpl.id, { staffIds })}
                                  label={`${tplName}: ${t('staffTab.title')}`}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </Collapse>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          );
        })
      )}
      {items.length > 0 && (
        <StickyActionBar desktop="sticky" summary={t('templates.selectedCount', { count })}>
          <Button variant="secondary" onClick={() => void confirmLeave().then((ok) => ok && router.push('/biz/services'))}>
            {t('form.cancel')}
          </Button>
          <Button disabled={count === 0} loading={addM.isPending} onClick={() => void apply()}>
            {t('templates.addSelected')}
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}
