'use client';

/**
 * Вклад раздела «loyalty» в профиль клиента в приложении (хост «clientProfile», F-06-158/162
 * «Абонементы, сертификаты и лояльность в Altegio.me»): по каждому бизнесу, где у клиента есть карта,
 * абонемент или сертификат — остаток/срок/номер и кнопка «Записаться» (переход к тому бизнесу).
 *
 * F-06-156/157 «Кэшбэк в профиле + экран деталей»: сумма баланса бонусных карт бизнеса — плиткой
 * сверху; «Детали» разворачивает карту и показывает её операции (те же данные, что видит бизнес в
 * `getCard`, просто без действий редактирования). Экран «Главная» приложения (часть F-06-156 про
 * ГЛАВНУЮ, не профиль) — путь `client`, не мой; см. qa/requests/loyalty.md.
 *
 * F-06-159/160 «Продление и напоминание об окончании абонемента»: у абонемента, которому пора
 * продлеваться (`expiringSoon`, порог берётся из настройки типа F-06-118/119 — уже построена),
 * бейдж-предупреждение и кнопка «Продлить» на страницу бизнеса, где абонемент покупается/продлевается
 * онлайн (F-06-149/151, уже готовая продажа).
 *
 * F-06-189 «Altegio.me — интеграция в категории «Лояльность»»: ⭐ по нашему решению приложение клиента —
 * часть продукта (F-00-001), отдельной «интеграции» и кнопки «Подключить»/«Отключить» нет — этот же
 * компонент и есть то, что у Altegio требует отдельного приложения; клиент видит лояльность салона без
 * каких-либо действий бизнеса по подключению. F-06-192 (FireBrands, партнёрская музыка) снят по тому же
 * решению — интеграция не наша (Украина-only, партнёр для Армении не определён), см. qa/requests/loyalty.md.
 *
 * Файл принадлежит разделу «loyalty». Посмотреть вклад без хозяина хоста: /dev/ext/clientProfile/loyalty
 */
import { useState } from 'react';
import { ChevronDown, CreditCard, Gift, TriangleAlert, Wallet } from 'lucide-react';
import { getCard, listMyLoyalty, type LoyaltyCardDetail, type MyLoyaltyBusiness } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import type { CertificateStatus, MembershipStatus } from '@/domain/loyalty';
import type { ClientProfileExtProps } from '@/extensions/types';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';

const CERT_TONE: Record<CertificateStatus, BadgeTone> = { active: 'success', used: 'neutral', expired: 'danger' };
const MEM_TONE: Record<MembershipStatus, BadgeTone> = { issued: 'info', active: 'success', frozen: 'warning', used: 'neutral', expired: 'danger', deactivated: 'neutral' };

