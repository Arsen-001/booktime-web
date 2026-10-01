'use client';

/**
 * /biz/loyalty — хаб раздела (F-06-001, F-06-002). Витрина четырёх направлений программы лояльности +
 * обращение в поддержку (F-06-001 «Помогите мне настроить» → наша очередь поддержки, F-00-182).
 */
import { useState } from 'react';
import { CreditCard, Gift, LifeBuoy, Ticket, Wallet } from 'lucide-react';
import { getLoyaltyHubOverview, type LoyaltyHubTileOverview } from '@/api/loyalty';
import { createSupportTicket } from '@/api/platform/support';
import { useApiMutation, useApiQuery } from '@/api/request';
import { LoyaltyCostBlock } from '@/areas/loyalty/components/LoyaltyCostBlock';
import { LoyaltyHubTile, type LoyaltyHubTileTone } from '@/areas/loyalty/components/LoyaltyHubTile';
import { useCurrent, useDemo } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

interface Tile {
  id: 'cards' | 'certificates' | 'memberships' | 'deposits';
  icon: React.ReactNode;
  tone: LoyaltyHubTileTone;
  href: string;
  title: string;
  text: string;
}

export function LoyaltyHubScreen() {
  const t = useT('loyalty');
  const toast = useToast();
  const format = useFormat();
  const { persona } = useDemo();
  const { businessId, ready } = useCurrent();
  const [askedHelp, setAskedHelp] = useState(false);

  // F-06-001 (ux-best-c1 №1, ux-best-c3 №1): каждая плитка раньше звала «Настроить», даже когда уже
  // работает — владелец не видел, что уже продано 6 сертификатов. Отдельный лёгкий запрос под хаб.
  const overviewQ = useApiQuery(['loyalty', 'hubOverview', businessId], () => getLoyaltyHubOverview(businessId!), { enabled: ready && Boolean(businessId) });

  const tiles: Tile[] = [
    { id: 'cards', icon: <CreditCard aria-hidden />, tone: 'primary', href: '/biz/loyalty/card-types', title: t('hub.tiles.cards.title'), text: t('hub.tiles.cards.text') },
    { id: 'certificates', icon: <Ticket aria-hidden />, tone: 'accent', href: '/biz/loyalty/certificates/types', title: t('hub.tiles.certificates.title'), text: t('hub.tiles.certificates.text') },
    { id: 'memberships', icon: <Gift aria-hidden />, tone: 'success', href: '/biz/loyalty/memberships/types', title: t('hub.tiles.memberships.title'), text: t('hub.tiles.memberships.text') },
    { id: 'deposits', icon: <Wallet aria-hidden />, tone: 'info', href: '/biz/loyalty/deposits/types', title: t('hub.tiles.deposits.title'), text: t('hub.tiles.deposits.text') },
  ];

  // F-06-001 (ux-best-c1 №1): число «работает» — заголовок плитки, а не мелкий текст в подвале
  const statusOf = (tileId: Tile['id']): { headline?: string; caption: string; working: boolean; configured: boolean } | undefined => {
    const o: LoyaltyHubTileOverview | undefined = overviewQ.data?.[tileId];
    if (!o) return undefined;
    if (!o.hasTypes) return { caption: t('hub.status.notConfigured'), working: false, configured: false };
    if (o.count === 0) return { headline: '0', caption: t('hub.status.empty'), working: false, configured: true };
    if (tileId === 'cards') return { headline: String(o.count), caption: t('hub.status.cardsWorking', { count: o.count }), working: true, configured: true };
    if (tileId === 'certificates') return { headline: String(o.count), caption: t('hub.status.certificatesWorking', { count: o.count, sum: format.money(o.sum ?? 0) }), working: true, configured: true };
    if (tileId === 'memberships') return { headline: String(o.count), caption: t('hub.status.membershipsWorking', { count: o.count, sum: format.money(o.sum ?? 0) }), working: true, configured: true };
    return { headline: String(o.count), caption: t('hub.status.depositsWorking', { count: o.count, sum: format.money(o.sum ?? 0) }), working: true, configured: true };
  };

  const askHelp = useApiMutation(() =>
    createSupportTicket({
      from: 'business',
      businessId,
      name: t('hub.supportTicketName'),
      channel: 'cabinet',
      section: 'settings',
      topic: 'help',
      text: t('hub.supportTicketText'),
    }),
  );

  const submitHelp = async () => {
    try {
      await askHelp.mutate(undefined);
      setAskedHelp(true);
      toast.success(t('hub.helpSent'));
    } catch {
      toast.error(t('hub.helpFailed'));
    }
  };

  {/* demo-q4 minor: на одном адресе это ничего не говорит владельцу — показываем только сети */}
  const networkNote = persona === 'network' ? t('hub.networkScope') : undefined;

  return (
    <div data-f="F-06-001 F-06-002 F-06-003" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('hub.title')}
        description={t('hub.subtitle')}
        meta={networkNote ? <span className="text-xs text-muted">{networkNote}</span> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tiles.map((tile) => {
          const status = statusOf(tile.id);
          return (
            <LoyaltyHubTile
              key={tile.id}
              icon={tile.icon}
              tone={tile.tone}
              title={tile.title}
              text={tile.text}
              href={tile.href}
              loading={overviewQ.isLoading}
              headline={status?.headline}
              captionTone={status?.working ? 'success' : 'muted'}
              caption={status?.caption ?? ''}
              actionVariant={status && !status.configured ? 'primary' : 'outline'}
              actionLabel={status?.working ? t('hub.tiles.open') : t('hub.tiles.configure')}
            />
          );
        })}
      </div>

      <LoyaltyCostBlock businessId={ready ? businessId : undefined} />

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <LifeBuoy aria-hidden className="size-5 text-muted" />
            {t('hub.helpTitle')}
          </span>
        }
        description={t('hub.helpText')}
        footer={
          <Button onClick={submitHelp} loading={askHelp.isPending} disabled={askedHelp || !ready}>
            {askedHelp ? t('hub.helpSentButton') : t('hub.helpButton')}
          </Button>
        }
      />
    </div>
  );
}
