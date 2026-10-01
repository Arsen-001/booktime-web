'use client';

/** Карточка промокода: условия словами, кому и кем использован; «Отозвать» с «Отменить» в тосте. */
import { Ban } from 'lucide-react';
import { restorePromoCode, revokePromoCode } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { PromoCodeCell } from '@/areas/platform/promocodes/PromoCodeCell';
import { usePromoText } from '@/areas/platform/promocodes/promoText';
import { PROMO_TONE } from '@/areas/platform/lib/tones';
import { isPromoActive, type PromoView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { KeyValueList } from '@/ui/KeyValueList';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

export function PromoDetailSheet({ promo, onClose }: { promo: PromoView; onClose: () => void }) {
  const t = useT('platform');
  const fmt = useFormat();
  const toast = useToast();
  const text = usePromoText();
  const revoke = useApiMutation(revokePromoCode);
  const restore = useApiMutation(restorePromoCode);

  const doRevoke = async () => {
    try {
      await revoke.mutate(promo.id);
      toast.success(t('promocodes.revoked', { code: promo.code }), {
        action: { label: t('common.undo'), onClick: () => void restore.mutate(promo.id).catch(() => toast.error(t('promocodes.saveFailed'))) },
      });
      onClose();
    } catch {
      toast.error(t('promocodes.saveFailed'));
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('promocodes.detailTitle')}
      size="md"
      footer={
        isPromoActive(promo.status) ? (
          <Button fullWidth variant="outline" className="text-danger" leftIcon={<Ban aria-hidden />} onClick={doRevoke} loading={revoke.isPending}>
            {t('promocodes.revoke')}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-4">
          <PromoCodeCell code={promo.code} />
          <Badge tone={PROMO_TONE[promo.status]}>{t(`promocodes.status.${promo.status}`)}</Badge>
        </div>
        <KeyValueList
          items={[
            { label: t('promocodes.kind'), value: promo.kind === 'discount' ? t('promocodes.kindDiscount') : t('promocodes.kindFreeMonth') },
            { label: t('promocodes.terms'), value: text.terms(promo) },
            { label: t('promocodes.who'), value: text.who(promo) },
            ...(promo.usedAt ? [{ label: t('promocodes.usedLabel'), value: text.used(promo) }] : []),
            { label: t('promocodes.validUntil'), value: promo.validUntil ? fmt.date(promo.validUntil, 'long') : t('promocodes.noLimit') },
            { label: t('promocodes.createdLabel'), value: fmt.date(promo.createdAt, 'long') },
            ...(promo.note ? [{ label: t('promocodes.note'), value: promo.note }] : []),
          ]}
        />
      </div>
    </Sheet>
  );
}
