'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/ui/Card';

export interface HubTile {
  id: string;
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Слова-подсказки для поиска по настройкам (Н7): «часы работы» → Контакты */
  keywords?: string;
  badge?: ReactNode;
}

export interface SettingsHubGroupProps {
  title?: ReactNode;
  tiles: HubTile[];
  dataF?: string;
}

/** Группа хаба — заголовок + сетка плиток-ссылок (каждая плитка — карточка кабинета, не пункт меню) */
export function SettingsHubGroup({ title, tiles, dataF }: SettingsHubGroupProps) {
  if (tiles.length === 0) return null;
  return (
    <section data-f={dataF} className="flex flex-col gap-3">
      {title && <h2 className="text-lg leading-snug font-semibold tracking-tight text-fg">{title}</h2>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Card key={tile.id} href={tile.href} padding="md" className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-fg">{tile.title}</span>
                  {tile.badge}
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-muted">{tile.description}</span>
              </span>
              <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-muted" />
            </Card>
          );
        })}
      </div>
    </section>
  );
}