/** F-06-157: развёрнутая карта — операции кэшбэка (начисления/списания), businessId уже известен из карточки бизнеса */
function CashbackCardDetails({ businessId, cardId }: { businessId: Id; cardId: Id }) {
  const t = useT('loyalty');
  const format = useFormat();
  const q = useApiQuery(['loyalty', 'card', businessId, cardId], () => getCard(businessId, cardId));
  if (q.isLoading) return <Skeleton lines={2} />;
  if (q.isError || !q.data) return <ErrorState compact onRetry={() => q.refetch()} />;
  const detail: LoyaltyCardDetail = q.data;
  if (detail.transactions.length === 0) return <p className="text-sm text-muted">{t('cardDetail.noTransactions')}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {detail.transactions.map((tx) => (
        <li key={tx.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 flex-1 truncate text-muted">
            {format.date(tx.createdAt)} · {t(`transactions.types.${tx.type}`)}
          </span>
          <span className={tx.amount < 0 ? 'font-semibold text-danger' : 'font-semibold text-success'}>
            {tx.amount > 0 ? '+' : ''}
            {format.money(tx.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function BusinessLoyaltyCard({ business }: { business: MyLoyaltyBusiness }) {
  const t = useT('loyalty');
  const format = useFormat();
  const [expandedCardId, setExpandedCardId] = useState<Id | null>(null);

  return (
    <SectionCard title={business.businessName} padding="sm">
      <div className="flex flex-col gap-2">
        {business.cashbackTotal > 0 && (
          <div data-f="F-06-156" className="grid grid-cols-1 gap-2">
            <StatCard label={t('profile.cashbackTotal')} value={format.money(business.cashbackTotal)} />
          </div>
        )}
        {business.cards.map((c) => {
          const isExpanded = expandedCardId === c.id;
          return (
            <div key={c.id} data-f="F-06-157" className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => setExpandedCardId(isExpanded ? null : c.id)}
                aria-expanded={isExpanded}
              >
                <Wallet aria-hidden className="size-4 shrink-0 text-primary-text" />
                <span className="min-w-0 flex-1 truncate text-fg">
                  {c.cardTypeName} · № {c.number}
                </span>
                <span className="shrink-0 font-semibold text-fg">{format.money(c.balance)}</span>
                <ChevronDown aria-hidden className={`size-4 shrink-0 text-muted ${isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'}`} />
              </button>
              {isExpanded && (
                <div className="border-t border-border pt-2">
                  <CashbackCardDetails businessId={business.businessId} cardId={c.id} />
                </div>
              )}
            </div>
          );
        })}
        {business.memberships.map((m) => (
          <div key={m.id} className="flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <CreditCard aria-hidden className="size-4 shrink-0 text-primary-text" />
              <span className="min-w-0 flex-1 truncate text-fg">
                {m.typeName} · {t('profile.visitsLeft', { balance: m.balanceVisits, total: m.totalVisits })} · {t('profile.until', { date: format.date(m.expiresAt) })}
              </span>
              <Badge tone={MEM_TONE[m.status]}>{t(`memberships.status.${m.status}`)}</Badge>
            </div>
            {m.expiringSoon && (
              <div data-f="F-06-160" className="flex flex-wrap items-center gap-2 rounded-lg bg-warning-soft px-2 py-1.5 text-xs text-warning-strong">
                <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                <span className="flex-1">{t('profile.membershipExpiringSoon')}</span>
                {business.businessSlug && (
                  <LinkButton data-f="F-06-159" href={`/b/${business.businessSlug}`} variant="outline" size="sm">
                    {t('profile.renewMembership')}
                  </LinkButton>
                )}
              </div>
            )}
          </div>
        ))}
        {business.certificates.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <Gift aria-hidden className="size-4 shrink-0 text-primary-text" />
            <span className="min-w-0 flex-1 truncate text-fg">
              {c.typeName} · {format.money(c.balance)} / {format.money(c.nominal)}
              {c.expiresAt ? ` · ${t('profile.until', { date: format.date(c.expiresAt) })}` : ''}
            </span>
            <Badge tone={CERT_TONE[c.status]}>{t(`certificates.status.${c.status}`)}</Badge>
          </div>
        ))}
        {business.businessSlug && (
          <LinkButton href={`/b/${business.businessSlug}`} variant="outline" size="sm" className="self-start">
            {t('profile.bookAgain')}
          </LinkButton>
        )}
      </div>
    </SectionCard>
  );
}

export default function LoyaltyClientProfile({ appUserId }: ClientProfileExtProps) {
  const t = useT('loyalty');
  const q = useApiQuery(['loyalty', 'myLoyalty', appUserId], () => listMyLoyalty(appUserId));

  if (q.isError) return <ErrorState compact onRetry={() => q.refetch()} />;
  if (q.isLoading) {
    // Скелетон — та же карточка бизнеса: название, строка карты/абонемента и «Записаться снова»
    return (
      <div className="flex flex-col gap-3" aria-hidden>
        <SectionCard title={<SkeletonText width="16ch" />} padding="sm">
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-fg">
                  <SkeletonText width={i ? '26ch' : '20ch'} />
                </span>
                <span className="shrink-0 font-semibold text-fg">
                  <SkeletonText width="7ch" />
                </span>
              </div>
            ))}
            <LinkButton href="/" variant="outline" size="sm" className="pointer-events-none self-start" tabIndex={-1}>
              {t('profile.bookAgain')}
            </LinkButton>
          </div>
        </SectionCard>
      </div>
    );
  }
  const businesses = q.data ?? [];
  if (businesses.length === 0) return <EmptyState compact icon={<Wallet aria-hidden />} title={t('profile.empty')} />;

  return (
    <div data-f="F-06-158 F-06-162 F-06-189" className="flex flex-col gap-3">
      {businesses.map((b) => (
        <BusinessLoyaltyCard key={b.businessId} business={b} />
      ))}
    </div>
  );
}
