'use client';

import { Car, Home, Store } from 'lucide-react';
import type { Workplace } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { ChoiceGroup } from '@/ui/ChoiceGroup';

const ICON: Partial<Record<Workplace, typeof Store>> = { salon: Store, home: Home, visit: Car };

/** Где: в салоне / у мастера дома / выезд ко мне (decision-c3 №1, F-00-079) — выезд всегда ждёт подтверждения мастера */
export function PlaceChoice({ workplaces, value, onChange }: { workplaces: Workplace[]; value?: Workplace; onChange: (w: Workplace) => void }) {
  const t = useT('client');
  const tc = useT('common');
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-fg">{t('book.placeTitle')}</h2>
      <ChoiceGroup
        columns={1}
        aria-label={t('book.placeTitle')}
        value={value}
        onValueChange={(v) => onChange(v as Workplace)}
        options={workplaces.map((w) => {
          const Icon = ICON[w] ?? Store;
          return {
            value: w,
            title: tc(`workplace.${w}`),
            description: w === 'visit' ? t('book.placeVisitHint') : undefined,
            icon: <Icon aria-hidden />,
          };
        })}
      />
    </section>
  );
}
