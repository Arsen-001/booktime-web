'use client';

/** Ссылка места (страница записи, сайт, Instagram, источник) — всегда в новой вкладке. */
import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

/** Ссылка из данных → адрес для новой вкладки: «@name» и «name» у Instagram, сайт без https:// */
export function prospectHref(kind: 'web' | 'instagram', raw: string): string {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (kind === 'instagram') return `https://instagram.com/${v.replace(/^@/, '').replace(/^instagram\.com\//i, '')}`;
  return `https://${v}`;
}

/** Короткая подпись ссылки — домен и путь без https:// и хвостового «/» */
export function shortUrl(raw: string): string {
  return raw.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

export function ProspectLink({ icon, label, href }: { icon: ReactNode; label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
    >
      <span className="text-muted [&_svg]:size-4">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-fg">{label}</span>
        <span className="truncate text-muted">{shortUrl(href)}</span>
      </span>
      <ExternalLink aria-hidden className="size-4 shrink-0 text-muted" />
    </a>
  );
}
