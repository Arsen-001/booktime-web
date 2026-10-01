'use client';

import { getAnySpecialistAllowed, getSkipStaffSelection, getSlotMode, getUnavailableDays, setSkipStaffSelection } from '@/api/schedule';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

/** Онлайн-запись мастера на его карточке (F-02-041/043/079): чьи правила, закрытые дни, «к любому мастеру» */
export function StaffOnlineSection({ staffId, businessId }: { staffId: Id; businessId: Id }) {
  const t = useT('schedule');
  const toast = useToast();
  const modeQuery = useApiQuery(['schedule', 'slot-mode', staffId], () => getSlotMode(staffId));
  const unavailableQuery = useApiQuery(['schedule', 'unavailable', 'staff', staffId], () => getUnavailableDays('staff', staffId));
  const anyAllowedQuery = useApiQuery(['schedule', 'ext-any-allowed', businessId], () => getAnySpecialistAllowed(businessId));
  const skipKey = ['schedule', 'ext-skip-selection', staffId] as const;
  const skipQuery = useApiQuery(skipKey, () => getSkipStaffSelection(staffId));
  const setSkip = useApiMutation((v: boolean) => setSkipStaffSelection(staffId, v), {
    optimistic: optimistic<boolean, boolean>(skipKey, (_o, v) => v),
  });

  // Загрузка — та же секция (DESIGN.md → «The skeleton IS the page»): режим и подсказка полосами, кнопка на месте,
  // тумблер «к любому мастеру» — неактивный (у типичного салона он включён в настройках)
  if (modeQuery.isLoading || unavailableQuery.isLoading || anyAllowedQuery.isLoading)
    return (
      <div aria-busy className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-fg">
              {t('slots.mode.title')}: <SkeletonText width="16ch" />
            </p>
            <p className="text-sm text-muted">
              <SkeletonText width="34ch" />
            </p>
          </div>
        </div>
        <LinkButton href={`/biz/schedule/slots/${staffId}`} variant="secondary" size="sm" className="self-start">
          {t('staffCard.openSlots')}
        </LinkButton>
        <div>
          <Switch
            checked={false}
            disabled
            label={t('slots.anySpecialist.toggleLabel')}
            description={<SkeletonText width="44ch" />}
          />
        </div>
      </div>
    );
  const mode = modeQuery.data ?? 'location';
  const count = unavailableQuery.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-3" data-f="F-02-041 F-02-043">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-fg">
            {t('slots.mode.title')}: {mode === 'own' ? t('slots.mode.own') : t('slots.mode.location')}
          </p>
          <p className="text-sm text-muted">{mode === 'own' ? t('slots.mode.ownHint') : t('staffCard.byBranchHint')}</p>
        </div>
        {count > 0 && <Badge tone="warning">{t('staffCard.closedDays', { n: count })}</Badge>}
      </div>
      <LinkButton href={`/biz/schedule/slots/${staffId}`} variant="secondary" size="sm" className="self-start">
        {t('staffCard.openSlots')}
      </LinkButton>
      {anyAllowedQuery.data && (
        <div data-f="F-02-079">
          <Switch
            checked={skipQuery.data ?? false}
            onCheckedChange={(value) =>
              void setSkip.mutate(value).then(
                () => toast.success(t('staffCard.settingsSaved')),
                () => toast.error(t('staffCard.settingsSaveFailed')),
              )
            }
            label={t('slots.anySpecialist.toggleLabel')}
            description={skipQuery.data ? t('slots.anySpecialist.toggleHintOn') : t('slots.anySpecialist.toggleHintOff')}
          />
        </div>
      )}
    </div>
  );
}
