'use client';

/** Что проверяем — крупно: картинка во всю ширину, текст с подсвеченными контактами и ссылками, услуга, диплом. */
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import type { ModerationView } from '@/domain/platform';
import { cn } from '@/lib/cn';
import { HighlightedText } from '@/areas/platform/moderation/HighlightedText';
import { useT } from '@/i18n/useT';

export function ModerationPreview({ item }: { item: ModerationView }) {
  const t = useT('platform');
  const needsImage = item.kind !== 'text' && item.kind !== 'service' && item.kind !== 'review';
  // Сторис — 1080×1920: показываем в её пропорциях целиком (в рамке 4:3 она была узкой полоской), не выше экрана
  const frame = item.kind === 'story' ? 'mx-auto aspect-[9/16] w-full max-w-[min(100%,calc(60dvh*9/16))]' : 'aspect-[4/3] w-full';
  return (
    <div className="flex flex-col gap-3">
      {needsImage &&
        (item.imageUrl ? (
          <div className={cn('relative overflow-hidden rounded-xl bg-surface-2', frame)}>
            <Image src={item.imageUrl} alt={t(`moderation.kind.${item.kind}`)} fill sizes="(min-width: 640px) 480px, 100vw" className="object-contain" unoptimized />
          </div>
        ) : (
          <div className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2 text-muted', frame)}>
            <ImageOff aria-hidden className="size-8" />
            <span className="text-sm">{item.kind === 'diploma' ? t('moderation.noScan') : t('moderation.noImage')}</span>
          </div>
        ))}
      {item.kind === 'service' && item.label && <p className="text-lg font-semibold text-fg">{item.label}</p>}
      {item.text && (
        <div className="rounded-xl bg-surface-2 p-4">
          <HighlightedText text={item.text} />
        </div>
      )}
    </div>
  );
}
