'use client';

/**
 * Окно записи → правая зона — клиент (F-01-062…066).
 * Телефон ищет совпадение по цифрам, имени, email прямо во время ввода (F-01-064); полный новый
 * номер создаёт клиента при сохранении (F-01-065); «Данные записи» — служебный блок у сохранённой
 * записи (F-01-062).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3,
  FolderOpen,
  History,
  Lock,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Receipt,
  Send,
  Star,
  UserPlus,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import type { Booking, Client, Id } from '@/domain/core';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { waLink } from '@/lib/phone';
import {
  getClientCardPins,
  getClientNoteForWindow,
  getClientVisitStats,
  searchClientsForBooking,
  setClientNoteForWindow,
  toggleClientCardPin,
} from '@/api/journal';
import { canSeeNetworkClientData, getNetworkClientHistory, listMyNetworks } from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { Skeleton } from '@/ui/Skeleton';
import { maskPhone, useWindowRights } from '@/areas/journal/lib/rights';
import { Badge } from '@/ui/Badge';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { Textarea } from '@/ui/Textarea';
import { LoyaltyBlock } from '@/areas/journal/components/booking-window/LoyaltyBlock';
import { VisitorBlock } from '@/areas/journal/components/booking-window/VisitorBlock';

/**
 * F-01-068: «Написать» — WhatsApp/Viber/Telegram по номеру клиента, без интеграции, просто
 * ссылки (CYCLE-01). Армения есть у всех трёх мессенджеров региональных списков (378495) — своего
 * списка стран не заводим (нет других сфер использования), показываем все три всегда.
 */
