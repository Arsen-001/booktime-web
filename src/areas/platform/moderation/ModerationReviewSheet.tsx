'use client';

/**
 * Проверка по одному: материал крупно, решение внизу у пальца. После «Одобрить»/«Отклонить» шторка сразу показывает
 * следующий материал («3 из 8») — одно нажатие на материал. На десктопе: A — одобрить, R — отклонить, ←/→ — соседний.
 */
import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CornerUpLeft, X } from 'lucide-react';
import { useLocale } from 'next-intl';
import { ModerationHistory } from '@/areas/platform/moderation/ModerationHistory';
import { ModerationPreview } from '@/areas/platform/moderation/ModerationPreview';
import { RejectReasonPicker } from '@/areas/platform/moderation/RejectReasonPicker';
import type { ModerationDecisions } from '@/areas/platform/moderation/useModerationDecisions';
import { MODERATION_TONE } from '@/areas/platform/lib/tones';
import type { Id, LocaleCode } from '@/domain/core';
import type { ModerationView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Accordion } from '@/ui/Accordion';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { KeyValueList } from '@/ui/KeyValueList';
import { Sheet } from '@/ui/Sheet';

interface ModerationReviewSheetProps {
  items: ModerationView[];
  openId: Id | null;
  onOpenId: (id: Id | null) => void;
  /** Решения экрана: строка в очереди рядом уходит той же анимацией */
  decisions: ModerationDecisions;
}

interface RejectDraft {
  id: Id;
  reasonId: Id;
  note: string;
  showError: boolean;
}

