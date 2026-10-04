'use client';

/**
 * /biz/clients/[clientId] — карточка клиента (F-00-128, F-04-066…079, F-04-165…167, F-04-194…214), хост вкладок «clientCard».
 *
 * Главный путь — «Записать» (speed-k1…k3 №4, ux-r2/r5 улучшение 2): primary в шапке на десктопе, внизу у пальца на телефоне
 * вместе с «Позвонить». Редкое и опасное — в «⋯». «Назад к клиентам» вместо «✕». Десктоп — две колонки: слева профиль
 * (липкий), справа деньги и вкладки; первая вкладка — «История визитов» (speed-k2 №4).
 */
import { useEffect, useEffectEvent, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, CalendarPlus, FolderOpen, History, MoreVertical, Phone, UserRound } from 'lucide-react';
import {
  deleteClient,
  getAppActivity,
  getClientRow,
  getInvitedAt,
  inviteToApp,
  listClientChangeLog,
  listComments,
  listVisitors,
  purgeClientData,
  recalcClientLoyalty,
} from '@/api/clients';
import { getClientAccountBalance } from '@/api/finance';
import { useCoreGet, useCoreList } from '@/api/core';
import { ApiError, prefetchApiQuery, useApiMutation, useApiQuery } from '@/api/request';
import { AddVisitSheet } from '@/areas/clients/components/AddVisitSheet';
import { CallsTab } from '@/areas/clients/components/CallsTab';
import { FilesTab } from '@/areas/clients/components/FilesTab';
import { HistoryTab, HistoryTabSkeleton } from '@/areas/clients/components/HistoryTab';
import { MergeClientsModal } from '@/areas/clients/components/MergeClientsModal';
import { StatsTab } from '@/areas/clients/components/StatsTab';
import { ClientAboutTab } from '@/areas/clients/components/card/ClientAboutTab';
import { ClientCardMenu } from '@/areas/clients/components/card/ClientCardMenu';
import { ClientMoneySummary, ClientMoneySummarySkeleton } from '@/areas/clients/components/card/ClientMoneySummary';
import { ClientNextBooking } from '@/areas/clients/components/card/ClientNextBooking';
import { ClientProfileCard, ClientProfileCardSkeleton } from '@/areas/clients/components/card/ClientProfileCard';
import { EditClientSheet } from '@/areas/clients/components/card/EditClientSheet';
import { clientRowKey } from '@/areas/clients/lib/cardCache';
import { formatDisplayName, useClientsRights } from '@/areas/clients/lib/rights';
import type { HistoryFilter } from '@/domain/clients';
import { useCan, useCurrent } from '@/demo/hooks';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import { useExtensions } from '@/extensions/useExtensions';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { cn } from '@/lib/cn';
import { telLink } from '@/lib/phone';
import { LinkButton, buttonClasses } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { IconButton } from '@/ui/IconButton';
import { SkeletonText } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Tabs, type TabItem } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';
import { useEscape } from '@/ui/hooks/useEscape';

/** Старые ссылки окна записи вели на вкладку «card» — теперь это «О клиенте» */
const LEGACY_TABS: Record<string, string> = { card: 'about' };

/**
 * F-04-080/081/082/083/087/088/089/090: те же вкладки карточки клиента, что 04-clients-crm.md описывает под
 * своими F-04-… id, вкладчики строят под собственной нумерацией раздела (loyalty — F-06-…, notify — F-05-…,
 * finance — F-07-…). Дублирование id — не наша ошибка, а сама ТЗ описывает один экран дважды: здесь, в 04, и
 * ещё раз в разделе владельца вкладки. Помечаем узел вкладки нашим номером, не трогая чужой файл.
 */

