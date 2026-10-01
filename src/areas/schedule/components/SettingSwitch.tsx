'use client';

import type { ReactNode } from 'react';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

export interface SettingSwitchProps {
  queryKey: readonly unknown[];
  read: () => Promise<boolean>;
  write: (value: boolean) => Promise<void>;
  fallback: boolean;
  label: ReactNode;
  description: ReactNode;
  savedText?: (value: boolean) => string;
}

/** Переключатель настройки с мгновенным откликом (оптимистично) и тостом — один на все тумблеры раздела */
export function SettingSwitch({ queryKey, read, write, fallback, label, description, savedText }: SettingSwitchProps) {
  const t = useT('schedule');
  const toast = useToast();
  const query = useApiQuery(queryKey, read);
  const save = useApiMutation(write, { optimistic: optimistic<boolean, boolean>(queryKey, (_o, v) => v) });
  // Загрузка — тот же переключатель с подписью (неактивный): строка не меняет высоту, когда приходит значение
  return (
    <Switch
      checked={query.data ?? fallback}
      disabled={query.isLoading}
      onCheckedChange={(v) =>
        void save.mutate(v).then(
          () => toast.success(savedText ? savedText(v) : t('settingsHub.saved')),
          () => toast.error(t('settingsHub.saveFailed')),
        )
      }
      label={label}
      description={description}
    />
  );
}
