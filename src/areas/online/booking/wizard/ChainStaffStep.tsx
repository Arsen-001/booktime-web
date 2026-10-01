'use client';

import { useLocale } from 'next-intl';
import { Users } from 'lucide-react';
import type { PlanQuery } from '@/api/online';
import { NearestBadge } from '@/areas/online/booking/wizard/StaffStep';
import { useSpecialistTerms } from '@/areas/online/booking/wizard/specialistTerms';
import { ANY_STAFF } from '@/areas/online/booking/wizard/useWizardUrl';
import type { Service, SphereId, Staff } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Card } from '@/ui/Card';
import { FormField } from '@/ui/FormField';
import { Select } from '@/ui/Select';

/**
 * О4: услуги делают разные мастера — не тупик «Мастера не найдены», а «Разные мастера подряд»: на каждую услугу
 * свой мастер или «любой», время подбирается цепочкой (как пакет «последовательно несколькими мастерами»).
 */
export function ChainStaffStep({
  perService,
  legStaff,
  onChange,
  plan,
  sphereIds,
  hourCycle,
}: {
  perService: { service: Service; eligible: Staff[] }[];
  legStaff: Record<string, string>;
  onChange: (serviceId: string, staffId: string) => void;
  plan: PlanQuery | undefined;
  sphereIds?: SphereId[];
  hourCycle?: '24' | '12';
}) {
  const t = useT('online');
  const terms = useSpecialistTerms(sphereIds);
  const locale = useLocale();
  const format = useFormat();
  return (
    <div className="flex flex-col gap-4" data-f="F-03-130 F-03-089">
      <p className="flex items-start gap-2 rounded-xl bg-info-soft px-3 py-2.5 text-sm text-fg">
        <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
        {t('booking.staffStep.chainIntro', terms)}
      </p>
      <Card padding="md" className="flex flex-col gap-4">
        {perService.map(({ service, eligible }, i) => (
          <FormField
            key={service.id}
            label={`${i + 1}. ${pickText(service.name, locale)}`}
            hint={format.durationRange(service.durationMin, service.durationMax)}
          >
            <Select
              value={legStaff[service.id] ?? ANY_STAFF}
              onValueChange={(v) => onChange(service.id, v)}
              options={[
                { value: ANY_STAFF, label: t('booking.staffStep.any', terms) },
                ...eligible.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </FormField>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          <span className="text-muted">{t('booking.staffStep.chainNearest')}</span>
          <NearestBadge plan={plan} hourCycle={hourCycle} />
        </div>
      </Card>
    </div>
  );
}
