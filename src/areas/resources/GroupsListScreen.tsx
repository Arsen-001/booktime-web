'use client';

/**
 * /biz/groups — групповые услуги и ближайшие события (F-16-028, F-16-036). Раздел «resources».
 * Индивидуальная запись такие услуги не предлагает (F-16-033) — это территория events, не эта страница.
 */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { CalendarPlus, Repeat, Settings, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { coreList } from '@/api/core';
import { deleteGroupEvents, listGroupServices, restoreGroupEvents } from '@/api/resources';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent, useSphere } from '@/demo/hooks';
import { pickText } from '@/lib/text';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';
import { StatCard } from '@/ui/StatCard';
import { EmptyStateHint } from '@/ui/onboarding/EmptyStateHint';
import { EmptyState } from '@/ui/EmptyState';
import { useToast } from '@/ui/Toast';

export function GroupsListScreen() {
  const t = useT('resources');
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const { ready, businessId } = useCurrent();
  const canManage = useCan('resources.manage');
  const hasGroups = useSphere().has('groups');
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const bulkDelete = useApiMutation((ids: string[]) => deleteGroupEvents(businessId ?? '', ids));

  const servicesQ = useApiQuery(['resources', 'group-services', businessId], () => listGroupServices(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const staffQ = useApiQuery(['resources', 'staff-for-groups', businessId], () => coreList('staff', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const eventsQ = useApiQuery(
    ['resources', 'upcoming-events', businessId],
    () => coreList('groupEvents', (e) => e.businessId === businessId && e.status === 'scheduled'),
    { enabled: ready && Boolean(businessId) },
  );

  const staffName = useMemo(() => new Map((staffQ.data ?? []).map((s) => [s.id, s.name])), [staffQ.data]);
  const upcomingAll = useMemo(() => {
    const now = new Date().toISOString().slice(0, 16);
    return (eventsQ.data ?? []).filter((e) => e.start >= now).sort((a, b) => a.start.localeCompare(b.start));
  }, [eventsQ.data]);
  const upcoming = useMemo(() => upcomingAll.slice(0, 8), [upcomingAll]);
  // Headline-числа секции (DESIGN.md → «Everything else»): сколько занятий уже настроено и сколько мест
  // на ближайших событиях всего — без похода за участниками каждого события (это карточка события, F-16-036).
  const totalSeats = useMemo(() => upcomingAll.reduce((sum, e) => sum + e.capacity, 0), [upcomingAll]);

  const services = servicesQ.data ?? [];
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: servicesPage, pager: servicesPager } = usePagedList(services);

  if (!hasGroups) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <EmptyState title={t('groups.notForSphere')} />
      </div>
    );
  }

  return (
    <div data-f="F-16-028 F-16-036" className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title={t('groups.title')}
        description={t('groups.subtitle')}
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <LinkButton href="/biz/groups/settings" variant="ghost" leftIcon={<Settings aria-hidden className="size-4" />}>
                {t('groups.settingsTitle')}
              </LinkButton>
              {/* Телефон: главное действие — на большом пальце (Fab), не вторая полоса на всю ширину под заголовком */}
              <span className="max-md:hidden">
                <LinkButton href="/biz/groups/events/new" leftIcon={<CalendarPlus aria-hidden />}>
                  {t('groups.newEvent')}
                </LinkButton>
              </span>
            </div>
          ) : undefined
        }
      />

      {!servicesQ.isLoading && !servicesQ.isError && services.length > 0 && (
        // Headline-числа секции (DESIGN.md → «Everything else»): крупное число — заголовок карточки
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={t('groups.servicesTitle')} value={services.length} icon={<Users aria-hidden />} />
          <StatCard
            label={t('groups.upcomingTitle')}
            value={upcomingAll.length}
            hint={totalSeats > 0 ? t('groups.totalSeats', { count: totalSeats }) : undefined}
            icon={<CalendarPlus aria-hidden />}
          />
        </div>
      )}

      {servicesQ.isError ? (
        <ErrorState onRetry={servicesQ.refetch} />
      ) : servicesQ.isLoading ? (
        <Skeleton lines={4} />
      ) : services.length === 0 ? (
        <div data-f="F-16-034">
          <EmptyStateHint
            icon={<Users aria-hidden />}
            title={t('groups.emptyTitle')}
            description={t('groups.emptyText')}
            steps={[t('groups.onboarding.step1'), t('groups.onboarding.step2'), t('groups.onboarding.step3'), t('groups.onboarding.step4'), t('groups.onboarding.step5'), t('groups.onboarding.step6')]}
            footnote={t('groups.emptyFootnote')}
          />
        </div>
      ) : (
        <SectionCard title={t('groups.servicesTitle')} padding="sm">
          <ul className="flex flex-col gap-1">
            {servicesPage.map((s) => (
              <li key={s.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{pickText(s.name, locale)}</span>
                <Badge tone="neutral" variant="soft">
                  {t('groups.seats', { count: s.capacity ?? 0 })}
                </Badge>
                <span className="text-sm text-muted">{format.duration(s.durationMin)}</span>
              </li>
            ))}
          </ul>
          {servicesPager}
        </SectionCard>
      )}

      <SectionCard
        title={t('groups.upcomingTitle')}
        padding="sm"
        actions={
          canManage && selected.length > 0 ? (
            <div data-f="F-16-066" className="flex items-center gap-2">
              <span className="text-xs text-muted">{t('groups.bulkDelete.count', { count: selected.length })}</span>
              <Button
                size="sm"
                variant="danger"
                loading={bulkDelete.isPending}
                leftIcon={<Trash2 aria-hidden className="size-4" />}
                onClick={async () => {
                  const ids = selected;
                  setSelected([]);
                  try {
                    await bulkDelete.mutate(ids);
                    toast.success(t('groups.bulkDelete.done', { count: ids.length }), {
                      action: { label: t('detail.undo'), onClick: () => void restoreGroupEvents(ids) },
                      durationMs: 5000,
                    });
                  } catch {
                    toast.error(t('form.saveFailed'));
                  }
                }}
              >
                {t('groups.bulkDelete.action')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {eventsQ.isLoading ? (
          <Skeleton lines={3} />
        ) : upcoming.length === 0 ? (
          <EmptyState compact title={t('groups.upcomingEmpty')} />
        ) : (
          <ul className="flex flex-col gap-1">
            {upcoming.map((e) => {
              const svc = services.find((s) => s.id === e.serviceId);
              const isSelected = selected.includes(e.id);
              return (
                <li key={e.id} className="flex min-h-11 items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-2">
                  {canManage && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(v) => setSelected((prev) => (v ? [...prev, e.id] : prev.filter((id) => id !== e.id)))}
                      aria-label={t('groups.bulkDelete.select')}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`/biz/groups/events/${e.id}`)}
                    // Телефон: две строки (название · дата/мастер) — иначе строка шире экрана (DESIGN.md: «нет ничего шире экрана»)
                    className="flex min-h-11 w-full min-w-0 flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {e.seriesId && (
                        <Badge tone="info" variant="soft" size="sm" icon={<Repeat aria-hidden className="size-3" />}>
                          {t('event.series.badge')}
                        </Badge>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{svc ? pickText(svc.name, locale) : e.serviceId}</span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-x-1.5 text-xs text-muted sm:text-sm">
                      <span>
                        {format.date(e.start, 'short')} · {format.time(e.start)}
                      </span>
                      <span>· {staffName.get(e.staffId) ?? ''}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {canManage && <Fab icon={<CalendarPlus aria-hidden />} label={t('groups.newEvent')} href="/biz/groups/events/new" />}
    </div>
  );
}