export function ModerationReviewSheet({ items: all, openId, onOpenId, decisions }: ModerationReviewSheetProps) {
  const t = useT('platform');
  const fmt = useFormat();
  const locale = useLocale() as LocaleCode;
  const [reject, setReject] = useState<RejectDraft | null>(null);

  // Уходящие (уже решённые, ещё гаснут в очереди) — не соседи и не в счёте «3 из 8»
  const items = all.filter((m) => m.id === openId || !decisions.leaving.has(m.id));
  const index = items.findIndex((m) => m.id === openId);
  const item = index >= 0 ? items[index] : undefined;
  const rejecting = Boolean(item && reject?.id === item.id);
  const neighbour = (dir: 1 | -1) => items[index + dir]?.id ?? null;
  // После решения строка уходит из списка — следующий материал тот, что был после текущего
  const nextAfterDecision = items[index + 1]?.id ?? items[index - 1]?.id ?? null;

  // Решение — и сразу следующий материал (строка в очереди уходит сама); не вышло — возвращаемся к этому
  const approve = async () => {
    if (!item || decisions.leaving.has(item.id)) return;
    const id = item.id;
    onOpenId(nextAfterDecision);
    if (!(await decisions.approve(id))) onOpenId(id);
  };
  const confirmReject = async () => {
    if (!item || !reject) return;
    if (!reject.reasonId) return setReject({ ...reject, showError: true });
    if (decisions.leaving.has(item.id)) return;
    const { id, paidCoins } = item;
    const { reasonId, note } = reject;
    setReject(null);
    onOpenId(nextAfterDecision);
    if (!(await decisions.reject(id, reasonId, note.trim() || undefined, paidCoins))) {
      onOpenId(id);
      setReject({ id, reasonId, note, showError: false });
    }
  };
  const startReject = () => item && setReject({ id: item.id, reasonId: '', note: '', showError: false });

  // Клавиши для проверки подряд на десктопе
  useEffect(() => {
    if (!item || item.status !== 'pending') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'a' || e.key === 'ф') void approve();
      else if ((e.key === 'r' || e.key === 'к') && !rejecting) startReject();
      else if (e.key === 'ArrowRight' && neighbour(1)) onOpenId(neighbour(1));
      else if (e.key === 'ArrowLeft' && neighbour(-1)) onOpenId(neighbour(-1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pending = item?.status === 'pending';
  const footer = !item ? null : pending ? (
    rejecting ? (
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setReject(null)}>
          {t('moderation.cancelReject')}
        </Button>
        <Button variant="danger" className="flex-[2]" onClick={confirmReject} loading={decisions.rejecting}>
          {t('moderation.reject')}
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 text-danger" leftIcon={<X aria-hidden />} onClick={startReject}>
            {t('moderation.reject')}
          </Button>
          <Button className="flex-[2]" leftIcon={<Check aria-hidden />} onClick={approve} loading={decisions.approving}>
            {t('moderation.approve')}
          </Button>
        </div>
        <p className="hidden text-center text-xs text-muted md:block">{t('moderation.keysHint')}</p>
      </div>
    )
  ) : item.status !== 'auto' ? (
    <Button variant="outline" fullWidth leftIcon={<CornerUpLeft aria-hidden />} onClick={() => decisions.reopen(item.id)} loading={decisions.reopening}>
      {t('moderation.reopen')}
    </Button>
  ) : null;

  return (
    <Sheet
      open={Boolean(item)}
      onOpenChange={(o) => {
        if (!o) {
          setReject(null);
          onOpenId(null);
        }
      }}
      title={item ? t(`moderation.kind.${item.kind}`) : t('moderation.detailsTitle')}
      description={item ? (pending ? t('moderation.position', { n: index + 1, total: items.length }) : item.businessName) : undefined}
      size="md"
      // Десктоп: очередь видна и нажимается рядом со шторкой (контекст не теряется); на телефоне шторка модальная
      modal={false}
      headerActions={
        items.length > 1 ? (
          <div className="flex gap-1">
            <IconButton icon={<ChevronLeft />} label={t('moderation.prev')} size="sm" disabled={!neighbour(-1)} onClick={() => onOpenId(neighbour(-1))} />
            <IconButton icon={<ChevronRight />} label={t('moderation.next')} size="sm" disabled={!neighbour(1)} onClick={() => onOpenId(neighbour(1))} />
          </div>
        ) : undefined
      }
      footer={footer}
    >
      {item && (
        <div data-f="F-00-170 F-00-179" className="flex flex-col gap-5">
          <ModerationPreview item={item} />
          {rejecting && reject ? (
            <RejectReasonPicker
              reasonId={reject.reasonId}
              note={reject.note}
              paidCoins={item.paidCoins}
              showError={reject.showError}
              onReasonChange={(reasonId) => setReject({ ...reject, reasonId, showError: false })}
              onNoteChange={(note) => setReject({ ...reject, note })}
            />
          ) : (
            <>
              {item.status === 'rejected' && (
                <div className="rounded-xl bg-danger-soft p-4 text-sm text-fg">
                  <p className="font-medium">{item.reasonLabel ? pickText(item.reasonLabel, locale) : t('moderation.eventKind.rejected')}</p>
                  {item.reasonNote && <p className="mt-1 text-muted">{item.reasonNote}</p>}
                </div>
              )}
              <KeyValueList
                items={[
                  { label: t('moderation.businessLabel'), value: item.businessName },
                  ...(item.label && item.kind !== 'service' ? [{ label: t('moderation.whoLabel'), value: item.label }] : []),
                  { label: t('moderation.submittedAt'), value: `${fmt.ago(item.submittedAt)}, ${fmt.time(item.submittedAt)}` },
                  {
                    label: t('moderation.statusLabel'),
                    value: (
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone={MODERATION_TONE[item.status]}>{t(`moderation.status.${item.status}`)}</Badge>
                        {item.source !== 'user' && <Badge tone="info">{t(`moderation.source.${item.source}`)}</Badge>}
                        {typeof item.paidCoins === 'number' && <Badge tone="warning">{t('moderation.paidBadge', { coins: item.paidCoins })}</Badge>}
                      </span>
                    ),
                  },
                ]}
              />
              <Accordion variant="plain" items={[{ id: 'history', title: t('moderation.history'), content: <ModerationHistory item={item} /> }]} />
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
