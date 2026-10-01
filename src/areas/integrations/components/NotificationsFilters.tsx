'use client';

/**
 * F-13-140: фильтры витрины категории «Уведомления» — канал, возможность, тип приложения. Значения сужают
 * список (передаются в listApps как AND); «SMS-агрегаторы» скрывает чат-ботов через appKind.
 */
import {
  APP_CHANNELS,
  NOTIFY_APP_KINDS,
  NOTIFY_CAPABILITIES,
  type AppChannel,
  type NotifyAppKind,
  type NotifyCapability,
} from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Select } from '@/ui/Select';

export interface NotificationsFilterState {
  channel?: AppChannel;
  capability?: NotifyCapability;
  appKind?: NotifyAppKind;
}

export function NotificationsFilters({
  value,
  onChange,
}: {
  value: NotificationsFilterState;
  onChange: (next: NotificationsFilterState) => void;
}) {
  const t = useT('integrations');

  return (
    <div data-f="F-13-140" className="flex flex-wrap gap-2">
      <Select
        aria-label={t('category.notifications.filters.channelLabel')}
        className="w-full sm:w-48"
        options={[
          { value: '', label: t('category.notifications.filters.channelAll') },
          ...APP_CHANNELS.map((c) => ({
            value: c,
            label: t(`channels.${c}` as never),
          })),
        ]}
        value={value.channel ?? ''}
        onValueChange={(v) =>
          onChange({
            ...value,
            channel: (v || undefined) as AppChannel | undefined,
          })
        }
      />
      <Select
        aria-label={t('category.notifications.filters.capabilityLabel')}
        className="w-full sm:w-56"
        options={[
          {
            value: '',
            label: t('category.notifications.filters.capabilityAll'),
          },
          ...NOTIFY_CAPABILITIES.map((c) => ({
            value: c,
            label: t(`category.notifications.filters.capability.${c}` as never),
          })),
        ]}
        value={value.capability ?? ''}
        onValueChange={(v) =>
          onChange({
            ...value,
            capability: (v || undefined) as NotifyCapability | undefined,
          })
        }
      />
      <Select
        aria-label={t('category.notifications.filters.appKindLabel')}
        className="w-full sm:w-44"
        options={[
          { value: '', label: t('category.notifications.filters.appKindAll') },
          ...NOTIFY_APP_KINDS.map((k) => ({
            value: k,
            label: t(`category.notifications.filters.appKind.${k}` as never),
          })),
        ]}
        value={value.appKind ?? ''}
        onValueChange={(v) =>
          onChange({
            ...value,
            appKind: (v || undefined) as NotifyAppKind | undefined,
          })
        }
      />
    </div>
  );
}
