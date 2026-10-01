'use client';

/**
 * /biz/loyalty/promotions — список акций (F-06-031) с обязательной цепочкой F-06-004: без типа карты
 * акцию завести нельзя, экран показывает подсказку и ведёт создавать тип. Создание — мастер
 * /biz/loyalty/promotions/new (F-06-032…F-06-047), правка/удаление — /biz/loyalty/promotions/[id]
 * (F-06-050).
 *
 * Л14 (27.09.2026): таблица на всю ширину — вид, размер, срок, статус и типы карт видны без захода в акцию.
 */
import { Percent, Plus } from 'lucide-react';
import { getReferralSettings, listCardTypes, listPromotions } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import { BadgeSkeleton } from '@/areas/loyalty/components/Skeletons';
import { useCurrent } from '@/demo/hooks';
import { isPromotionActiveNow, type Promotion } from '@/domain/loyalty';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { LinkButton } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { Table, type TableColumn } from '@/ui/Table';

type PromoStatus = 'active' | 'scheduled' | 'paused' | 'ended' | 'noCards';

const STATUS_TONE: Record<PromoStatus, BadgeTone> = {
  active: 'success',
  scheduled: 'info',
  paused: 'warning',
  ended: 'neutral',
  noCards: 'warning',
};

/** Статус сегодня: кончилась / ещё не началась / без типов карт никому не применится / вне часов — пауза */
function promoStatus(p: Promotion, referralIds: Set<string>, now: Date, todayIso: string): PromoStatus {
  if (p.validTo && p.validTo < todayIso) return 'ended';
  if (p.validFrom && p.validFrom > todayIso) return 'scheduled';
  if (p.cardTypeIds.length === 0 && !referralIds.has(p.id)) return 'noCards';
  return isPromotionActiveNow(p, now) ? 'active' : 'paused';
}

