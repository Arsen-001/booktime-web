'use client';

/**
 * Одна строка журнала отправок целиком (Ув11): полный текст — на языке, на котором он ушёл (Ув16), канал, контакт,
 * статус, цена и части SMS, перенос тихими часами; «Открыть запись» — в журнал на день визита с открытым окном записи.
 */
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useCoreGet } from '@/api/core';
import { channelLabel } from '@/areas/notify/lib/registry';
import { sentText, typeLabelIn } from '@/areas/notify/lib/logText';
import { NOTIFY_LANGUAGE_OPTIONS } from '@/areas/notify/types/NotifySettingsCard';
import type { LogMessage, LogStatus } from '@/domain/notify';
import type { Locale } from '@/i18n/config';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { KeyValueList } from '@/ui/KeyValueList';
import { Modal } from '@/ui/Modal';

export interface LogMessageModalProps {
  message: LogMessage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusTone: Record<LogStatus, 'success' | 'danger' | 'warning' | 'info' | 'neutral'>;
  /** Замаскировать телефоны (нет права clients.phones, F-05-112) */
  mask: (text: string) => string;
}

export function LogMessageModal({ message, open, onOpenChange, statusTone, mask }: LogMessageModalProps) {
  const t = useT('notify');
  const format = useFormat();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const bookingQ = useCoreGet('bookings', message?.bookingId, { enabled: open && !!message?.bookingId });

  if (!message) return null;

  const booking = bookingQ.data;
  const langLabel = NOTIFY_LANGUAGE_OPTIONS.find((o) => o.value === (message.sentLanguage ?? 'ru'))?.label;
  const items = [
    { label: t('log.columns.date'), value: format.dateTime(message.createdAt) },
    ...(message.deferredFrom
      ? [{ label: t('log.detail.deferred'), value: t('log.detail.deferredFrom', { time: format.dateTime(message.deferredFrom) }) }]
      : []),
    { label: t('log.columns.channel'), value: channelLabel(message.channel, locale) },
    { label: t('log.columns.contact'), value: mask(message.contact) },
    {
      label: t('log.columns.status'),
      value: (
        <Badge tone={message.scheduled ? 'info' : statusTone[message.status]} size="sm">
          {message.scheduled ? t('log.scheduledBadge') : t(`log.status.${message.status}`)}
        </Badge>
      ),
    },
    {
      label: t('log.columns.cost'),
      value:
        message.costAmd === undefined
          ? '—'
          : message.costAmd === 0
            ? t('log.free')
            : message.smsParts
              ? t('log.detail.costSms', { cost: format.money(message.costAmd), parts: message.smsParts })
              : format.money(message.costAmd),
    },
    { label: t('log.detail.language'), value: langLabel ?? '—' },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={typeLabelIn(message.typeLabel, locale)}
      size="md"
      footer={
        message.bookingId ? (
          <Button
            variant="secondary"
            disabled={!booking}
            loading={bookingQ.isLoading}
            onClick={() => {
              if (!booking) return;
              onOpenChange(false);
              router.push(`/biz/journal?date=${booking.start.slice(0, 10)}&booking=${booking.id}`);
            }}
          >
            {t('log.detail.openBooking')}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-fg">{mask(sentText(message))}</p>
        <KeyValueList items={items} />
      </div>
    </Modal>
  );
}