function MessengerLinks({ phone }: { phone: string }) {
  const t = useT('journal');
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return null;
  return (
    <div data-f="F-01-068" className="flex items-center gap-1">
      <span className="text-xs text-muted">{t('window.right.writeTo')}</span>
      <a
        href={waLink(phone)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-fg"
        aria-label="WhatsApp"
      >
        <MessageCircle aria-hidden className="size-4" />
      </a>
      <a
        href={`viber://chat?number=%2B${digits}`}
        className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-fg"
        aria-label="Viber"
      >
        <MessageSquare aria-hidden className="size-4" />
      </a>
      <a
        href={`https://t.me/+${digits}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-fg"
        aria-label="Telegram"
      >
        <Send aria-hidden className="size-4" />
      </a>
    </div>
  );
}

interface SectionDef {
  id: string;
  label: string;
  icon: ReactNode;
  href: string;
}

/**
 * F-01-069: плитки разделов клиента + «Еще» — «Профиль клиента» и «История визитов» плитками
 * всегда (⭐ карточке клиента из CRM ничего не показываем — F-00-130, поэтому это ссылки на СВОЮ
 * карточку клиента в разделе «Клиенты», а не показ данных здесь). Остальные разделы — в «Еще»,
 * звёздочка закрепляет их плиткой рядом; закреплённое — на пользователя (staffId), F-01-071 —
 * плитка «Статистика» разворачивается тут же, без перехода.
 */
function ClientSectionTiles({ client }: { client: Client }) {
  const t = useT('journal');
  const { staffId } = useCurrent();
  const userKey = staffId ?? 'anon';
  const pinsQuery = useApiQuery(['journal', 'client-card-pins', userKey], () => getClientCardPins(userKey));
  const togglePin = useApiMutation((section: string) => toggleClientCardPin(userKey, section), {
    invalidates: [['journal', 'client-card-pins', userKey]],
  });
  const pinned = pinsQuery.data ?? [];
  const [statsOpen, setStatsOpen] = useState(false);

  const optional: SectionDef[] = [
    {
      id: 'loyalty',
      label: t('window.right.tiles.loyalty'),
      icon: <Star aria-hidden className="size-4" />,
      href: `/biz/clients/${client.id}?tab=clientCard:loyalty`,
    },
    {
      id: 'stats',
      label: t('window.right.tiles.stats'),
      icon: <BarChart3 aria-hidden className="size-4" />,
      href: `/biz/clients/${client.id}?tab=stats`,
    },
    {
      id: 'calls',
      label: t('window.right.tiles.calls'),
      icon: <Phone aria-hidden className="size-4" />,
      href: `/biz/clients/${client.id}?tab=calls`,
    },
    {
      id: 'invoices',
      label: t('window.right.tiles.invoices'),
      icon: <Receipt aria-hidden className="size-4" />,
      href: `/biz/clients/${client.id}?tab=clientCard:finance`,
    },
    {
      id: 'files',
      label: t('window.right.tiles.files'),
      icon: <FolderOpen aria-hidden className="size-4" />,
      href: `/biz/clients/${client.id}?tab=files`,
    },
  ];
  const pinnedSections = optional.filter((s) => pinned.includes(s.id));

  function Tile({ section }: { section: SectionDef }) {
    if (section.id === 'stats') {
      return (
        <button
          type="button"
          onClick={() => setStatsOpen((v) => !v)}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-fg hover:bg-surface-3"
        >
          {section.icon}
          {section.label}
        </button>
      );
    }
    return (
      <Link
        href={section.href}
        className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-fg hover:bg-surface-3"
      >
        {section.icon}
        {section.label}
      </Link>
    );
  }

  return (
    <div data-f="F-01-069 F-01-071" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/biz/clients/${client.id}?tab=about`}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-fg hover:bg-surface-3"
        >
          <UserRound aria-hidden className="size-4" />
          {t('window.right.tiles.profile')}
        </Link>
        <Link
          href={`/biz/clients/${client.id}?tab=history`}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-fg hover:bg-surface-3"
        >
          <History aria-hidden className="size-4" />
          {t('window.right.tiles.history')}
        </Link>
        {pinnedSections.map((s) => (
          <Tile key={s.id} section={s} />
        ))}
        <DropdownMenu
          trigger={(props) => (
            <button
              {...props}
              type="button"
              className="flex min-h-9 items-center gap-1 rounded-full border border-dashed border-border-strong px-3 text-xs font-medium text-muted hover:bg-surface-2"
            >
              <MoreHorizontal aria-hidden className="size-4" />
              {t('window.right.tiles.more')}
            </button>
          )}
          label={t('window.right.tiles.more')}
          items={optional.map((s) => ({
            id: s.id,
            label: s.label,
            icon: <Star aria-hidden className={pinned.includes(s.id) ? 'size-4 fill-warning text-warning' : 'size-4 text-muted'} />,
            onSelect: () => togglePin.mutate(s.id),
          }))}
        />
      </div>
      {statsOpen && <ClientStatsCard clientId={client.id} />}
      {statsOpen && <NetworkClientDataCard client={client} />}
    </div>
  );
}

/** F-01-071: числа визитов/денег клиента — открывается плиткой «Статистика» из «Еще», без перехода */
function ClientStatsCard({ clientId }: { clientId: Id }) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const { businessIds, businessId } = useCurrent();
  const scope = businessIds && businessIds.length > 0 ? businessIds : businessId ? [businessId] : [];
  const statsQuery = useApiQuery(['journal', 'client-visit-stats', clientId, scope.join(',')], () => getClientVisitStats(clientId, scope));
  if (statsQuery.isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  const s = statsQuery.data;
  if (!s) return null;
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <div>
        <p className="text-xs text-muted">{t('window.right.stats.totalVisits')}</p>
        <p className="font-medium text-fg">{s.totalVisits}</p>
      </div>
      <div>
        <p className="text-xs text-muted">{t('window.right.stats.noShows')}</p>
        <p className="font-medium text-fg">{s.noShowCount}</p>
      </div>
      <div>
        <p className="text-xs text-muted">{t('window.right.stats.sold')}</p>
        <p className="font-medium text-fg">{format.money(s.sold)}</p>
      </div>
      <div>
        <p className="text-xs text-muted">{t('window.right.stats.paid')}</p>
        <p className="font-medium text-fg">{format.money(s.paid)}</p>
      </div>
      <div className="col-span-2">
        <p className="text-xs text-muted">{t('window.right.stats.balance')}</p>
        <p className={s.balance < 0 ? 'font-medium text-error' : 'font-medium text-fg'}>{format.money(s.balance)}</p>
      </div>
    </div>
  );
}

/**
 * F-11-052: «Данные сети» в окне записи локации — сводка клиента по всей сети (визиты, неявки,
 * продано), видна только сотруднику с правом «Доступ к данным клиентов по сети» (F-11-038; здесь —
 * canSeeNetworkClientData как проверка-приближение, пока staff не отдал точную привязку права к
 * выбранной сети — просьба записана в qa/requests/network.md). Матчит клиента по ТЕЛЕФОНУ через
 * getNetworkClientHistory — Booking.clientId у каждого филиала свой, только по телефону клиент один.
 * Ничего не рендерит, если бизнес не в сети или права нет (тихо скрыто, не ошибка).
 */
