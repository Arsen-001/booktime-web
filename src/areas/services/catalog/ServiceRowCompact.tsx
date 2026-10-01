'use client';

/**
 * Строка услуги на телефоне и узком экране (У6, У8): одна строка названия, под ней «цена · длительность · N мастеров»,
 * плашки только для исключений — «Не онлайн», «Нет мастеров». Остальные правки — в «⋯»: онлайн, перерыв (У9).
 */
import { memo } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Check, Globe, GlobeLock, MoreHorizontal, Pencil, Trash2, UserX } from 'lucide-react';
import type { DropdownMenuItem } from '@/ui/DropdownMenu';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { formatMoneyRange } from '@/lib/money';
import { pickText } from '@/lib/text';
import { TECH_BREAK_MINUTES, techBreakFromValue, techBreakValue } from '@/areas/services/components/techBreak';
import { sameRowProps, type ServiceRowProps } from '@/areas/services/catalog/ServiceRowTable';
import { Badge } from '@/ui/Badge';
import { Checkbox } from '@/ui/Checkbox';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';

function ServiceRowCompactImpl({ row, selected, onSelect, canEdit, actions }: ServiceRowProps) {
  const t = useT('services');
  const format = useFormat();
  const locale = useLocale() as 'ru' | 'en';
  const s = row.service;
  const name = pickText(s.name, locale);
  const tb = techBreakValue(s.bufferAfterMin);
  const meta = [
    format.durationRange(s.durationMin, s.durationMax),
    s.staffIds.length ? t('list.staffCount', { count: s.staffIds.length }) : null,
    s.bufferAfterMin ? t('techBreak.plus', { n: s.bufferAfterMin }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const tbItem = (value: string, label: string): DropdownMenuItem => ({
    id: `tb-${value}`,
    label,
    icon: <Check aria-hidden className={tb === value ? 'size-4' : 'invisible size-4'} />,
    onSelect: () => void actions.patch(s.id, { bufferAfterMin: techBreakFromValue(value) }),
  });

  return (
    <>
      {canEdit && (
        <span className="flex size-9 shrink-0 items-center justify-center">
          <Checkbox checked={selected} onCheckedChange={(on) => onSelect(s.id, on)} aria-label={t('list.select', { name })} />
        </span>
      )}
      <Link href={`/biz/services/${s.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
        {/* Строка всегда в две строки текста (длинное — многоточием, плашки не переносятся): высота строки
            не зависит от данных, скелетон каталога той же высоты */}
        <span className="truncate font-medium text-fg">{name}</span>
        <span className="flex min-w-0 items-center gap-x-2 text-[13px] text-muted [&>*:not(:first-child)]:shrink-0">
          <span className="min-w-0 truncate">
            <b className="font-semibold text-fg tabular-nums">{formatMoneyRange(s.priceMin, s.priceMax)}</b> · {meta}
          </span>
          {!s.onlineBookable && (
            <Badge tone="neutral" size="sm" icon={<GlobeLock aria-hidden />}>
              {t('list.notOnline')}
            </Badge>
          )}
          {s.staffIds.length === 0 && (
            <Badge tone="warning" size="sm" icon={<UserX aria-hidden />}>
              {t('list.noStaff')}
            </Badge>
          )}
          {s.kind === 'group' && (
            <Badge tone="info" size="sm">
              {t('badge.group')}
            </Badge>
          )}
        </span>
      </Link>
      {canEdit && (
        <DropdownMenu
          label={t('rowActions.label')}
          trigger={(p) => <IconButton {...p} icon={<MoreHorizontal aria-hidden />} variant="ghost" label={t('rowActions.label')} />}
          items={[
            {
              id: 'edit',
              label: t('rowActions.edit'),
              icon: <Pencil aria-hidden />,
              href: `/biz/services/${s.id}`,
            },
            {
              id: 'online',
              label: s.onlineBookable ? t('list.onlineOff') : t('list.onlineOn'),
              icon: s.onlineBookable ? <GlobeLock aria-hidden /> : <Globe aria-hidden />,
              onSelect: () => void actions.patch(s.id, { onlineBookable: !s.onlineBookable }),
            },
            { id: 'tb-group', groupLabel: t('techBreak.label') },
            tbItem('shared', t('techBreak.shared')),
            tbItem('none', t('techBreak.none')),
            ...TECH_BREAK_MINUTES.map((n) => tbItem(String(n), t('techBreak.minutes', { n }))),
            { id: 'sep', separator: true },
            {
              id: 'delete',
              label: t('delete.button'),
              icon: <Trash2 aria-hidden />,
              danger: true,
              onSelect: () => void actions.deleteServices([row]),
            },
          ]}
        />
      )}
    </>
  );
}

/** Содержимое компактной строки (без ⠿ и <li> — их даёт SortableRow); memo — см. ServiceRowTable */
export const ServiceRowCompact = memo(ServiceRowCompactImpl, sameRowProps);
