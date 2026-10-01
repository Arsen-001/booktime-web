'use client';

/** Плитка обзора — ссылка в раздел: число, подпись, стрелка; видно, что нажимается. */
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/ui/Card';
import { SkeletonText } from '@/ui/Skeleton';

interface OverviewTileProps {
  href: string;
  label: string;
  value: number;
  hint?: string;
  icon: ReactNode;
  loading?: boolean;
  /** Требует действия — число акцентом */
  attention?: boolean;
}

export function OverviewTile({ href, label, value, hint, icon, loading, attention }: OverviewTileProps) {
  return (
    <Card interactive href={href} className="group flex min-h-32 flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text [&_svg]:size-[18px]">{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        {/* Скелетон — внутри того же элемента, что и число: высота строки та же, ничего не прыгает */}
        <span className={attention && value > 0 ? 'text-3xl font-semibold text-fg tabular-nums' : 'text-3xl font-semibold text-muted tabular-nums'}>
          {loading ? <SkeletonText width="2ch" /> : value}
        </span>
        <span className="flex items-center gap-0.5 text-sm text-muted transition-colors group-hover:text-primary-text">
          {hint}
          <ChevronRight aria-hidden className="size-4" />
        </span>
      </div>
    </Card>
  );
}
