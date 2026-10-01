'use client';

import { Clock, MapPin, Palette, Scissors } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';
import type { MasterCard, PublicService, ShadeOption } from '@/api/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import type { ISODateTime, Workplace } from '@/domain/core';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';

/**
 * Карточка-итог записи (ux-r2 улучшение 1): мастер и место, ниже по мере выбора — услуга с ценой, время, место,
 * оттенок; у каждой строки «Изменить». Время, пришедшее по ссылке из окна, видно с первого шага.
 */
export function BookSummary({
  card,
  service,
  slot,
  workplace,
  shade,
  onChangeService,
  onChangeSlot,
}: {
  card: MasterCard;
  service?: PublicService;
  slot?: ISODateTime;
  workplace?: Workplace;
  shade?: ShadeOption;
  onChangeService?: () => void;
  onChangeSlot?: () => void;
}) {
  const t = useT('client');
  const nameOf = useDisplayName();
  const tc = useT('common');
  const fmt = useClientFormat();
  const locale = useLocale();
  const { staff, business } = card;

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="md" />
        <div className="min-w-0">
          <p className="font-semibold text-fg">{nameOf(staff.name)}</p>
          <p className="truncate text-sm text-muted">{business.kind === 'individual' ? t('master.individual') : nameOf(business.name)}</p>
        </div>
      </div>
      {(service || slot) && (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {service && (
            <SummaryRow icon={<Scissors />} onChange={onChangeService} changeLabel={t('book.change')}>
              <span className="block font-medium text-fg">{pickText(service.name, locale)}</span>
              <span className="block text-sm text-muted">
                {fmt.durationRange(service.durationMin, service.durationMax)} · {fmt.moneyRange(service.priceMin, service.priceMax)}
              </span>
            </SummaryRow>
          )}
          {slot && (
            <SummaryRow icon={<Clock />} onChange={onChangeSlot} changeLabel={t('book.change')}>
              <span className="block font-semibold text-fg first-letter:uppercase">
                {fmt.relativeDay(slot)}, {fmt.time(slot)}
              </span>
            </SummaryRow>
          )}
          {workplace && workplace !== 'salon' && (
            <SummaryRow icon={<MapPin />}>
              <span className="block text-fg">{tc(`workplace.${workplace}`)}</span>
            </SummaryRow>
          )}
          {shade && (
            <SummaryRow icon={<Palette />}>
              <span className="block text-fg">
                {shade.mode === 'master' ? t('book.shadeMaster') : shade.mode === 'own' ? t('book.shadeOwn') : shade.material}
              </span>
            </SummaryRow>
          )}
        </ul>
      )}
    </Card>
  );
}

function SummaryRow({
  icon,
  children,
  onChange,
  changeLabel,
}: {
  icon: ReactNode;
  children: ReactNode;
  onChange?: () => void;
  changeLabel?: string;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {onChange && (
        <Button variant="ghost" size="sm" onClick={onChange}>
          {changeLabel}
        </Button>
      )}
    </li>
  );
}
