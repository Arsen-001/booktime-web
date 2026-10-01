'use client';

/**
 * «Для разработчиков» (F-15-119), карточка в «Настройки → Основные»: решение «дадим ли мы вебхуки» не принято
 * (00-decisions §11) — экран построен 1:1 с Altegio на моках, помечен «демо»: переключатель, адрес,
 * галочки сущностей сохраняются в своём срезе, ничего реально никуда не отправляется.
 * Н11 (27.09.2026): своей кнопки «Сохранить» нет — карточка часть формы «Системных», сохраняется общей кнопкой.
 */
import type { WebhookEntity } from '@/domain/settings';
import { WEBHOOK_ENTITIES } from '@/api/settings';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { Switch } from '@/ui/Switch';

export interface WebhookDraft {
  enabled: boolean;
  url: string;
  entities: WebhookEntity[];
}

export interface WebhookCardProps {
  value: WebhookDraft;
  onChange: (next: WebhookDraft) => void;
  canManage: boolean;
}

export function WebhookCard({ value, onChange, canManage }: WebhookCardProps) {
  const t = useT('settings');

  function toggleEntity(entity: WebhookEntity) {
    onChange({
      ...value,
      entities: value.entities.includes(entity)
        ? value.entities.filter((e) => e !== entity)
        : [...value.entities, entity],
    });
  }

  return (
    <div data-f="F-15-119">
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            {t('system.webhookTitle')}
            <Badge tone="neutral" size="sm">
              {t('system.webhookDemoBadge')}
            </Badge>
          </span>
        }
        description={t('system.webhookHint')}
      >
        <div className="flex flex-col gap-4">
          <Switch
            checked={value.enabled}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
            label={t('system.webhookEnabledLabel')}
            labelPosition="start"
            disabled={!canManage}
          />

          {value.enabled && (
            <>
              <FormField label={t('system.webhookUrlLabel')} hint={t('system.webhookUrlHint')}>
                <Input
                  value={value.url}
                  onChange={(e) => onChange({ ...value, url: e.target.value })}
                  placeholder="https://example.com/hooks/booking"
                  disabled={!canManage}
                />
              </FormField>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-fg">{t('system.webhookEntitiesLabel')}</span>
                {/* F-06-179: сущность «loyaltyEvents» в чек-листе ниже — fids.mjs не разбирает тернарник в data-f по key, статичная метка рядом */}
                <span hidden data-f="F-06-179" />
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {WEBHOOK_ENTITIES.map((entity) => (
                    <Checkbox
                      key={entity}
                      checked={value.entities.includes(entity)}
                      onCheckedChange={() => toggleEntity(entity)}
                      label={t(`system.webhookEntity.${entity}` as never)}
                      disabled={!canManage}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
