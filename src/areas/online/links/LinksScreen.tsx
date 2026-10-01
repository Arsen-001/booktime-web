'use client';

import { useState, type ReactNode } from 'react';
import { Building2, CalendarClock, Contact, Images, Link2, Palette, Plus, Smartphone, Users } from 'lucide-react';
import Link from 'next/link';
import { coreList } from '@/api/core';
import { deleteLink, listLinks, setPrimaryLink } from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useOnlineAccess } from '@/areas/online/access';
import { NewLinkSheet } from '@/areas/online/links/NewLinkSheet';
import { LinkCard, LinkCardSkeleton } from '@/areas/online/links/LinkCard';
import { PublishCard } from '@/areas/online/links/PublishCard';
import { HelpHint } from '@/areas/online/HelpHint';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { PermissionGate } from '@/ui/PermissionGate';
import { SectionCard } from '@/ui/SectionCard';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useToast } from '@/ui/Toast';

function HubTile({
  href,
  icon,
  label,
}: {
  /** О1/О27: плитка ведёт прямо к нужному блоку или экрану, а не на начало чужой страницы */
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 hover:bg-surface-3">
      {icon}
      <span className="text-sm font-medium text-fg">{label}</span>
    </Link>
  );
}

/** /biz/online — хаб настроек (F-03-002) + список ссылок (F-03-001, F-03-003…F-03-011) */
export function LinksScreen() {
  const t = useT('online');
  const toast = useToast();
  const { businessId, locationId, ready } = useCurrent();
  const { full: hasAccess } = useOnlineAccess();
  const [newOpen, setNewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const linksQ = useApiQuery(['online-links', businessId], () => listLinks(businessId!), { enabled: ready && Boolean(businessId) });
  const businessQ = useApiQuery(
    ['online-business', businessId],
    async () => {
      const [businesses, locations, staff] = await Promise.all([
        coreList('businesses', { id: businessId! }),
        coreList('locations', { businessId: businessId! }),
        coreList('staff', (s) => s.businessId === businessId && s.status === 'active'),
      ]);
      return { business: businesses[0], locations, staff };
    },
    { enabled: ready && Boolean(businessId) },
  );

  const deleteMutation = useApiMutation(deleteLink);
  const primaryMutation = useApiMutation((id: string) => setPrimaryLink(businessId!, id));

  // До данных — та же страница: заголовок, подсказка и плитки настоящие, ссылки — скелетоны карточек
  const loading = !ready || linksQ.isLoading || businessQ.isLoading;
  const skeletonCount = useSkeletonCount('online-links', { loading, count: linksQ.data?.length, fallback: 1, max: 10 });
  if (!loading && (linksQ.isError || businessQ.isError || !businessQ.data?.business)) {
    return (
      <ErrorState
        onRetry={() => {
          linksQ.refetch();
          businessQ.refetch();
        }}
      />
    );
  }

  const business = businessQ.data?.business;
  const locations = businessQ.data?.locations ?? [];
  const staff = businessQ.data?.staff ?? [];
  const location = locations.find((l) => l.id === locationId) ?? locations[0];
  const links = linksQ.data ?? [];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const urlFor = (linkId: string) => {
    const slug = business?.slug ?? '';
    const l = links.find((x) => x.id === linkId);
    if (!l) return `${origin}/b/${slug}`;
    return l.primary ? `${origin}/b/${slug}` : `${origin}/b/${slug}/f/${l.formId}`;
  };

  return (
    <PermissionGate permission={hasAccess ? undefined : 'online.manage'} fallback="message" className="mx-auto max-w-[760px]">
      <div className="flex flex-col gap-6" data-f="F-03-001" aria-busy={loading || undefined}>
        <PageHeader
          title={t('links.title')}
          description={t('links.subtitle')}
          meta={<HelpHint screenKey="links" />}
          actions={
            <Button leftIcon={<Plus aria-hidden />} disabled={loading} onClick={() => setNewOpen(true)}>
              {t('links.new.button')}
            </Button>
          }
        />

        {/* Черновик нового бизнеса — «Опубликовать»; приглашённые, но не принявшие — почему их нет в записи */}
        {businessId && !loading && <PublishCard businessId={businessId} onPublished={() => businessQ.refetch()} />}

        <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5" data-f="F-03-047 F-14-121">
          <Smartphone aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <p className="text-sm text-muted">{t('hub.mobileNote')}</p>
        </div>

        <div data-f="F-03-002">
          <SectionCard title={t('hub.title')} description={t('hub.description')}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('hub.groupBrand')}</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <HubTile
                    href="/biz/settings/brand"
                    icon={<Building2 aria-hidden className="size-5 shrink-0 text-primary-text" />}
                    label={t('hub.tiles.brand')}
                  />
                  <HubTile
                    href="/biz/settings/contacts"
                    icon={<Contact aria-hidden className="size-5 shrink-0 text-primary-text" />}
                    label={t('hub.tiles.contacts')}
                  />
                  <HubTile
                    href="/biz/settings/gallery"
                    icon={<Images aria-hidden className="size-5 shrink-0 text-primary-text" />}
                    label={t('hub.tiles.gallery')}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('hub.groupMore')}</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <HubTile
                    href="/biz/online/settings#when"
                    icon={<CalendarClock aria-hidden className="size-5 shrink-0 text-primary-text" />}
                    label={t('hub.tiles.grid')}
                  />
                  <HubTile
                    href="/biz/online/settings#staff-choice"
                    icon={<Users aria-hidden className="size-5 shrink-0 text-primary-text" />}
                    label={t('hub.tiles.masterStep')}
                  />
                  <HubTile
                    href={links.find((l) => l.primary) ? `/biz/online/links/${links.find((l) => l.primary)!.id}#design` : '/biz/online/widget'}
                    icon={<Palette aria-hidden className="size-5 shrink-0 text-primary-text" />}
                    label={t('hub.tiles.design')}
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-3">
          {loading || !business ? (
            Array.from({ length: skeletonCount }, (_, i) => <LinkCardSkeleton key={i} />)
          ) : links.length === 0 ? (
            <EmptyState icon={<Link2 aria-hidden />} title={t('links.empty.title')} description={t('links.empty.description')} />
          ) : (
            links.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                locationName={location?.name.ru}
                staffName={link.staffId ? staff.find((s) => s.id === link.staffId)?.name : undefined}
                publicUrl={urlFor(link.id)}
                unpublished={business.status !== 'active'}
                onDelete={() => setDeleteId(link.id)}
                onMakePrimary={async () => {
                  try {
                    await primaryMutation.mutate(link.id);
                    toast.success(t('links.card.primarySet'));
                    linksQ.refetch();
                  } catch {
                    toast.error(t('links.card.primaryFailed'));
                  }
                }}
              />
            ))
          )}
        </div>
      </div>

      {business && (
        <NewLinkSheet
          open={newOpen}
          onOpenChange={setNewOpen}
          businessId={business.id}
          locationId={location?.id}
          staffOptions={staff.map((s) => ({ id: s.id, name: s.name }))}
          onCreated={() => linksQ.refetch()}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        tone="danger"
        title={t('links.delete.title')}
        description={t('links.delete.description')}
        confirmLabel={t('links.delete.confirm')}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await deleteMutation.mutate(deleteId);
            toast.success(t('links.delete.done'));
            linksQ.refetch();
          } catch {
            toast.error(t('links.delete.failed'));
          } finally {
            setDeleteId(null);
          }
        }}
      />
    </PermissionGate>
  );
}
