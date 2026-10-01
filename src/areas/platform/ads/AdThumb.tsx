'use client';

/** Миниатюра объявления в пропорциях баннера; без картинки — значок места. */
import Image from 'next/image';
import { Megaphone } from 'lucide-react';
import { cn } from '@/lib/cn';

export function AdThumb({ imageUrl, className }: { imageUrl?: string; className?: string }) {
  return (
    <span className={cn('relative flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-muted [&_svg]:size-5', className)}>
      {imageUrl ? <Image src={imageUrl} alt="" fill sizes="64px" className="object-cover" unoptimized /> : <Megaphone aria-hidden />}
    </span>
  );
}
