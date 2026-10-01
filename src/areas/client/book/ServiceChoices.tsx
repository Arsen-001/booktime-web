'use client';

import { useLocale } from 'next-intl';
import type { PublicService } from '@/api/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { ChoiceCard } from '@/ui/ChoiceCard';

/**
 * Выбор услуги карточками (ux-r2 №10): вся строка нажимается, цена и длительность видны. Если время уже выбрано,
 * услуги, которые в него не помещаются, недоступны с объяснением (ux-r1 №32, ux-r2 №2).
 */
export function ServiceChoices({
  services,
  value,
  onPick,
  fitting,
}: {
  services: PublicService[];
  value?: string;
  onPick: (id: string) => void;
  /** Id услуг, помещающихся в выбранное окно; нет — окно ещё не выбрано */
  fitting?: string[];
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const locale = useLocale();
  return (
    <div role="radiogroup" aria-label={t('book.step.service')} className="flex flex-col gap-2">
      {services.map((s) => {
        const fits = !fitting || fitting.includes(s.id);
        return (
          <ChoiceCard
            key={s.id}
            selected={value === s.id}
            disabled={!fits}
            onClick={() => onPick(s.id)}
            title={
              <span className="flex items-baseline justify-between gap-3">
                <span>{pickText(s.name, locale)}</span>
                <span className="shrink-0 tabular-nums">{fmt.moneyRange(s.priceMin, s.priceMax)}</span>
              </span>
            }
            description={fits ? fmt.durationRange(s.durationMin, s.durationMax) : t('book.serviceDoesNotFit')}
          />
        );
      })}
    </div>
  );
}
