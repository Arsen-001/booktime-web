import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/ui/Card';
import { LinkButton } from '@/ui/Button';
import { SkeletonText } from '@/ui/Skeleton';

export type LoyaltyHubTileTone = 'primary' | 'accent' | 'success' | 'info';

const ICON_BG: Record<LoyaltyHubTileTone, string> = {
  primary: 'bg-primary-soft text-primary-text',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success',
  info: 'bg-info-soft text-info',
};

export interface LoyaltyHubTileProps {
  icon: ReactNode;
  tone: LoyaltyHubTileTone;
  title: string;
  text: string;
  href: string;
  loading: boolean;
  /** Крупное число-заголовок (F-06-001, ux-best-c1): «работает» видно с одного взгляда, не только текстом */
  headline?: string;
  captionTone: 'success' | 'muted';
  caption: string;
  actionLabel: string;
  actionVariant: 'primary' | 'outline';
}

/** Плитка направления программы лояльности в хабе — карточка со своим числом, а не только описанием */
export function LoyaltyHubTile({ icon, tone, title, text, href, loading, headline, captionTone, caption, actionLabel, actionVariant }: LoyaltyHubTileProps) {
  return (
    <Card padding="lg" className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5', ICON_BG[tone])}>{icon}</span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-[1.0625rem] leading-snug font-bold text-fg">{title}</h3>
          <p className="mt-0.5 text-sm leading-snug text-muted">{text}</p>
        </div>
      </div>

      <div className="flex-1">
        {/* Скелетон — те же две строки (число и подпись); место числа держится и без него — высота плитки не зависит от данных */}
        <p className={cn('num-headline text-fg', !loading && headline === undefined && 'invisible')} aria-hidden={!loading && headline === undefined ? true : undefined}>
          {loading ? <SkeletonText width="2ch" /> : (headline ?? '0')}
        </p>
        <p className={cn('mt-1 text-sm font-medium', captionTone === 'success' ? 'text-success' : 'text-muted')}>
          {loading ? <SkeletonText width="24ch" /> : caption}
        </p>
      </div>

      <LinkButton href={href} variant={actionVariant} fullWidth>
        {actionLabel}
      </LinkButton>
    </Card>
  );
}
