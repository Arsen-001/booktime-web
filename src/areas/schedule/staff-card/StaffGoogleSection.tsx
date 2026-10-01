'use client';

import type { Id } from '@/domain/core';
import { connectGoogleCalendar, disconnectGoogleCalendar, getGoogleCalendarLink, setGoogleCalendarShareClientNames } from '@/api/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { useToast } from '@/ui/Toast';

/** Google Календарь сотрудника (F-02-090): записи выгружаются в одну сторону */
export function StaffGoogleSection({ staffId }: { staffId: Id }) {
  const t = useT('schedule');
  const toast = useToast();
  const query = useApiQuery(['schedule', 'ext-google-calendar', staffId], () => getGoogleCalendarLink(staffId));
  const connect = useApiMutation(() => connectGoogleCalendar(staffId));
  const disconnect = useApiMutation(() => disconnectGoogleCalendar(staffId));
  const share = useApiMutation((v: boolean) => setGoogleCalendarShareClientNames(staffId, v));
  const run = (p: Promise<unknown>) =>
    void p.then(
      () => toast.success(t('staffCard.settingsSaved')),
      () => toast.error(t('staffCard.settingsSaveFailed')),
    );

  return (
    <div data-f="F-02-090 F-10-098 F-01-201" className="flex flex-col gap-2">
      <p className="font-medium text-fg">{t('staffCard.googleTitle')}</p>
      <p className="text-sm text-muted">{t('staffCard.googleHint')}</p>
      {query.isLoading ? (
        // Загрузка — кнопка «Подключить» на своём месте неактивной (у типичного мастера календарь не подключён)
        <Button variant="secondary" size="sm" className="self-start" disabled>
          {t('staffCard.googleConnect')}
        </Button>
      ) : query.data?.connected ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{t('staffCard.googleConnected')}</Badge>
            <Button variant="ghost" size="sm" loading={disconnect.isPending} onClick={() => run(disconnect.mutate(undefined))}>
              {t('staffCard.googleDisconnect')}
            </Button>
          </div>
          <Checkbox
            checked={query.data.shareClientNames}
            onCheckedChange={(v) => run(share.mutate(v))}
            label={t('staffCard.googleShareNames')}
            description={t('staffCard.googleShareNamesHint')}
          />
        </div>
      ) : (
        <Button variant="secondary" size="sm" className="self-start" loading={connect.isPending} onClick={() => run(connect.mutate(undefined))}>
          {t('staffCard.googleConnect')}
        </Button>
      )}
    </div>
  );
}
