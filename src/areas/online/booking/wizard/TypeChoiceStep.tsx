'use client';

import { useEffect } from 'react';
import { User, Users } from 'lucide-react';
import { trackWidgetEvent } from '@/api/online';
import { WizardHeader } from '@/areas/online/booking/wizard/WizardHeader';
import { ApplyWidgetTheme } from '@/areas/online/public/ApplyWidgetTheme';
import type { BookingLink } from '@/domain/online';
import { useT } from '@/i18n/useT';
import { ChoiceGroup } from '@/ui/ChoiceGroup';

/**
 * F-03-082 «Выбор типа записи», F-16-085 «Выбор типа записи в смешанной ссылке» — первый экран смешанной
 * ссылки. F-16-093: показ шага и оба выбора уходят в аналитику своим событием, отличным друг от друга.
 */
export function TypeChoiceStep({
  link,
  businessId,
  businessName,
  slug,
  onChoose,
}: {
  link: BookingLink;
  businessId: string;
  businessName: string;
  slug: string;
  onChoose: (choice: 'individual' | 'group') => void;
}) {
  const t = useT('online');
  useEffect(() => {
    void trackWidgetEvent(link.id, businessId, 'activity_type_showed');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз при показе экрана
  }, []);
  return (
    <div className="flex flex-col gap-5" data-f="F-03-082 F-16-085 F-16-093">
      <ApplyWidgetTheme theme={link.theme} />
      <WizardHeader slug={slug} businessName={businessName} />
      <div>
        <h1 className="text-xl font-semibold text-fg">{t('booking.type.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('booking.type.subtitle')}</p>
      </div>
      <ChoiceGroup
        columns={2}
        aria-label={t('booking.type.title')}
        options={[
          { value: 'individual', title: t('booking.type.individual'), description: t('booking.type.individualHint'), icon: <User aria-hidden /> },
          { value: 'group', title: t('booking.type.group'), description: t('booking.type.groupHint'), icon: <Users aria-hidden /> },
        ]}
        onValueChange={(v) => onChoose(v as 'individual' | 'group')}
      />
    </div>
  );
}
