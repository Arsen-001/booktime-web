'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/text';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<AvatarSize, string> = {
  xs: 'size-6 text-[0.625rem]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
};

/** Мягкий фон и рамка цвета мастера (токены chart-1..8); текст — основной, контраст AA в обеих темах */
const COLOR: Record<number, string> = {
  1: 'bg-chart-1/20 ring-chart-1/40',
  2: 'bg-chart-2/20 ring-chart-2/40',
  3: 'bg-chart-3/20 ring-chart-3/40',
  4: 'bg-chart-4/20 ring-chart-4/40',
  5: 'bg-chart-5/20 ring-chart-5/40',
  6: 'bg-chart-6/20 ring-chart-6/40',
  7: 'bg-chart-7/20 ring-chart-7/40',
  8: 'bg-chart-8/20 ring-chart-8/40',
};

function colorFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (hash % 8) + 1;
}

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  /** 1..8 → цвет chart-N; по умолчанию вычисляется из имени */
  colorIndex?: number;
  className?: string;
}

/** Аватар: фото или инициалы на мягком цветном фоне */
export function Avatar({ name, src, size = 'md', colorIndex, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const color = COLOR[colorIndex && colorIndex >= 1 && colorIndex <= 8 ? colorIndex : colorFromName(name)];
  const showImage = Boolean(src) && !failed;

  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-fg ring-1 select-none',
        SIZE[size],
        showImage ? 'bg-surface-2 ring-border' : color,
        className,
      )}
    >
      {showImage ? (
        // Локальные превью (data:/blob:) — next/image тут не нужен
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
          // Картинка могла сломаться ещё до гидратации — тогда onError уже не придёт
          ref={(el) => {
            if (el && el.complete && el.naturalWidth === 0) setFailed(true);
          }}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}