function NetworkClientDataCard({ client }: { client: Client }) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const { businessId, staffId, persona } = useCurrent();
  // Сеть6: персона сети — тоже владелец (раньше не считалась, и «Данные сети» не видел никто)
  const isOwner = persona === 'owner' || persona === 'individual' || persona === 'network';
  const networksQuery = useApiQuery(
    ['network', 'my-networks', businessId],
    () => listMyNetworks(businessId),
    { enabled: !!businessId },
  );
  const network = networksQuery.data?.[0];
  // Этап 21 (лейн network): canSeeNetworkClientData стала асинхронной (в api-режиме NetworkUser — серверный),
  // держим её тем же приёмом, что networksQuery выше.
  const canSeeQuery = useApiQuery(
    ['network', 'can-see-client-data', network?.id, staffId, isOwner],
    () => canSeeNetworkClientData(network?.id ?? '', staffId, isOwner),
    { enabled: !!network },
  );
  const allowed = canSeeQuery.data ?? false;
  // Не `network!.id`: React Compiler по «!» считает network не-null и выносит чтение поля в рендер.
  const historyQuery = useApiQuery(
    ['network', 'client-history-for-booking', network?.id, client.phone],
    () => getNetworkClientHistory(network?.id ?? '', client.phone),
    { enabled: !!network && allowed },
  );

  if (!network) return null;
  if (canSeeQuery.isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!allowed) return null;
  if (historyQuery.isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  const visits = historyQuery.data ?? [];
  const arrived = visits.filter((v) => v.booking.status === 'arrived');
  const noShows = visits.filter((v) => v.booking.status === 'no_show').length;
  const sold = arrived.reduce((sum, v) => sum + v.booking.total, 0);
  const lastVisit = arrived.map((v) => v.booking.start).sort().at(-1);

  return (
    <div
      data-f="F-11-052"
      className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface-2 p-3 text-sm"
    >
      <p className="col-span-2 text-xs font-medium text-muted">
        {t('window.right.networkData.title', { network: network.name })}
      </p>
      <div>
        <p className="text-xs text-muted">{t('window.right.networkData.lastVisit')}</p>
        <p className="font-medium text-fg">{lastVisit ? format.date(lastVisit.slice(0, 10), 'short') : '—'}</p>
      </div>
      <div>
        <p className="text-xs text-muted">{t('window.right.stats.totalVisits')}</p>
        <p className="font-medium text-fg">{arrived.length}</p>
      </div>
      <div>
        <p className="text-xs text-muted">{t('window.right.stats.noShows')}</p>
        <p className="font-medium text-fg">{noShows}</p>
      </div>
      <div>
        <p className="text-xs text-muted">{t('window.right.stats.sold')}</p>
        <p className="font-medium text-fg">{format.money(sold)}</p>
      </div>
    </div>
  );
}

/**
 * F-01-070: примечание о клиенте — виден и правится прямо в окне записи; сохраняет по «уходу с
 * поля» (blur), не по каждой букве. Категории клиента показываем как есть из Client.tags — свой
 * редактор категорий (авто-правила, цвета) строит раздел «Клиенты» (00-our-decisions не даёт этой
 * функции ⭐, значит 1:1 с Altegio — «категории» = раздел clients, см. qa/requests/journal.md).
 */
function ClientNoteBlock({ client }: { client: Client }) {
  const t = useT('journal');
  const noteQuery = useApiQuery(['journal', 'client-note', client.id], () => getClientNoteForWindow(client), {});
  const [draft, setDraft] = useState('');
  const loadedFor = useRef<Id | null>(null);
  useEffect(() => {
    if (noteQuery.data && loadedFor.current !== client.id) {
      setDraft(noteQuery.data.note);
      loadedFor.current = client.id;
    }
  }, [noteQuery.data, client.id]);
  const saveMutation = useApiMutation((note: string) => setClientNoteForWindow(client.id, note));

  return (
    <div data-f="F-01-070" className="flex flex-col gap-2">
      {noteQuery.data && noteQuery.data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {noteQuery.data.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      <FormField label={t('window.right.clientNote')}>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== (noteQuery.data?.note ?? '')) saveMutation.mutate(draft);
          }}
          rows={2}
          placeholder={t('window.right.clientNotePlaceholder')}
        />
      </FormField>
    </div>
  );
}

