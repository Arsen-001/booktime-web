'use client';

/**
 * /biz/resources — справочник ресурсов (F-16-001, F-16-002, F-16-008, F-16-009). Раздел «resources».
 * Ресурс — кресло/кабинет/аппарат, которого в салоне ограниченное число: без него нельзя записать больше
 * клиентов, чем есть мест. Действующие и архив — вкладками; список ведёт к созданию (F-16-003) и карточке (F-16-004, F-16-005).
 */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Armchair, Archive, Ban, ChevronRight, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { coreList } from '@/api/core';
import { getJournalPrefs, setSplitByResourceEnabled } from '@/api/journal';
import { listResources, type ResourceWithMeta } from '@/api/resources';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { JournalPrefs } from '@/domain/journal';
import { pickText } from '@/lib/text';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';
import { EmptyStateHint } from '@/ui/onboarding/EmptyStateHint';
import { RESOURCE_KIND_ICON } from '@/areas/resources/lib/kinds';

type ListTab = 'active' | 'archived';

export function ResourcesListScreen() {
  const t = useT('resources');
  const locale = useLocale();
  const router = useRouter();
  const { ready, businessId } = useCurrent();
  const canManage = useCan('resources.manage');
  const [tab, setTab] = useState<ListTab>('active');

  const listQ = useApiQuery(['resources', 'list', businessId], () => listResources(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const locationsQ = useApiQuery(['resources', 'locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const all = listQ.data ?? [];
  const active = all.filter((r) => r.active);
  const archived = all.filter((r) => !r.active);
  const isEmpty = !listQ.isLoading && !listQ.isError && all.length === 0;
  const locationName = new Map((locationsQ.data ?? []).map((l) => [l.id, pickText(l.name, locale)] as const));
  const multiLocation = (locationsQ.data?.length ?? 0) > 1;

  const openRow = (r: ResourceWithMeta) => {
    if (!r.id.startsWith('pending-')) router.push(`/biz/resources/${r.id}`);
  };

  const columns = useMemo<TableColumn<ResourceWithMeta>[]>(() => {
    const cols: TableColumn<ResourceWithMeta>[] = [
      {
        id: 'name',
        header: t('list.columns.name'),
        mobile: 'title',
        sortable: true,
        sortValue: (r) => pickText(r.name, locale),
        // Скелетон ячейки — значок вида и имя полосой, в той же строке
        skeleton: (
          <span className="flex min-w-0 items-center gap-2 font-semibold text-fg">
            <Armchair aria-hidden className="size-4 shrink-0 text-muted" />
            <SkeletonText width="14ch" />
          </span>
        ),
        cell: (r) => {
          const Icon = RESOURCE_KIND_ICON[r.kind];
          return (
            <span className="flex min-w-0 items-center gap-2 font-semibold text-fg">
              <Icon aria-hidden className="size-4 shrink-0 text-muted" />
              <span className="truncate">{pickText(r.name, locale)}</span>
              {r.active && r.serviceIds.length === 0 && (
                <Badge tone="warning" variant="soft" size="sm" icon={<Ban aria-hidden className="size-3" />}>
                  {t('list.notLinked')}
                </Badge>
              )}
            </span>
          );
        },
      },
      {
        id: 'kind',
        header: t('list.columns.kind'),
        mobile: 'meta',
        width: '9rem',
        skeletonWidth: '7ch',
        cell: (r) => <span className="text-muted">{t(`kind.${r.kind}` as 'kind.chair')}</span>,
      },
      {
        id: 'description',
        header: t('list.columns.description'),
        mobile: 'subtitle',
        // Одна строка (длинное — многоточием): высота строки и карточки не зависит от длины описания
        cell: (r) => (r.description ? <span className="block truncate text-muted">{r.description}</span> : <span className="text-muted max-md:hidden">—</span>),
      },
    ];
    if (multiLocation) {
      cols.push({ id: 'location', header: t('list.columns.location'), mobile: 'meta', width: '10rem', skeletonWidth: '10ch', cell: (r) => <span className="text-muted">{locationName.get(r.locationId) ?? '—'}</span> });
    }
    cols.push(
      {
        id: 'services',
        header: t('list.columns.services'),
        mobile: 'hidden',
        align: 'right',
        width: '7rem',
        skeletonWidth: '2ch',
        sortable: true,
        sortValue: (r) => r.serviceIds.length,
        cell: (r) => <span className="tabular-nums">{r.serviceIds.length}</span>,
      },
      {
        id: 'count',
        header: t('list.columns.count'),
        mobile: 'aside',
        align: 'right',
        width: '7rem',
        skeletonWidth: '2ch',
        sortable: true,
        sortValue: (r) => r.instances.length,
        cell: (r) => <span className="tabular-nums">{r.instances.length}</span>,
      },
      {
        id: 'chevron',
        header: '',
        mobile: 'hidden',
        align: 'right',
        cell: () => <ChevronRight aria-hidden className="size-4 text-muted" />,
        skeleton: <ChevronRight aria-hidden className="size-4 text-muted" />,
        width: '2rem',
      },
    );
    return cols;
  }, [locale, t, multiLocation, locationName]);

  return (
    <div data-f="F-16-001 F-16-002 F-16-008 F-16-009" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('list.title')}
        description={t('list.subtitle')}
        actions={
          // Пустое состояние ниже уже несёт свою primary-кнопку («один главный путь на экране», CONVENTIONS §0.1)
          canManage && !isEmpty ? (
            // Телефон: главное действие — на большом пальце (Fab), не полоса на всю ширину под заголовком
            <span className="max-md:hidden">
              <LinkButton href="/biz/resources/new" leftIcon={<Plus aria-hidden />}>
                {t('list.add')}
              </LinkButton>
            </span>
          ) : undefined
        }
      />

      {listQ.isError ? (
        <ErrorState onRetry={listQ.refetch} />
      ) : isEmpty ? (
        // F-16-009 + onboarding-k1: за 3 секунды понятно, зачем это и с чего начать
        <EmptyStateHint
          icon={<Armchair aria-hidden />}
          title={t('list.emptyTitle')}
          description={t('list.emptyText')}
          steps={[t('list.onboarding.step1'), t('list.onboarding.step2'), t('list.onboarding.step3')]}
          action={
            canManage ? (
              <LinkButton href="/biz/resources/new" leftIcon={<Plus aria-hidden />}>
                {t('list.add')}
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <>
          <Tabs
            items={[
              // Счётчики на месте уже при загрузке — вкладки не раздвигаются, когда приходят числа
              { value: 'active', label: t('list.tabs.active'), badge: listQ.isLoading ? <SkeletonText width="2ch" /> : active.length },
              { value: 'archived', label: t('list.tabs.archived'), badge: listQ.isLoading ? <SkeletonText width="2ch" /> : archived.length },
            ]}
            value={tab}
            onValueChange={(v) => setTab(v as ListTab)}
            // Вкладки живут после первого показа: «Архив» → «Действующие» не строит таблицу и карточку правил заново
            keepMounted
            classNames={{ panel: 'flex flex-col gap-6 pt-6' }}
            panels={{
              active: (
                <>
                  <Table
                    columns={columns}
                    rows={active}
                    rowKey={(r) => r.id}
                    loading={listQ.isLoading}
                    loadingRows={1}
                    label={t('list.title')}
                    onRowClick={openRow}
                  />
                  <SplitByResourceCard canManage={canManage} />
                </>
              ),
              archived:
                !listQ.isLoading && archived.length === 0 ? (
                  <EmptyState icon={<Archive aria-hidden className="size-8" />} title={t('list.emptyArchivedTitle')} description={t('list.emptyArchivedText')} />
                ) : (
                  <>
                    <p className="text-sm text-muted">{t('list.archivedHint')}</p>
                    <Table
                      columns={columns}
                      rows={archived}
                      rowKey={(r) => r.id}
                      loading={listQ.isLoading}
                      loadingRows={1}
                      label={t('list.title')}
                      onRowClick={openRow}
                    />
                  </>
                ),
            }}
          />
        </>
      )}

      {canManage && !isEmpty && <Fab icon={<Plus aria-hidden />} label={t('list.add')} href="/biz/resources/new" />}
    </div>
  );
}

/**
 * F-16-016 = F-01-132: одна настройка «Разделять запись по ресурсам» на весь кабинет — та же, что в настройках
 * журнала (раньше у раздела была своя копия с обратным умолчанием). Отдельный компонент со своим запросом:
 * переключение не перерисовывает таблицу; переключатель сразу встаёт в новое положение (оптимистично).
 */
function SplitByResourceCard({ canManage }: { canManage: boolean }) {
  const t = useT('resources');
  const toast = useToast();
  const q = useApiQuery(['journal', 'prefs-split'], getJournalPrefs);
  const mutation = useApiMutation((v: boolean) => setSplitByResourceEnabled(v), {
    optimistic: optimistic<JournalPrefs, boolean>(['journal', 'prefs-split'], (old, v) => ({ ...old, splitByResourceEnabled: v })),
  });
  const onChange = async (v: boolean) => {
    try {
      await mutation.mutate(v);
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };
  return (
    <div data-f="F-16-016">
      <SectionCard title={t('list.splitByResource.title')} description={t('list.splitByResource.description')}>
        {q.isLoading || !q.data ? (
          // Тот же переключатель с подписью (неактивный), пока настройка читается — карточка той же высоты
          <Switch checked={false} disabled label={t('list.splitByResource.label')} />
        ) : (
          <Switch checked={q.data.splitByResourceEnabled} onCheckedChange={onChange} disabled={!canManage} label={t('list.splitByResource.label')} />
        )}
      </SectionCard>
    </div>
  );
}
