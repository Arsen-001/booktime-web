'use client';

import { Link2, Smartphone } from 'lucide-react';
import { getBookingMeta, getClientFieldsConfig, getLink } from '@/api/online';
import { useApiQuery } from '@/api/request';
import type { BookingWindowExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';

/**
 * Вклад раздела «online» в окно записи (хост «bookingWindow»): источник записи (F-03-123), версия
 * формы (F-03-139) и ответы на свои поля «Сохранять в карточку: Карточка записи» (F-03-073) — только
 * для записей, пришедших с онлайн-записи (link/widget). Файл раздела «online».
 * Посмотреть вклад без хозяина хоста: /dev/ext/bookingWindow/online
 */
export default function OnlineBookingWindow({ bookingId, businessId, draft }: BookingWindowExtProps) {
  const t = useT('online');
  const source = draft.source;
  const metaQ = useApiQuery(['online-booking-meta', bookingId], () => getBookingMeta(bookingId!), { enabled: Boolean(bookingId) });
  // ⭐ React Compiler считает функцию, переданную в хук, «может выполниться в рендере» — `metaQ.data!.linkId`
  // внутри неё падает при metaQ.data===undefined, даже с enabled:false (qa/measure/online/state-s1.md, п.1).
  const linkId = metaQ.data?.linkId;
  const linkQ = useApiQuery(['online-booking-link', linkId], () => getLink(linkId ?? ''), { enabled: Boolean(linkId) });
  const fieldsQ = useApiQuery(['online-booking-fields', businessId], () => getClientFieldsConfig(businessId), {
    enabled: Boolean(metaQ.data?.customFieldValues),
  });

  if (source !== 'link' && source !== 'widget') return null;

  const answers = (fieldsQ.data?.customFields ?? [])
    .filter((f) => f.target === 'booking')
    .map((f) => ({ label: f.label, value: metaQ.data?.customFieldValues?.[f.id] }))
    .filter((a): a is { label: string; value: string } => Boolean(a.value));

  return (
    <div className="flex flex-col gap-2" data-f="F-03-123">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info" icon={<Link2 aria-hidden />}>
          {source === 'link' ? t('bookingWindow.source.link') : t('bookingWindow.source.widget')}
        </Badge>
        {linkQ.data && <Badge tone="neutral">{linkQ.data.name}</Badge>}
        {metaQ.data && (
          <Badge tone="neutral" icon={<Smartphone aria-hidden />}>
            {metaQ.data.device === 'mobile' ? t('bookingWindow.device.mobile') : t('bookingWindow.device.desktop')}
          </Badge>
        )}
        {/* F-03-139: версия формы, через которую пришла запись — источник (Badge выше) недостаточен: при
            смене поколения виджета отчёты не должны смешивать старые и новые записи. */}
        {metaQ.data && (
          <Badge tone="neutral" data-f="F-03-139">
            {t('bookingWindow.widgetGen.new')}
            {metaQ.data.formId ? ` · ${metaQ.data.formId}` : ''}
          </Badge>
        )}
      </div>
      {answers.length > 0 && (
        <dl className="flex flex-col gap-1 text-sm" data-f="F-03-073">
          {answers.map((a) => (
            <div key={a.label} className="flex flex-wrap gap-x-1.5">
              <dt className="text-muted">{a.label}:</dt>
              <dd className="font-medium text-fg">{a.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