export interface ClientZoneProps {
  businessId: string;
  /** F-01-206: нужен для действий с лояльностью (выдача карты, изменение баланса начисляют по локации) */
  locationId?: Id;
  phone: string;
  onPhoneChange: (value: string) => void;
  clientName: string;
  onClientNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  matchedClient: Client | undefined;
  onSelectClient: (client: Client) => void;
  recordData?: { createdAt: string; paymentStatus: 'unpaid' | 'partial' | 'paid'; source: Booking['source']; createdByLabel: string };
  /** F-01-127: «Записывает другого посетителя» */
  visitorEnabled: boolean;
  onVisitorEnabledChange: (value: boolean) => void;
  visitorName: string;
  onVisitorNameChange: (value: string) => void;
  clientId?: Id;
}

export function ClientZone({
  businessId,
  locationId,
  phone,
  onPhoneChange,
  clientName,
  onClientNameChange,
  email,
  onEmailChange,
  matchedClient,
  onSelectClient,
  recordData,
  visitorEnabled,
  onVisitorEnabledChange,
  visitorName,
  onVisitorNameChange,
  clientId,
}: ClientZoneProps) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const canCreate = useCan('journal.create');
  // F-01-179: «Доступ к данным клиентов» / «Доступ к созданию новых клиентов» / «выпадающий список» /
  // «Показывать номера телефонов» — тоньше общего journal.edit
  const windowRights = useWindowRights();
  const canAccessClient = windowRights.clientAccess;
  const canCreateClient = canCreate && windowRights.createClientInWindow;
  const [query, setQuery] = useState('');
  // F-01-067: у сохранённой записи с клиентом — серая карточка со «✎ Изменить» вместо полей;
  // «Изменить» снова показывает поля и запоминает прежнего клиента в «Предыдущие клиенты» —
  // откат одним нажатием, без повторного набора номера (359553).
  const [editingClient, setEditingClient] = useState(!recordData);
  const [previousClients, setPreviousClients] = useState<Client[]>([]);
  const suggestQuery = useApiQuery(['journal', 'client-search', businessId, query], () => searchClientsForBooking(businessId, query), {
    enabled: query.trim().length >= 2 && !matchedClient && windowRights.clientDropdown,
  });
  // qa/measure/journal/ux-r2.md #1: список подсказок висел под полем и после выбора клиента — query
  // не сбрасывался; matchedClient сюда же гасит устаревший ответ, пришедший уже после выбора.
  const suggestions = matchedClient ? [] : (suggestQuery.data ?? []);

  const isNewClient = Boolean(phone) && !matchedClient;

  if (!canAccessClient) {
    return (
      <div data-f="F-01-179" role="note" className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium text-fg">{t('window.right.noClientAccessTitle')}</p>
          <p>{t('window.right.noClientAccessHint')}</p>
        </div>
      </div>
    );
  }

  // F-01-067: сохранённая запись с уже выбранным клиентом — карточка свёрнута
  const showCollapsed = Boolean(recordData && matchedClient && !editingClient);

  function handleSelectClient(next: Client) {
    if (matchedClient && matchedClient.id !== next.id) {
      setPreviousClients((prev) => (prev.some((c) => c.id === matchedClient.id) ? prev : [matchedClient, ...prev].slice(0, 5)));
    }
    onSelectClient(next);
    setQuery('');
    if (recordData) setEditingClient(false);
  }

  return (
    <div data-f="F-01-063 F-01-064 F-01-179" className="flex flex-col gap-4">
      {showCollapsed && matchedClient ? (
        <div data-f="F-01-067" className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-fg">{matchedClient.name}</p>
            <p className="truncate text-muted">{windowRights.showPhones ? format.phone(matchedClient.phone) : maskPhone(matchedClient.phone)}</p>
          </div>
          {canCreate && (
            <IconButton
              icon={<Pencil aria-hidden />}
              label={t('window.right.editClient')}
              size="sm"
              variant="ghost"
              onClick={() => setEditingClient(true)}
            />
          )}
        </div>
      ) : (
        <>
          <FormField label={t('window.phone')} hint={t('window.right.searchHint')}>
            {windowRights.showPhones ? (
              <PhoneInput
                value={phone}
                onValueChange={(v) => {
                  onPhoneChange(v);
                  setQuery(v);
                }}
                disabled={!canCreate}
              />
            ) : (
              <Input value={phone ? maskPhone(phone) : ''} disabled readOnly />
            )}
          </FormField>

          {suggestions.length > 0 && (
            <div data-f="F-01-073" className="-mt-2 flex flex-col gap-1 rounded-xl border border-border bg-surface-2 p-1.5">
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectClient(c)}
                  className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-surface-3"
                >
                  <span className="truncate font-medium text-fg">{c.name}</span>
                  <span className="shrink-0 text-muted">{windowRights.showPhones ? format.phone(c.phone) : maskPhone(c.phone)}</span>
                </button>
              ))}
            </div>
          )}

          <FormField label={t('window.clientName')} optional>
            <Input
              value={clientName}
              onChange={(e) => {
                onClientNameChange(e.target.value);
                setQuery(e.target.value);
              }}
              placeholder={t('window.clientNamePlaceholder')}
              disabled={!canCreateClient}
            />
          </FormField>

          <FormField label={t('window.right.email')} optional>
            <Input type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} disabled={!canCreateClient} />
          </FormField>

          {matchedClient ? (
            <div data-f="F-01-065 F-04-063 F-04-092" className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
              <Badge tone="info">{t('window.right.existingClientBadge')}</Badge>
              <span className="min-w-0 truncate text-sm text-fg">{matchedClient.name}</span>
            </div>
          ) : isNewClient ? (
            <div data-f="F-01-065" className="flex items-start gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2 px-3 py-2.5">
              <UserPlus aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="flex flex-col gap-1">
                <Badge tone="accent">{t('window.right.newClientBadge')}</Badge>
                <p className="text-xs text-muted">{t('window.right.newClientNote')}</p>
              </div>
            </div>
          ) : null}

          {/* F-01-067: откат к прежнему клиенту без повторного поиска (359553) */}
          {editingClient && previousClients.length > 0 && (
            <div data-f="F-01-067 F-04-096" className="flex flex-col gap-1 rounded-xl border border-dashed border-border-strong px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <History aria-hidden className="size-3.5" />
                {t('window.right.previousClients')}
              </div>
              {previousClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectClient(c)}
                  className="flex min-h-9 items-center justify-between gap-2 rounded-lg px-1.5 text-left text-sm hover:bg-surface-2"
                >
                  <span className="truncate text-fg">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted">{windowRights.showPhones ? format.phone(c.phone) : maskPhone(c.phone)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {matchedClient && windowRights.showPhones && <MessengerLinks phone={matchedClient.phone} />}

      {matchedClient && showCollapsed && <ClientSectionTiles client={matchedClient} />}

      {matchedClient && <ClientNoteBlock client={matchedClient} />}

      {matchedClient && (
        <LoyaltyBlock
          businessId={businessId}
          clientId={matchedClient.id}
          clientPhone={matchedClient.phone}
          locationId={locationId}
        />
      )}

      {recordData && (
        <div data-f="F-01-062 F-01-098" className="flex flex-col gap-1 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm">
          <p className="font-medium text-fg">{t('window.right.recordDataTitle')}</p>
          <p className="text-muted">
            {t('window.right.createdAt')}: {format.date(recordData.createdAt, 'short')} {format.time(recordData.createdAt)}
          </p>
          <p className="text-muted">
            {t('window.right.visitStatus')}: {t(`window.right.paymentStatus.${recordData.paymentStatus}`)}
          </p>
          <p className="text-muted">
            {t('window.right.source')}: {t(`window.right.sourceOptions.${recordData.source}`)} · {t('window.right.author')}:{' '}
            {recordData.createdByLabel}
          </p>
        </div>
      )}

      <div data-f="F-01-127 F-04-097" className="flex flex-col gap-2 rounded-xl border border-border px-3 py-2.5">
        <Checkbox label={t('window.right.visitorCheckbox')} checked={visitorEnabled} onCheckedChange={onVisitorEnabledChange} disabled={!canCreate} />
        {visitorEnabled && (
          <Input
            value={visitorName}
            onChange={(e) => onVisitorNameChange(e.target.value)}
            placeholder={t('window.right.visitorNamePlaceholder')}
            disabled={!canCreate}
          />
        )}
      </div>

      {recordData && visitorEnabled && visitorName && clientId && (
        <VisitorBlock clientId={clientId} visitorName={visitorName} onRemove={() => onVisitorEnabledChange(false)} />
      )}
    </div>
  );
}
