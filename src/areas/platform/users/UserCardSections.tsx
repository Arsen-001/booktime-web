'use client';

/**
 * Блоки карточки человека: статус (блок / удаление), профиль, роли в бизнесах, подключения (Telegram, Google),
 * записи как клиент, последние входы. Тот же каркас у скелетона — данные приходят без сдвигов.
 */
import { AlertTriangle, Ban, CalendarX2, ExternalLink, LogIn, MessageCircle, Send, Store } from 'lucide-react';
import { UserRoleBadges } from '@/areas/platform/users/UserBadges';
import type { BookingStatus } from '@/domain/core';
import type { PlatformUserCard } from '@/domain/platform/types/users';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/phone';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import { EmptyState } from '@/ui/EmptyState';
import { KeyValueList } from '@/ui/KeyValueList';
import { SkeletonText } from '@/ui/Skeleton';
import { Tooltip } from '@/ui/Tooltip';
import { BOOKING_STATUSES } from '@/domain/rules';

/** Заголовок блока внутри шторки — как в карточке бизнеса */
export function Block({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function StatusBanner({ card }: { card: PlatformUserCard }) {
  const t = useT('platform');
  const fmt = useFormat();
  if (card.status === 'active') return null;
  const danger = card.status === 'blocked';
  const title =
    card.status === 'blocked'
      ? t('users.card.blockedBanner', { date: fmt.dateTime(card.blockedAt ?? card.createdAt) })
      : card.status === 'deleted'
        ? t('users.card.deletedBanner', { date: fmt.date(card.deletedAt ?? card.createdAt, 'long') })
        : t('users.card.deleteBanner', { date: fmt.date(card.deleteRequestedAt ?? card.createdAt, 'long') });
  const Icon = danger ? Ban : AlertTriangle;
  return (
    <div role="status" className={cn('flex gap-3 rounded-xl p-4', danger ? 'bg-danger-soft' : 'bg-warning-soft')}>
      <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', danger ? 'text-danger' : 'text-warning')} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium text-fg">{title}</p>
        {card.status === 'blocked' && card.blockReason && <p className="text-sm break-words text-fg">{t('users.card.blockedReason', { reason: card.blockReason })}</p>}
        {card.status === 'delete_requested' && <p className="text-sm text-muted">{t('users.card.deleteBannerHint')}</p>}
      </div>
    </div>
  );
}

export function ProfileBlock({ card }: { card: PlatformUserCard }) {
  const t = useT('platform');
  const fmt = useFormat();
  const localeLabel = card.locale === 'ru' || card.locale === 'en' || card.locale === 'hy' ? t(`users.locale.${card.locale}`) : card.locale;
  return (
    <Block title={t('users.card.profile')}>
      <KeyValueList
        columns={2}
        items={[
          { label: t('users.card.phone'), value: card.phone ? <span className="whitespace-nowrap select-all">{formatPhone(card.phone)}</span> : <span className="text-muted">{t('users.noPhone')}</span> },
          { label: t('users.card.language'), value: localeLabel },
          { label: t('users.card.registered'), value: fmt.date(card.createdAt, 'long') },
          ...(card.firstLoginVia && isVia(card.firstLoginVia) ? [{ label: t('users.card.firstLoginVia'), value: t(`users.via.${card.firstLoginVia}`) }] : []),
          {
            label: t('users.card.lastLogin'),
            value: card.lastLogin ? `${fmt.dateTime(card.lastLogin.at)} · ${methodLabel(t, card.lastLogin.method, lastLoginChannel(card))}` : <span className="text-muted">{t('users.never')}</span>,
          },
          ...(card.lastActiveAt ? [{ label: t('users.card.lastActive'), value: fmt.ago(card.lastActiveAt) }] : []),
          { label: t('users.card.sessions'), value: t('users.card.sessionsCount', { n: card.activeSessions }) },
          ...(card.team ? [{ label: t('users.card.teamRole'), value: t('users.card.teamRoleValue', { role: card.team.role }) }] : []),
        ]}
      />
    </Block>
  );
}

type T = ReturnType<typeof useT<'platform'>>;
const METHODS = ['code', 'google', 'apple', 'password', 'platform', 'second_factor'] as const;
const RESULTS = ['ok', 'wrong_code', 'wrong_password', 'locked', 'blocked', 'second_factor_sent', 'google_unlinked', 'google_invalid', 'google_linked', 'google_taken'] as const;
const APPS = ['client', 'business', 'platform'] as const;

const VIAS = ['telegram', 'whatsapp', 'sms', 'google', 'apple'] as const;
const isVia = (v: string): v is (typeof VIAS)[number] => (VIAS as readonly string[]).includes(v);

/** «кодом в WhatsApp», если у входа по коду известен канал; иначе «по коду» / «через Google» … */
function methodLabel(t: T, method: string, channel?: string | null): string {
  if (method === 'code' && channel && isVia(channel)) return t(`users.via.${channel}`);
  return (METHODS as readonly string[]).includes(method) ? t(`users.method.${method as (typeof METHODS)[number]}`) : method;
}

/** Канал последнего входа — из журнала входов (там же, где «последний вход») */
function lastLoginChannel(card: PlatformUserCard): string | null {
  const at = card.lastLogin?.at;
  return card.logins.find((l) => l.at === at && l.result === 'ok')?.channel ?? null;
}

export function RolesBlock({ card }: { card: PlatformUserCard }) {
  const t = useT('platform');
  return (
    <Block title={t('users.card.roles')}>
      {!card.roles.length && !card.networks.length ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t('users.card.rolesEmpty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {card.networks.map((n) => (
            <li key={n.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
              <Store aria-hidden className="size-5 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-fg">{t('users.card.networkOwner', { name: n.name })}</span>
            </li>
          ))}
          {card.roles.map((r) => (
            <li key={`${r.businessId}-${r.role}`} className="flex min-h-14 items-center gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium text-fg">{r.businessName}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <UserRoleBadges roles={[r.role]} />
                  {r.fired && (
                    <Badge size="sm" tone="neutral">
                      {t('users.card.fired')}
                    </Badge>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {/* Главное — карточка бизнеса в нашей панели; публичная страница — значком в новой вкладке */}
                <LinkButton href={`/platform/businesses?b=${encodeURIComponent(r.businessId)}`} variant="ghost" size="sm">
                  {t('users.card.openBusiness')}
                </LinkButton>
                {r.businessSlug && (
                  <Tooltip content={t('users.card.openPage')}>
                    <a
                      href={`/b/${r.businessSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t('users.card.openPage')}
                      className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                    >
                      <ExternalLink aria-hidden className="size-4" />
                    </a>
                  </Tooltip>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

export function LinksBlock({ card }: { card: PlatformUserCard }) {
  const t = useT('platform');
  const fmt = useFormat();
  const tg = card.telegram.connected
    ? t('users.card.telegramOn', { date: fmt.date(card.telegram.since ?? card.createdAt, 'long') })
    : card.telegram.stopped
      ? t('users.card.telegramStopped')
      : t('users.card.telegramOff');
  const wa = card.whatsapp.used ? t('users.card.whatsappOn', { date: fmt.date(card.whatsapp.lastAt ?? card.createdAt, 'long') }) : t('users.card.whatsappOff');
  const google = card.google.linked ? [card.google.email, card.google.since ? t('users.card.googleOn', { date: fmt.date(card.google.since, 'long') }) : null].filter(Boolean).join(' · ') : t('users.card.googleOff');
  return (
    <Block title={t('users.card.links')}>
      <KeyValueList
        items={[
          {
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Send aria-hidden className="size-4" />
                {t('users.card.telegram')}
              </span>
            ),
            value: <span className={card.telegram.connected ? 'text-fg' : 'text-muted'}>{tg}</span>,
          },
          {
            label: (
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle aria-hidden className="size-4" />
                {t('users.card.whatsapp')}
              </span>
            ),
            value: <span className={card.whatsapp.used ? 'text-fg' : 'text-muted'}>{wa}</span>,
          },
          {
            label: (
              <span className="inline-flex items-center gap-1.5">
                <LogIn aria-hidden className="size-4" />
                {t('users.card.google')}
              </span>
            ),
            value: <span className={cn('break-all', card.google.linked ? 'text-fg' : 'text-muted')}>{google}</span>,
          },
        ]}
      />
    </Block>
  );
}

const isBookingStatus = (s: string): s is BookingStatus => (BOOKING_STATUSES as readonly string[]).includes(s);

export function BookingsBlock({ card }: { card: PlatformUserCard }) {
  const t = useT('platform');
  const fmt = useFormat();
  return (
    <Block title={t('users.card.bookings')} hint={card.bookings.total ? t('users.card.bookingsTotal', { n: card.bookings.total }) : undefined}>
      {!card.bookings.recent.length ? (
        <EmptyState compact framed icon={<CalendarX2 aria-hidden />} title={t('users.card.bookingsEmpty')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {card.bookings.recent.map((b) => (
            <li key={b.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-fg">{b.businessName || '—'}</span>
                <span className="text-sm text-muted">{fmt.dateTime(b.start)}</span>
              </span>
              {isBookingStatus(b.status) ? <BookingStatusBadge status={b.status} size="sm" /> : <Badge size="sm">{b.status}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

export function LoginsBlock({ card }: { card: PlatformUserCard }) {
  const t = useT('platform');
  const fmt = useFormat();
  return (
    <Block title={t('users.card.logins')} hint={card.logins.length ? t('users.card.loginsHint') : undefined}>
      {!card.logins.length ? (
        <EmptyState compact framed icon={<LogIn aria-hidden />} title={t('users.card.loginsEmpty')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {card.logins.map((l, i) => {
            const ok = l.result === 'ok';
            const result = (RESULTS as readonly string[]).includes(l.result) ? t(`users.result.${l.result as (typeof RESULTS)[number]}`) : t('users.result.other');
            const app = (APPS as readonly string[]).includes(l.app) ? t(`users.app.${l.app as (typeof APPS)[number]}`) : l.app;
            return (
              <li key={`${l.at}-${i}`} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-fg">{fmt.dateTime(l.at)}</span>
                  <span className="truncate text-sm text-muted">{[app, methodLabel(t, l.method, l.channel), l.ip].filter(Boolean).join(' · ')}</span>
                </span>
                <Badge size="sm" tone={ok ? 'success' : l.result === 'second_factor_sent' || l.result === 'google_linked' ? 'neutral' : 'warning'}>
                  {result}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Block>
  );
}

/** Скелетон карточки: те же блоки и строки */
export function UserCardSkeleton() {
  const t = useT('platform');
  const rows = (n: number) => (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="flex min-h-14 items-center gap-3 px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-fg">
              <SkeletonText width="16ch" />
            </span>
            <span className="text-sm text-muted">
              <SkeletonText width="22ch" />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <Block title={t('users.card.profile')}>
        <KeyValueList
          columns={2}
          items={[t('users.card.phone'), t('users.card.language'), t('users.card.registered'), t('users.card.lastLogin'), t('users.card.sessions')].map((label, i) => ({
            label,
            value: <SkeletonText width={i % 2 ? '10ch' : '16ch'} />,
          }))}
        />
      </Block>
      <Block title={t('users.card.roles')}>{rows(1)}</Block>
      <Block title={t('users.card.bookings')}>{rows(3)}</Block>
    </div>
  );
}
