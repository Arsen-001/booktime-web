'use client';

/**
 * F-00-174: текст мастера (описание места, «о мастере», описание услуги), у которого не заполнен en,
 * показывается клиенту в псевдо-переводе с пометкой «переведено автоматически» и кнопкой
 * «показать оригинал». Если мастер поправил перевод (translationOverrides в срезе client) — клиент
 * видит исправленный текст без пометки «автоперевод» (но с той же возможностью открыть оригинал).
 */
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { getTranslationOverride } from '@/api/client';
import { useApiQuery } from '@/api/request';
import type { Id, LocalizedText } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pseudoTranslateToEn } from '@/areas/client/translate';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';

export function AutoTranslatedText({
  text,
  owner,
  ownerId,
  field,
  className,
}: {
  text: LocalizedText | undefined;
  owner: 'staff' | 'business' | 'service';
  ownerId: Id;
  field: string;
  className?: string;
}) {
  const t = useT('client');
  const locale = useLocale();
  const [showOriginal, setShowOriginal] = useState(false);
  const overrideQ = useApiQuery(
    ['translation-override', owner, ownerId, field],
    () => getTranslationOverride(owner, ownerId, field),
    { enabled: locale !== 'ru' && Boolean(text?.ru) },
  );

  if (!text?.ru) return null;

  // Есть готовый текст на языке клиента (заполнен вручную) — показываем его как есть, автоперевода нет
  if (locale === 'ru' || text[locale as 'en']?.trim()) {
    return <p className={className}>{text[locale as 'en'] ?? text.ru}</p>;
  }

  const override = overrideQ.data;
  const display = showOriginal ? text.ru : (override ?? pseudoTranslateToEn(text.ru));

  return (
    <div className={className}>
      <p>{display}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {!showOriginal && (
          <Badge tone="neutral" variant="soft" className="gap-1">
            <Languages aria-hidden className="size-3" />
            {t('translation.autoTranslatedNote')}
          </Badge>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowOriginal((v) => !v)} className="h-auto px-1.5 py-0.5 text-xs">
          {showOriginal ? t('translation.showTranslation') : t('translation.showOriginal')}
        </Button>
      </div>
    </div>
  );
}
