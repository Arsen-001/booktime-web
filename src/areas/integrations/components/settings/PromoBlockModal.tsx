'use client';

/** F-13-172: форма промоблока — лимиты знаков (заголовок 50, описание 220, кнопка 20), экраны показа. */
import { useState } from 'react';
import {
  emptyPromoBlockDraft,
  isValidPromoBlockDraft,
  PROMO_BLOCK_BUTTON_TEXT_MAX,
  PROMO_BLOCK_DESCRIPTION_MAX,
  PROMO_BLOCK_HEADLINE_MAX,
  PROMO_BLOCK_PLACEMENTS,
  type PromoBlockDraft,
  type PromoBlockPlacement,
} from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { Switch } from '@/ui/Switch';
import { Textarea } from '@/ui/Textarea';

export function PromoBlockModal({
  open,
  onOpenChange,
  initial,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PromoBlockDraft;
  submitting: boolean;
  onSubmit: (draft: PromoBlockDraft) => void;
}) {
  const t = useT('integrations');
  const [draft, setDraft] = useState<PromoBlockDraft>(
    initial ?? emptyPromoBlockDraft(),
  );

  const togglePlacement = (p: PromoBlockPlacement) => {
    setDraft((d) => ({
      ...d,
      placements: d.placements.includes(p)
        ? d.placements.filter((x) => x !== p)
        : [...d.placements, p],
    }));
  };

  const valid = isValidPromoBlockDraft(draft);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('app.settings.promo.addCta')}
      footer={
        <Button
          fullWidth
          disabled={!valid}
          loading={submitting}
          onClick={() => onSubmit(draft)}
        >
          {t('connect.confirm')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label={t('app.settings.promo.headlineLabel')}
          hint={t('app.settings.promo.headlineHint')}
        >
          <Input
            value={draft.headline}
            maxLength={PROMO_BLOCK_HEADLINE_MAX}
            onChange={(e) =>
              setDraft((d) => ({ ...d, headline: e.target.value }))
            }
          />
        </FormField>
        <FormField
          label={t('app.settings.promo.descriptionLabel')}
          hint={t('app.settings.promo.descriptionHint')}
        >
          <Textarea
            value={draft.description}
            maxLength={PROMO_BLOCK_DESCRIPTION_MAX}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
          />
        </FormField>
        <Switch
          checked={draft.hasImage}
          onCheckedChange={(v) => setDraft((d) => ({ ...d, hasImage: v }))}
          label={t('app.settings.promo.hasImageLabel')}
        />
        <FormField
          label={t('app.settings.promo.buttonTextLabel')}
          hint={t('app.settings.promo.buttonTextHint')}
        >
          <Input
            value={draft.buttonText}
            maxLength={PROMO_BLOCK_BUTTON_TEXT_MAX}
            onChange={(e) =>
              setDraft((d) => ({ ...d, buttonText: e.target.value }))
            }
          />
        </FormField>
        {draft.buttonText.trim() && (
          <FormField label={t('app.settings.promo.buttonHrefLabel')}>
            <Input
              value={draft.buttonHref}
              onChange={(e) =>
                setDraft((d) => ({ ...d, buttonHref: e.target.value }))
              }
            />
          </FormField>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-fg">
            {t('app.settings.promo.placementsLabel')}
          </p>
          <div className="flex flex-col gap-1">
            {PROMO_BLOCK_PLACEMENTS.map((p) => (
              <Checkbox
                key={p}
                checked={draft.placements.includes(p)}
                onCheckedChange={() => togglePlacement(p)}
                label={t(`app.settings.promo.placements.${p}` as never)}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
