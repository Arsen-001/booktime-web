'use client';

/** Миниатюра материала в очереди: картинка, если есть, иначе значок вида (текст, услуга, диплом, жалоба). */
import Image from 'next/image';
import { FileBadge, Flag, ImageOff, ListPlus, MessageSquare, Type } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ModerationKind } from '@/domain/platform';
import { cn } from '@/lib/cn';

const KIND_ICON: Record<ModerationKind, ReactNode> = {
  staffPhoto: <ImageOff aria-hidden />,
  salonPhoto: <ImageOff aria-hidden />,
  servicePhoto: <ImageOff aria-hidden />,
  story: <ImageOff aria-hidden />,
  service: <ListPlus aria-hidden />,
  text: <Type aria-hidden />,
  diploma: <FileBadge aria-hidden />,
  complaint: <Flag aria-hidden />,
  review: <MessageSquare aria-hidden />,
};

export function ModerationThumb({ kind, imageUrl, className }: { kind: ModerationKind; imageUrl?: string; className?: string }) {
  return (
    // Сторис — вертикальная (9:16) целиком внутри того же квадрата 56 px, остальное — квадратом: строка очереди одной
    // ширины и высоты при любом материале (и скелетон ей равен)
    <span className={cn('relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-muted [&_svg]:size-5', className)}>
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill sizes="56px" className={kind === 'story' ? 'object-contain' : 'object-cover'} unoptimized />
      ) : (
        KIND_ICON[kind]
      )}
    </span>
  );
}