export function PromotionsScreen() {
  const t = useT('loyalty');
  const format = useFormat();
  const { ready, businessId } = useCurrent();

  const typesQ = useApiQuery(['loyalty', 'cardTypes', businessId], () => listCardTypes(businessId!), { enabled: ready && Boolean(businessId) });
  const promosQ = useApiQuery(['loyalty', 'promotions', businessId], () => listPromotions(businessId!), {
    enabled: ready && Boolean(businessId) && Boolean(typesQ.data?.length),
  });
  const referralQ = useApiQuery(['loyalty', 'referral', businessId], () => getReferralSettings(businessId!), { enabled: ready && Boolean(businessId) });

  if (typesQ.isError) return <ErrorState onRetry={typesQ.refetch} />;

  const hasCardTypes = Boolean(typesQ.data?.length);
  const typeName = new Map((typesQ.data ?? []).map((ct) => [ct.id, ct.name]));
  const now = new Date();
  const todayIso = today();
  // рефералке тип карты не нужен (F-06-082) — такая акция без карт работает, а не «никому»
  const referralIds = new Set([referralQ.data?.inviteePromotionId, referralQ.data?.referrerPromotionId].filter((id): id is string => Boolean(id)));

  const valueOf = (p: Promotion): string => {
    const money = (v: number) => (p.valueType === 'percent' ? `${v}%` : format.money(v));
    if (p.thresholds?.length) {
      const values = p.thresholds.map((th) => th.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      return min === max ? money(max) : t('promotions.valueRange', { from: money(min), to: money(max) });
    }
    return money(p.value);
  };

  const periodOf = (p: Promotion): string => {
    if (p.validFrom && p.validTo) return `${format.date(p.validFrom, 'short')} – ${format.date(p.validTo, 'short')}`;
    if (p.validFrom) return t('promotions.periodFrom', { date: format.date(p.validFrom, 'short') });
    if (p.validTo) return t('promotions.periodTo', { date: format.date(p.validTo, 'short') });
    return t('promotions.periodAlways');
  };

  const columns: TableColumn<Promotion>[] = [
    {
      id: 'name',
      header: t('promotions.columns.name'),
      mobile: 'title',
      sortable: true,
      sortValue: (p) => p.name,
      width: '16rem',
      skeletonWidth: '16ch',
      cell: (p) => <span className="block max-w-[14rem] truncate font-medium text-fg">{p.name}</span>,
    },
    {
      id: 'kind',
      header: t('promotions.columns.kind'),
      mobile: 'subtitle',
      width: '13rem',
      skeleton: <BadgeSkeleton width="12ch" />,
      cell: (p) => <Badge tone={p.kind.startsWith('discount') ? 'primary' : 'accent'}>{t(`promotions.kinds.${p.kind}`)}</Badge>,
    },
    {
      id: 'value',
      header: t('promotions.columns.value'),
      mobile: 'meta',
      align: 'right',
      width: '8rem',
      skeletonWidth: '4ch',
      cell: (p) => <span className="whitespace-nowrap tabular-nums text-fg">{valueOf(p)}</span>,
    },
    {
      id: 'period',
      header: t('promotions.columns.period'),
      mobile: 'meta',
      width: '11rem',
      skeletonWidth: '10ch',
      cell: (p) => <span className="whitespace-nowrap text-muted">{periodOf(p)}</span>,
    },
    {
      id: 'status',
      header: t('promotions.columns.status'),
      mobile: 'badge',
      width: '9rem',
      skeleton: <BadgeSkeleton width="8ch" />,
      cell: (p) => {
        const status = promoStatus(p, referralIds, now, todayIso);
        return <Badge tone={STATUS_TONE[status]}>{t(`promotions.status.${status}`)}</Badge>;
      },
    },
    {
      id: 'cardTypes',
      header: t('promotions.columns.cardTypes'),
      mobile: 'meta',
      skeletonWidth: '14ch',
      cell: (p) =>
        p.cardTypeIds.length === 0 ? (
          <span className="text-muted">{referralIds.has(p.id) ? t('promotions.referralOnly') : t('promotions.noCardTypes')}</span>
        ) : (
          <span className="text-fg">
            {p.cardTypeIds
              .map((id) => typeName.get(id) ?? '')
              .filter(Boolean)
              .join(', ')}
          </span>
        ),
    },
  ];

  return (
    <div data-f="F-06-004 F-06-031" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('promotions.title')}
        description={t('promotions.subtitle')}
        actions={
          // Пока типы карт грузятся — кнопка уже на месте (aria-disabled): пришли данные — ничего не появилось из пустоты
          hasCardTypes || typesQ.isLoading ? (
            <LinkButton href="/biz/loyalty/promotions/new" leftIcon={<Plus aria-hidden />} aria-disabled={typesQ.isLoading || undefined}>
              {t('promotions.add')}
            </LinkButton>
          ) : undefined
        }
      />

      {!typesQ.isLoading && !hasCardTypes ? (
        <EmptyState
          icon={<Percent aria-hidden />}
          title={t('promotions.needCardTypeTitle')}
          description={t('promotions.needCardTypeText')}
          action={
            <LinkButton href="/biz/loyalty/card-types/new" leftIcon={<Plus aria-hidden />}>
              {t('cardTypes.add')}
            </LinkButton>
          }
        />
      ) : promosQ.isError ? (
        <ErrorState onRetry={promosQ.refetch} />
      ) : (
        <Table
          label={t('promotions.title')}
          columns={columns}
          rows={promosQ.data ?? []}
          rowKey={(p) => p.id}
          loading={typesQ.isLoading || promosQ.isLoading}
          loadingRows={1}
          rowHref={(p) => `/biz/loyalty/promotions/${p.id}`}
          empty={
            <EmptyState
              icon={<Percent aria-hidden />}
              title={t('promotions.emptyTitle')}
              action={
                <LinkButton href="/biz/loyalty/promotions/new" leftIcon={<Plus aria-hidden />}>
                  {t('promotions.add')}
                </LinkButton>
              }
            />
          }
        />
      )}
    </div>
  );
}
