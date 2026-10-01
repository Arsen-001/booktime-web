'use client';

/**
 * /biz/clients/integrations — «Интеграции для клиентской базы» (третий проход k2, F-04-186, F-04-188,
 * F-04-189, F-04-191, F-04-193, F-04-209, F-04-210, F-04-224): ни одна из этих связей в проекте нигде не
 * подключена (все помечены 🔒 в ТЗ, партнёр не выбран — ANSWERS.md В-05: строим демо-экран на моках с
 * пометкой «демо», как и промо-панели чата/телефонии Altegio без подключения). Здесь — единая витрина
 * таких карточек: что каждая интеграция делает, что «У нас» решено (⭐) или ещё не решено (обсудить),
 * и кнопка «Подключить»/«Открыть». Статусы (И9, 28.09) — из listClientBaseIntegrations (раздел интеграций):
 * те же подключения, что на «Установлено», своей копии «не подключено» здесь больше нет; кнопка ведёт по href.
 * Готово, когда (по каждому пункту): экран описывает, что подключение даст, без обещания реальной связи —
 * настоящее подключение появится, когда решение о партнёре/маркетплейсе будет принято (F-00-041 и вывод по
 * F-04-191/193/224).
 */
import type { ReactNode } from 'react';
import { Bot, Cable, ExternalLink, Gift, MessageCircle, Phone, Webhook } from 'lucide-react';
import { listClientBaseIntegrations, type ClientBaseIntegration, type ClientBaseIntegrationKind } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';

interface IntegrationCard {
  id: ClientBaseIntegrationKind;
  fid: string;
  icon: ReactNode;
  titleKey: string;
  textKey: string;
  priceKey?: string;
}

// Литеральные метки для scripts/fids.mjs (регулярка ищет "data-f" со строкой в кавычках; ниже — не JSX-атрибут,
// а сама карточка отдаёт свой fid через `card.fid`, что как выражение регуляркой не читается):
// data-f="F-04-186" data-f="F-04-188" data-f="F-04-189" data-f="F-04-191" data-f="F-04-193"
// data-f="F-04-209" data-f="F-04-210" data-f="F-04-224"
const CARDS: IntegrationCard[] = [
  { id: 'chat', fid: 'F-04-186 F-04-187 F-04-188', icon: <MessageCircle aria-hidden />, titleKey: 'integrations.chat.title', textKey: 'integrations.chat.text', priceKey: 'integrations.chat.price' },
  { id: 'telephony', fid: 'F-04-189', icon: <Phone aria-hidden />, titleKey: 'integrations.telephony.title', textKey: 'integrations.telephony.text' },
  { id: 'crm', fid: 'F-04-191', icon: <Cable aria-hidden />, titleKey: 'integrations.crm.title', textKey: 'integrations.crm.text', priceKey: 'integrations.crm.price' },
  { id: 'bots', fid: 'F-04-193 F-04-224', icon: <Bot aria-hidden />, titleKey: 'integrations.bots.title', textKey: 'integrations.bots.text' },
  { id: 'calendar', fid: 'F-04-209', icon: <ExternalLink aria-hidden />, titleKey: 'integrations.calendar.title', textKey: 'integrations.calendar.text' },
  { id: 'webhook', fid: 'F-04-210', icon: <Webhook aria-hidden />, titleKey: 'integrations.webhook.title', textKey: 'integrations.webhook.text' },
];

const STATUS_TONE: Record<ClientBaseIntegration['status'], BadgeTone> = { connected: 'success', pending: 'warning', none: 'neutral' };
const STATUS_KEY: Record<ClientBaseIntegration['status'], string> = {
  connected: 'integrations.connected',
  pending: 'integrations.pending',
  none: 'integrations.notConnected',
};

export function IntegrationsScreen() {
  const t = useT('clients');
  const canManage = useCan('clients.edit');
  const { ready, businessId, locationIds } = useCurrent();
  const q = useApiQuery(['integrations', 'clientBase', businessId, locationIds], () => listClientBaseIntegrations(businessId!, locationIds), {
    enabled: ready && !!businessId,
  });
  const byKind = new Map((q.data ?? []).map((row) => [row.kind, row]));

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('integrations.title')} description={t('integrations.description')} />
      {q.isError && !q.data ? (
        <ErrorState description={t('integrations.loadFailed')} onRetry={q.refetch} />
      ) : (
        <div className="flex flex-col gap-3">
          {CARDS.map((card) => {
            const row = byKind.get(card.id);
            return (
              <div key={card.id} data-f={card.fid} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-muted [&_svg]:size-5">{card.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-fg">{t(card.titleKey as never)}</p>
                      {row ? (
                        <Badge tone={STATUS_TONE[row.status]}>{t(STATUS_KEY[row.status] as never)}</Badge>
                      ) : (
                        // Та же плашка статуса, пока статусы читаются
                        <Badge tone="neutral">
                          <SkeletonText width="11ch" />
                        </Badge>
                      )}
                      {row?.appName && <span className="text-sm text-muted">{t('integrations.via', { app: row.appName })}</span>}
                    </div>
                    <p className="mt-1 text-sm text-muted">{t(card.textKey as never)}</p>
                    {card.priceKey && <p className="mt-1 text-xs text-muted">{t(card.priceKey as never)}</p>}
                  </div>
                  {/* Кнопка одной ширины и до загрузки, и с любой подписью — текст карточки не переносится иначе */}
                  {canManage &&
                    (row ? (
                      <LinkButton href={row.href} size="sm" variant="outline" className="min-w-[7.5rem] shrink-0">
                        {row.status === 'none' ? t('integrations.connect') : t('integrations.open')}
                      </LinkButton>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="min-w-[7.5rem] shrink-0">
                        <SkeletonText width="8ch" />
                      </Button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div data-f="F-04-215 F-04-216" className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4">
        <Gift aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
        <p className="text-sm text-muted">{t('integrations.appClientNote')}</p>
      </div>
    </div>
  );
}
