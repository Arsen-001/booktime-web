'use client';

/**
 * Вкладка «Типы уведомлений» (F-05-002 список групп/фильтра/строк, F-05-003 тумблер и значения по умолчанию).
 *
 * Редизайн (стадия 2, docs/design/DESIGN.md): раньше это была одна длинная стена из ~20 строк-переключателей
 * подряд — «читается» как настройки 2010-х. Теперь группы — это раскрывающиеся секции ОДНОЙ карточки
 * (Accordion, вариант ChannelsTab/«Needs attention»): заголовок группы сразу показывает счётчик «включено/всего»,
 * открыта по умолчанию только первая — остальные сворачиваются в одну строку, а не тянут экран вниз.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { listTypes, updateType } from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import { typeOptimistic } from '@/areas/notify/lib/typeOptimistic';
import { isServerSoonType } from '@/areas/notify/lib/serverSoon';
import { NotifySettingsCard } from '@/areas/notify/types/NotifySettingsCard';
import { channelLabel, groupLabel, recipientLabel, TYPE_REGISTRY } from '@/areas/notify/lib/registry';
import type { NotificationType, NotifyClientGroup, NotifyRecipient } from '@/domain/notify';
import { useCurrent } from '@/demo/hooks';
import type { Locale } from '@/i18n/config';
import { useT } from '@/i18n/useT';
import { Accordion } from '@/ui/Accordion';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Reveal } from '@/ui/Reveal';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

/** F-05-043: ключи правил в справке ниже (см. typesTab.skipRules в словарях notify) */
const SKIP_RULE_KEYS = [
  'rule1', 'rule2', 'rule3', 'rule4', 'rule5', 'rule6', 'rule7', 'rule8',
  'rule9', 'rule10', 'rule11', 'rule12', 'rule13', 'rule14', 'rule15',
] as const;

type FilterValue = 'all' | NotifyRecipient;

const CLIENT_GROUP_ORDER: NotifyClientGroup[] = ['attendance', 'quality', 'retention', 'other'];
const RECIPIENT_ORDER: NotifyRecipient[] = ['admin', 'staff', 'adminStaff'];

function TypeRow({ type, onToggle }: { type: NotificationType; onToggle: (v: boolean) => void }) {
  const router = useRouter();
  const t = useT('notify');
  const locale = useLocale() as Locale;
  // F-05-048: у типа 19 (расписание сотрудников кончается) в списке нет меток каналов — служебное
  // SMS без выбора канала/сценария, показывать бейдж нечего.
  const connectedChannels = type.code === 19 ? [] : type.channels.filter((c) => c.scenario !== 'off');
  const name = type.name[locale] || type.name.ru;
  const soon = isServerSoonType(type.code);

  return (
    <li data-f="F-05-002 F-05-003 F-10-145" className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      {type.code === 19 && <span data-f="F-02-040" className="hidden" aria-hidden />}
      <Switch
        checked={type.enabled && !soon}
        disabled={type.code === 7 || soon}
        onCheckedChange={onToggle}
        aria-label={type.enabled ? t('typesTab.toggleAriaOff', { name }) : t('typesTab.toggleAriaOn', { name })}
      />
      <button
        type="button"
        onClick={() => router.push(`/biz/notifications/types/${type.code}`)}
        className="-my-1 flex min-h-11 min-w-0 flex-1 flex-col gap-1.5 rounded-lg py-1 text-left transition-colors hover:text-primary-text sm:flex-row sm:items-center sm:gap-3"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className={`min-w-0 truncate font-medium ${type.enabled && !soon ? 'text-fg' : 'text-muted'}`}>{name}</span>
          {/* Сервер этот тип пока не отправляет (режим api) — честная метка вместо молчаливого «включено» */}
          {soon && (
            <Badge tone="warning" size="sm" className="shrink-0">
              {t('typesTab.soon')}
            </Badge>
          )}
        </span>
        <span className="flex flex-wrap gap-1.5 sm:justify-end">
          {type.code === 19 ? null : connectedChannels.length === 0 ? (
            <Badge tone="neutral" size="sm">
              {t('typesTab.noChannels')}
            </Badge>
          ) : (
            connectedChannels.map((c) => (
              <Badge key={c.channel} tone={type.enabled && !soon ? 'primary' : 'neutral'} size="sm">
                {channelLabel(c.channel, locale)}
              </Badge>
            ))
          )}
        </span>
      </button>
    </li>
  );
}

/**
 * Скелетон строки типа — та же разметка, что TypeRow: место тумблера (дорожка 48×28 в зоне 44 px), название, метка
 * канала (у типа 19 меток нет — и в скелетоне нет). Строка той же высоты и на телефоне, и на компьютере.
 */
function TypeRowSkeleton({ code }: { code: number }) {
  return (
    <li aria-hidden className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <span className="inline-flex">
        <span className="inline-flex h-11 w-14 shrink-0 items-center justify-center">
          <Skeleton className="h-7 w-12 rounded-full" />
        </span>
      </span>
      <span className="-my-1 flex min-h-11 min-w-0 flex-1 flex-col gap-1.5 py-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="min-w-0 flex-1 truncate font-medium text-fg">
          <SkeletonText width={code % 2 ? '24ch' : '18ch'} />
        </span>
        {code !== 19 && (
          <span className="flex flex-wrap gap-1.5 sm:justify-end">
            <Badge tone="neutral" size="sm">
              <SkeletonText width="4ch" />
            </Badge>
          </span>
        )}
      </span>
    </li>
  );
}