export function ClientCardScreen() {
  const t = useT('clients');
  const format = useFormat();
  const tDyn = useTDynamic();
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ clientId: string }>();
  const searchParams = useSearchParams();
  const clientId = params.clientId;
  const { ready, businessId, businessIds, staffId, locationId } = useCurrent();
  const rights = useClientsRights();
  const canBook = useCan('journal.create');

  const back = () => router.push('/biz/clients');
  useEscape(true, back);

  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState(() => (initialTab ? (LEGACY_TABS[initialTab] ?? initialTab) : 'history'));
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  // Открытые однажды вкладки остаются смонтированными (скрыты): возврат на вкладку не пересоздаёт её и не
  // показывает скелетон заново (scripts/flicker.mjs, clients-card-tabs)
  const [visitedTabs, setVisitedTabs] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [addVisitOpen, setAddVisitOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'purge' | null>(null);
  // Пока едем на список после удаления — не перечитывать уже удалённого клиента (иначе мелькнёт ErrorState)
  const [leaving, setLeaving] = useState(false);

  // F-04-199 (исправлено): без «Все клиенты» — прямая ссылка на чужую карточку тоже отдаёт «не найдено»,
  // не только список (было — только список фильтровал `onlyStaffId`, сама карточка отдавала любого клиента)
  const restrictToStaffId = !rights.seeAllClients && staffId ? staffId : undefined;
  // Сеть (F-00-050): карточка открывается и из соседнего филиала — ищем среди всех бизнесов сети
  const rowQ = useApiQuery(
    clientRowKey(businessId, clientId, businessIds, restrictToStaffId),
    () => getClientRow(businessId ?? '', clientId, businessIds, restrictToStaffId),
    { enabled: ready && Boolean(businessId) && Boolean(clientId) && !leaving },
  );
  const row = rowQ.data;
  const bizId = row?.businessId ?? businessId ?? '';
  const businessQ = useCoreGet('businesses', bizId || undefined, { enabled: ready });
  const meQ = useCoreGet('staff', staffId ?? undefined, { enabled: ready });
  const servicesQ = useCoreList('services', { businessId: bizId }, { enabled: ready && Boolean(bizId) });
  const invitedQ = useApiQuery(['clients', 'invitedAt', clientId], () => getInvitedAt(clientId), {
    enabled: ready && Boolean(row && !row.appUserId),
  });
  const invite = useApiMutation(inviteToApp);
  const recalc = useApiMutation((args: { businessId: string; clientId: string }) => recalcClientLoyalty(args.businessId, args.clientId, 'manual'));
  const authorName = meQ.data?.name ?? t('card.you');
  const remove = useApiMutation((args: { businessId: string; clientId: string }) =>
    deleteClient(args.businessId, args.clientId, staffId ?? undefined, authorName),
  );
  const purge = useApiMutation((args: { businessId: string; clientId: string }) =>
    purgeClientData(args.businessId, args.clientId, staffId ?? undefined, authorName),
  );
  const extensions = useExtensions('clientCard');
  // F-07-182 «Готово, когда»: удаление карточки с ненулевым счётом клиента не проходит молча
  // Не `row!.businessId`: React Compiler по «!» считает row не-null и выносит чтение поля в рендер.
  const rowBusinessId = row?.businessId;
  const accountBalanceQ = useApiQuery(
    ['finance', 'clientAccountBalance', rowBusinessId, clientId],
    () => getClientAccountBalance(rowBusinessId ?? '', clientId),
    { enabled: ready && Boolean(row) && confirm === 'delete' },
  );
  const accountBalance = accountBalanceQ.data ?? 0;

  const canEditAny = rights.editClient || rights.editNote || rights.editFullName || rights.editCustomFields;
  const bookHref = `/biz/journal?new=1&client=${clientId}`;

  const runRemove = async (kind: 'delete' | 'purge') => {
    if (!row) return;
    setLeaving(true);
    try {
      await (kind === 'delete' ? remove : purge).mutate({ businessId: row.businessId, clientId: row.id });
    } catch {
      setLeaving(false);
      toast.error(t('card.deleteFailed'));
      return;
    }
    toast.success(kind === 'delete' ? t('card.deleted') : t('card.purged'));
    router.push('/biz/clients');
  };

  const runInvite = async () => {
    if (!row) return;
    try {
      await invite.mutate(row.id);
      toast.success(t('card.invited'));
    } catch {
      toast.error(t('card.inviteFailed'));
    }
  };

  const runRecalc = async () => {
    if (!row) return;
    try {
      const change = await recalc.mutate({ businessId: row.businessId, clientId: row.id });
      toast.success(change ? t('card.recalcChanged') : t('card.recalcNoChange'));
    } catch {
      toast.error(t('card.recalcFailed'));
    }
  };

  const backLink = { href: '/biz/clients', label: t('cardView.back') };

  // Данные вкладки «О клиенте» — в кэш в простое, пока человек смотрит историю: переход на вкладку показывает их
  // сразу, без скелетонов на месте журнала изменений и комментариев (scripts/flicker.mjs, clients-card-tabs)
  const prefetchAbout = useEffectEvent(() => {
    if (!rowBusinessId) return undefined;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => {
      prefetchApiQuery(['clients', 'appActivity', clientId], () => getAppActivity(clientId));
      prefetchApiQuery(['clients', 'visitors', rowBusinessId, clientId], () => listVisitors(rowBusinessId, clientId));
      prefetchApiQuery(['clients', 'changeLog', rowBusinessId, clientId], () => listClientChangeLog(rowBusinessId, clientId));
      prefetchApiQuery(['clients', 'comments', clientId], () => listComments(clientId));
    });
    return () => cancel(handle);
  });
  useEffect(() => prefetchAbout(), [rowBusinessId, clientId]);

  // F-04-195: без права «лояльность клиента» вклад раздела loyalty не показывается
  const visibleExtensions = rights.viewLoyalty ? extensions : extensions.filter((e) => e.area !== 'loyalty');
  // К4 (clients-review 27.09.2026): раньше вкладок было больше, чем влезает (стрелка вправо в Tabs) — на
  // виду только три главные, редкие («Звонки», «Файлы», вклады loyalty/notify) — в «Ещё ⌄» справа от них.
  const primaryTabs: TabItem[] = [
    ...(rights.viewHistory ? [{ value: 'history', label: t('card.tabs.history'), icon: <History aria-hidden /> }] : []),
    { value: 'about', label: t('card.tabs.about'), icon: <UserRound aria-hidden /> },
    { value: 'stats', label: t('card.tabs.stats'), icon: <BarChart3 aria-hidden /> },
  ];
  const overflowTabs: TabItem[] = [
    { value: 'calls', label: t('card.tabs.calls'), icon: <Phone aria-hidden /> },
    ...(rights.viewFiles ? [{ value: 'files', label: t('card.tabs.files'), icon: <FolderOpen aria-hidden /> }] : []),
    ...visibleExtensions.map((e) => ({ value: `${e.host}:${e.area}`, label: tDyn(e.labelKey) })),
  ];
  if (rowQ.isError) {
    // Клиент удалён (F-04-137): не «проверьте соединение» — повтор не поможет; ведём в журнал изменений
    const isDeleted = rowQ.error instanceof ApiError && rowQ.error.code === 'not_found';
    const notOwn = rowQ.error instanceof ApiError && rowQ.error.code === 'not_own_client';
    return (
      <div className="flex w-full flex-col gap-6">
        <PageHeader title={t('panel.title')} back={backLink} />
        {notOwn ? (
          <ErrorState title={t('card.notOwnTitle')} description={t('card.notOwnText')} />
        ) : isDeleted ? (
          <div className="flex flex-col items-center gap-3">
            <ErrorState title={t('card.deletedTitle')} description={t('card.deletedText')} />
            <LinkButton variant="outline" href="/biz/clients/log" leftIcon={<History aria-hidden />}>
              {t('card.deletedOpenLog')}
            </LinkButton>
          </div>
        ) : (
          <ErrorState title={t('cardView.loadFailed')} onRetry={rowQ.refetch} />
        )}
      </div>
    );
  }

  if (!row || leaving) {
    // Скелетон = та же страница (DESIGN.md «The skeleton IS the page»): заголовок и кнопки шапки на своих местах,
    // карточка профиля той же разметки, ближайшая запись (её запрос не ждёт клиента), плитки денег, та же строка
    // вкладок и история визитов. Со списка карточка сюда обычно не попадает: строка уже подложена в кэш (seedClientRow).
    const skeletonMenu = <IconButton icon={<MoreVertical aria-hidden />} label={t('card.more')} variant="outline" disabled />;
    return (
      <div className="flex w-full flex-col gap-6" aria-busy>
        <PageHeader
          title={<SkeletonText width="18ch" />}
          back={backLink}
          actions={
            <span className="flex items-center gap-2 max-md:hidden">
              {skeletonMenu}
              {canBook && (
                <LinkButton href={bookHref} leftIcon={<CalendarPlus aria-hidden />}>
                  {t('cardView.book')}
                </LinkButton>
              )}
            </span>
          }
        />
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[22rem_1fr] lg:items-start">
          <div className="lg:sticky lg:top-20">
            <ClientProfileCardSkeleton canSeeContacts={rights.contactsInCard} menu={skeletonMenu} />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            {businessId && <ClientNextBooking clientId={clientId} businessId={businessId} services={servicesQ.data ?? []} />}
            <ClientMoneySummarySkeleton showMoney={rights.viewAccounts} />
            <div className="flex items-center gap-1 border-b border-border">
              <Tabs items={primaryTabs} value={primaryTabs.some((x) => x.value === tab) ? tab : primaryTabs[0].value} onValueChange={setTab} className="min-w-0 flex-1" classNames={{ list: 'border-b-0' }} />
              {overflowTabs.length > 0 && (
                <span className="mb-2 flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted">
                  {t('card.tabs.more')}
                  <DropdownChevron open={false} />
                </span>
              )}
            </div>
            {(!primaryTabs.some((x) => x.value === tab) || tab === 'history') && primaryTabs[0].value === 'history' && (
              <HistoryTabSkeleton withAction={rights.editClient} />
            )}
          </div>
        </div>
        {/* Та же панель у пальца на телефоне: звонок (номер ещё не известен — неактивен) и «Записать» */}
        {(canBook || rights.contactsInCard) && (
          <StickyActionBar desktop="hidden" aria-label={t('cardView.actions')}>
            {rights.contactsInCard && (
              <span aria-hidden className={cn(buttonClasses({ variant: 'outline' }), 'max-md:!flex-none shrink-0 px-3.5 opacity-50')}>
                <Phone aria-hidden className="size-5" />
              </span>
            )}
            {canBook && (
              <LinkButton href={bookHref} leftIcon={<CalendarPlus aria-hidden />}>
                {t('cardView.book')}
              </LinkButton>
            )}
          </StickyActionBar>
        )}
      </div>
    );
  }

  const waText = t('card.waMessage', { business: businessQ.data?.name || t('card.waMessageFallback') });
  const tabs = [...primaryTabs, ...overflowTabs];
  const activeTab = tabs.some((x) => x.value === tab) ? tab : tabs[0].value;
  if (!visitedTabs.includes(activeTab)) setVisitedTabs((v) => (v.includes(activeTab) ? v : [...v, activeTab]));
  // Выбранная вкладка из «Ещё» встаёт рядом с главными — иначе в строке не осталось бы видно, какая активна
  const activeOverflowTab = overflowTabs.find((x) => x.value === activeTab);
  const visibleTabs = activeOverflowTab ? [...primaryTabs, activeOverflowTab] : primaryTabs;
  const hiddenOverflowTabs = activeOverflowTab ? overflowTabs.filter((x) => x.value !== activeTab) : overflowTabs;

  const menu = (
    <ClientCardMenu
      canEdit={canEditAny}
      canAddVisit={rights.editClient}
      canDelete={rights.deleteClients}
      canInvite={!row.appUserId && rights.editClient}
      invitedBefore={Boolean(invitedQ.data)}
      onEdit={() => setEditOpen(true)}
      onAddVisit={() => setAddVisitOpen(true)}
      onInvite={runInvite}
      onRecalc={runRecalc}
      onMerge={() => setMergeOpen(true)}
      onDelete={() => setConfirm('delete')}
      onPurge={() => setConfirm('purge')}
    />
  );

  return (
    <div data-f="F-00-128 F-04-066 F-04-212 F-14-100 F-14-178" className="flex w-full flex-col gap-6">
      <PageHeader
        // К1 (clients-review 27.09.2026): заголовок — полное ФИО один раз (ниже, в ClientProfileCard, оно
        // больше не повторяется); без права viewFullName — имя и первая буква фамилии (F-04-106).
        title={<span data-f="F-04-106">{formatDisplayName(row.name, row.lastName, row.middleName, rights.viewFullName)}</span>}
        back={backLink}
        actions={
          // span, а не div: каркас шапки на телефоне «растворяет» div-обёртки, а здесь нужно именно спрятать —
          // на телефоне «⋯» в карточке профиля, «Записать» — внизу у пальца
          <span className="flex items-center gap-2 max-md:hidden">
            {menu}
            {canBook && (
              <LinkButton href={bookHref} leftIcon={<CalendarPlus aria-hidden />}>
                {t('cardView.book')}
              </LinkButton>
            )}
          </span>
        }
      />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[22rem_1fr] lg:items-start">
        <div className="lg:sticky lg:top-20">
          <ClientProfileCard
            row={row}
            canSeeContacts={rights.contactsInCard}
            canSeeNote={rights.viewNote}
            waText={waText}
            menu={menu}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <ClientNextBooking clientId={row.id} businessId={row.businessId} services={servicesQ.data ?? []} />
          <ClientMoneySummary
            row={row}
            showMoney={rights.viewAccounts}
            bookHref={bookHref}
            canBook={canBook}
            onShowDebt={() => {
              setHistoryFilter('debt');
              setTab('history');
            }}
          />

          <div className="flex items-center gap-1 border-b border-border">
            <Tabs
              items={visibleTabs}
              value={activeTab}
              onValueChange={setTab}
              className="min-w-0 flex-1"
              classNames={{ list: 'border-b-0' }}
            />
            {hiddenOverflowTabs.length > 0 && (
              <DropdownMenu
                align="end"
                label={t('card.tabs.moreAriaLabel')}
                trigger={(p) => (
                  <button
                    {...p}
                    type="button"
                    aria-label={t('card.tabs.moreAriaLabel')}
                    className="mb-2 flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
                  >
                    {t('card.tabs.more')}
                    <DropdownChevron open={p['aria-expanded']} />
                  </button>
                )}
                items={hiddenOverflowTabs.map((ot) => ({
                  id: ot.value,
                  label: ot.label,
                  icon: ot.icon,
                  onSelect: () => setTab(ot.value),
                }))}
              />
            )}
          </div>

          {tabs.map((tabItem) => {
            const value = tabItem.value;
            const active = value === activeTab;
            if (!active && !visitedTabs.includes(value)) return null;
            if (value.includes(':')) return null; // вклады — ниже, своим списком
            return (
              <div key={value} hidden={!active} className="min-w-0">
                {value === 'history' && (
                  <HistoryTab
                    businessId={row.businessId}
                    clientId={row.id}
                    services={servicesQ.data ?? []}
                    filter={historyFilter}
                    onFilterChange={setHistoryFilter}
                    onAddVisit={rights.editClient ? () => setAddVisitOpen(true) : undefined}
                    canViewAccounts={rights.viewAccounts}
                  />
                )}
                {value === 'about' && (
                  <ClientAboutTab row={row} businessId={row.businessId} staffId={staffId ?? undefined} authorName={authorName} rights={rights} />
                )}
                {value === 'stats' && (
                  <StatsTab businessId={row.businessId} clientId={row.id} services={servicesQ.data ?? []} canViewAccounts={rights.viewAccounts} />
                )}
                {value === 'calls' && <CallsTab clientId={row.id} />}
                {value === 'files' && (
                  <FilesTab clientId={row.id} uploaderName={authorName} canUpload={rights.uploadFiles} canDelete={rights.deleteFiles} />
                )}
              </div>
            );
          })}
          {visibleExtensions.map((e) => {
            const extValue = `${e.host}:${e.area}`;
            const extActive = activeTab === extValue;
            if (!extActive && !visitedTabs.includes(extValue)) return null;
            const slot = <ExtensionSlot entry={e} props={{ clientId: row.id, businessId: row.businessId }} />;
            // Содержимое вкладки строит вкладчик (loyalty/notify/…), но сама вкладка карточки клиента — наш узел:
            // помечаем её дублирующими F-04-… id того же экрана из 04-clients-crm.md (loyalty: «Лояльность»
            // F-04-081…083; notify: «Отправить сообщение» F-04-080, «Уведомления» F-04-087…090). Оба литерала —
            // отдельными веткам JSX, а не собранной строкой: `fids.mjs` ищет только data-f="…" буквально.
            if (e.area === 'loyalty') {
              return (
                <div key={extValue} hidden={!extActive} data-f="F-04-081 F-04-082 F-04-083 F-04-217">
                  {slot}
                </div>
              );
            }
            if (e.area === 'notify') {
              return (
                <div key={extValue} hidden={!extActive} data-f="F-04-080 F-04-087 F-04-088 F-04-089 F-04-090">
                  {slot}
                </div>
              );
            }
            return (
              <div key={extValue} hidden={!extActive}>
                {slot}
              </div>
            );
          })}
        </div>
      </div>

      {/* К5 (clients-review 27.09.2026): «Позвонить» уже есть в карточке (ряд круглых кнопок связи, К2) —
          внизу у пальца второй раз не подписываем её текстом, только иконка звонка, рядом с «Записать». */}
      {(canBook || rights.contactsInCard) && (
        <StickyActionBar desktop="hidden" aria-label={t('cardView.actions')}>
          {rights.contactsInCard && (
            <a
              href={telLink(row.phone)}
              aria-label={t('card.call')}
              className={cn(buttonClasses({ variant: 'outline' }), 'max-md:!flex-none shrink-0 px-3.5')}
            >
              <Phone aria-hidden className="size-5" />
            </a>
          )}
          {canBook && (
            <LinkButton href={bookHref} leftIcon={<CalendarPlus aria-hidden />}>
              {t('cardView.book')}
            </LinkButton>
          )}
        </StickyActionBar>
      )}

      <EditClientSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        row={row}
        businessId={row.businessId}
        staffId={staffId ?? undefined}
        authorName={authorName}
        rights={rights}
      />
      <AddVisitSheet
        open={addVisitOpen}
        onOpenChange={setAddVisitOpen}
        businessId={row.businessId}
        locationId={locationId && locationId !== 'all' ? locationId : undefined}
        clientId={row.id}
      />
      <MergeClientsModal
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        businessId={row.businessId}
        current={row}
        authorName={authorName}
        onMerged={() => {
          setLeaving(true);
          back();
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('card.confirmDelete.title')}
        description={
          <span data-f="F-07-182">
            {t('card.confirmDelete.description', { name: row.name })}
            {accountBalance !== 0 && ` ${t('card.confirmDelete.balanceWarning', { amount: format.money(accountBalance) })}`}
          </span>
        }
        tone="danger"
        confirmLabel={t('card.delete')}
        onConfirm={() => runRemove('delete')}
      />
      <ConfirmDialog
        open={confirm === 'purge'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('card.confirmPurge.title')}
        description={<span data-f="F-10-159">{t('card.confirmPurge.description', { name: row.name })}</span>}
        tone="danger"
        confirmLabel={t('card.purge')}
        onConfirm={() => runRemove('purge')}
      />
    </div>
  );
}