/** Группы списка: клиентские — по группам, остальные — по получателю; пустые не показываются */
function groupItems<T extends { recipient: NotifyRecipient; group?: NotifyClientGroup }>(list: T[], filter: FilterValue, locale: Locale) {
  const clientGroups = CLIENT_GROUP_ORDER.map((group) => ({
    key: `client-${group}`,
    title: groupLabel(group, locale),
    items: list.filter((tItem) => tItem.recipient === 'client' && tItem.group === group),
  }));
  const others = RECIPIENT_ORDER.map((recipient) => ({
    key: `recipient-${recipient}`,
    title: recipientLabel(recipient, locale),
    items: list.filter((tItem) => tItem.recipient === recipient),
  }));
  return [
    ...(filter === 'all' || filter === 'client' ? clientGroups : []),
    ...others.filter((g) => filter === 'all' || filter === g.key.replace('recipient-', '')),
  ].filter((g) => g.items.length > 0);
}

export function TypesTab() {
  const t = useT('notify');
  const toast = useToast();
  const locale = useLocale() as Locale;
  const { ready, businessId } = useCurrent();
  const [filter, setFilter] = useState<FilterValue>('all');

  const q = useApiQuery(['notify', 'types', businessId], () => listTypes(businessId!), { enabled: ready && !!businessId });
  // Ув4: тумблер срабатывает сразу — список и страница типа правятся в кэше до ответа, при ошибке откат и тост.
  const toggle = useApiMutation(updateType, { optimistic: typeOptimistic });

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (filter === 'all') return list;
    return list.filter((type) => type.recipient === filter);
  }, [q.data, filter]);

  const handleToggle = async (code: number, enabled: boolean) => {
    if (!businessId) return;
    try {
      await toggle.mutate({ businessId, code, patch: { enabled } });
    } catch {
      toast.error(t('typesTab.saveFailed'));
    }
  };

  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  const loading = !ready || q.isLoading;
  const visibleGroups = groupItems(filtered, filter, locale);

  const totalEnabled = filtered.filter((tItem) => tItem.enabled).length;

  const accordionItems = visibleGroups.map((g, i) => {
    const enabledCount = g.items.filter((tItem) => tItem.enabled).length;
    return {
      id: g.key,
      // Один открыт по умолчанию — остальные группы сразу видны заголовком со счётчиком, но не занимают экран.
      defaultOpen: i === 0,
      title: (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
          <span className="truncate">{g.title}</span>
          <Badge tone={enabledCount > 0 ? 'primary' : 'neutral'} size="sm" className="shrink-0 tabular-nums">
            {t('typesTab.groupCount', { enabled: enabledCount, total: g.items.length })}
          </Badge>
        </span>
      ) as ReactNode,
      content: (
        <ul className="flex flex-col">
          {g.items.map((type) => (
            <TypeRow key={type.code} type={type} onToggle={(v) => handleToggle(type.code, v)} />
          ))}
        </ul>
      ),
    };
  });

  // Скелетон — тот же аккордеон: группы и число строк берутся из справочника типов (он общий для всех бизнесов),
  // первая группа открыта, у заголовков — место счётчика «включено/всего»
  const skeletonItems = groupItems(TYPE_REGISTRY, filter, locale).map((g, i) => ({
    id: g.key,
    defaultOpen: i === 0,
    title: (
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
        <span className="truncate">{g.title}</span>
        <Badge tone="neutral" size="sm" className="shrink-0 tabular-nums">
          <SkeletonText width="5ch" />
        </Badge>
      </span>
    ) as ReactNode,
    content: (
      <ul className="flex flex-col">
        {g.items.map((def) => (
          <TypeRowSkeleton key={def.code} code={def.code} />
        ))}
      </ul>
    ),
  }));

  return (
    <div data-f="F-05-004" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={filter}
          onValueChange={(v) => setFilter(v as FilterValue)}
          options={[
            { value: 'all', label: t('typesTab.filterAll') },
            { value: 'client', label: recipientLabel('client', locale) },
            { value: 'admin', label: recipientLabel('admin', locale) },
            { value: 'staff', label: recipientLabel('staff', locale) },
            { value: 'adminStaff', label: recipientLabel('adminStaff', locale) },
          ]}
        />
        {(loading || filtered.length > 0) && (
          <p className="text-sm text-muted">
            {loading ? <SkeletonText width="18ch" /> : t('typesTab.enabledSummary', { enabled: totalEnabled, total: filtered.length })}
          </p>
        )}
      </div>

      <NotifySettingsCard />

      <Reveal loading={loading} skeleton={<Accordion multiple variant="card" items={skeletonItems} />}>
        {!filtered.length ? (
          <EmptyState
            kind={filter === 'all' ? 'default' : 'search'}
            title={filter === 'all' ? t('typesTab.emptyTitle') : undefined}
            description={filter === 'all' ? t('typesTab.emptyText') : undefined}
            onReset={filter === 'all' ? undefined : () => setFilter('all')}
          />
        ) : (
          <Accordion multiple variant="card" items={accordionItems} />
        )}
      </Reveal>

      <div data-f="F-05-043">
        <SectionCard title={t('typesTab.skipRules.title')} description={t('typesTab.skipRules.hint')} padding="none">
          <Accordion
            variant="plain"
            items={[
              {
                id: 'skip-rules',
                title: t('typesTab.skipRules.toggle'),
                content: (
                  <ul className="flex flex-col gap-2 py-1 text-sm text-muted">
                    {SKIP_RULE_KEYS.map((key) => (
                      <li key={key} className="list-disc pl-4">
                        {t(`typesTab.skipRules.${key}`)}
                      </li>
                    ))}
                  </ul>
                ),
              },
            ]}
          />
        </SectionCard>
      </div>
    </div>
  );
}
