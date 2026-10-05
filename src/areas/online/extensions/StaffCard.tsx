'use client';

import Link from 'next/link';
import { CalendarCheck2, Check, MapPin, Users } from 'lucide-react';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { coreList, coreUpdate } from '@/api/core';
import { getPlacesData, getStaffRules, getStaffServiceOnlineFlags, isStaffServicePairOnline, setStaffServiceOnline } from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { StaffCardExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { KeyValueList } from '@/ui/KeyValueList';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

const WORKPLACE_ICON_KEYS = ['salon', 'home', 'visit', 'gym', 'online'] as const;

/**
 * Вклад раздела «online» в карточку сотрудника (F-00-066, F-00-073, F-00-078): правила онлайн-записи
 * и места работы этого мастера, ссылка на полные экраны настройки.
 * Посмотреть вклад без хозяина хоста: /dev/ext/staffCard/online
 */
export default function OnlineStaffCard({ staffId, businessId }: StaffCardExtProps) {
  const t = useT('online');
  const toast = useToast();
  const locale = useLocale();

  const dataQ = useApiQuery(['online-staffcard', staffId], () => getPlacesData(staffId, undefined));
  const rulesQ = useApiQuery(['online-staffcard-rules', staffId], () => getStaffRules(staffId));
  const servicesQ = useApiQuery(['online-staffcard-services', businessId], () => coreList('services', (s) => s.businessId === businessId && s.kind !== 'intake'));
  const pairsQ = useApiQuery(['online-staffcard-pairs', businessId], () => getStaffServiceOnlineFlags(businessId));

  const [savedId, setSavedId] = useState<string | null>(null);
  const onlineMutation = useApiMutation((v: boolean) => coreUpdate('staff', staffId, { onlineBookingEnabled: v }));
  const loadingAll = dataQ.isLoading || rulesQ.isLoading || servicesQ.isLoading || pairsQ.isLoading;
  const ownIds = dataQ.data?.staff.serviceIds;
  const ownCount = ownIds && servicesQ.data ? servicesQ.data.filter((s) => ownIds.includes(s.id)).length : undefined;
  const pairsSkeletonCount = useSkeletonCount('online-staffcard-pairs', { loading: loadingAll, count: ownCount, fallback: 6, max: 20 });
  const pairMutation = useApiMutation((args: { serviceId: string; online: boolean }) => setStaffServiceOnline(staffId, args.serviceId, args.online));

  // М2 обзора «Сотрудники»: вкладка появляется ОДНИМ куском, когда пришли все её данные, а скелет — той же формы
  // (строка переключателя, пары «подпись — значение», места работы, строки услуг), а не прямоугольник 128 px
  if (dataQ.isLoading || rulesQ.isLoading || servicesQ.isLoading || pairsQ.isLoading) {
    // Та же вкладка до данных (DESIGN.md «The skeleton IS the page»): подписи настоящие, значения полосами,
    // переключатели выключены; строк услуг — сколько было в прошлый раз
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-fg">{t('staffCard.onlineEnabled')}</span>
          <Switch checked={false} disabled onCheckedChange={() => undefined} />
        </div>
        <KeyValueList
          items={[t('staffCard.confirmMode'), t('staffCard.accepts'), t('staffCard.cancelWindow'), t('staffCard.rescheduleWindow')].map((label) => ({
            label,
            value: <SkeletonText width="9ch" />,
          }))}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-fg">{t('staffCard.workplaces')}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neutral" size="sm" variant="soft">
              <SkeletonText width="7ch" />
            </Badge>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-fg">{t('staffCard.pairsTitle')}</p>
          <ul className="flex flex-col divide-y divide-border">
            {Array.from({ length: pairsSkeletonCount }, (_, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-fg">
                  <SkeletonText width={i % 2 ? '16ch' : '20ch'} />
                </span>
                <Switch checked={false} disabled onCheckedChange={() => undefined} />
              </li>
            ))}
          </ul>
        </div>
        <span className="-mx-1 inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary-text">{t('staffCard.editLink')}</span>
      </div>
    );
  }
  if (dataQ.isError || !dataQ.data) {
    return <p className="text-sm text-muted">{t('staffCard.loadFailed')}</p>;
  }

  const { staff } = dataQ.data;
  const rules = rulesQ.data;
  const ownServices = (servicesQ.data ?? []).filter((s) => staff.serviceIds.includes(s.id));

  return (
    <div className="flex flex-col gap-4" data-f="F-00-066 F-00-073">
      <div className="flex items-center justify-between gap-3" data-f="F-03-132">
        <span className="text-sm font-medium text-fg">{t('staffCard.onlineEnabled')}</span>
        <Switch
          checked={staff.onlineBookingEnabled !== false}
          disabled={onlineMutation.isPending}
          onCheckedChange={async (checked) => {
            try {
              await onlineMutation.mutate(checked);
              toast.success(checked ? t('staffCard.onlineEnabledOn') : t('staffCard.onlineEnabledOff'));
              dataQ.refetch();
            } catch {
              toast.error(t('staffCard.updateFailed'));
            }
          }}
        />
      </div>

      <KeyValueList
        items={[
          {
            label: t('staffCard.confirmMode'),
            value: (
              <Badge tone={staff.confirmMode === 'manual' ? 'warning' : 'success'} size="sm" variant="soft">
                {staff.confirmMode === 'manual' ? t('settings.confirmMode.manualShort') : t('settings.confirmMode.instantShort')}
              </Badge>
            ),
          },
          {
            label: t('staffCard.accepts'),
            value: (
              <span className="inline-flex items-center gap-1.5">
                <Users aria-hidden className="size-3.5 text-muted" />
                {t(`settings.accepts.${staff.accepts}` as never)}
              </span>
            ),
          },
          ...(rules
            ? [
                { label: t('staffCard.cancelWindow'), value: t('staffCard.hours', { count: rules.cancelWindowHours }) },
                { label: t('staffCard.rescheduleWindow'), value: t('staffCard.hours', { count: rules.rescheduleWindowHours }) },
              ]
            : []),
        ]}
      />

      <div data-f="F-00-073 F-00-078">
        <p className="mb-1.5 text-sm font-medium text-fg">{t('staffCard.workplaces')}</p>
        <div className="flex flex-wrap gap-1.5">
          {staff.workplaces.length === 0 ? (
            <span className="text-sm text-muted">{t('staffCard.noWorkplaces')}</span>
          ) : (
            WORKPLACE_ICON_KEYS.filter((wp) => staff.workplaces.includes(wp)).map((wp) => (
              <Badge key={wp} tone="neutral" size="sm" variant="soft" icon={wp === 'visit' ? <MapPin aria-hidden /> : <CalendarCheck2 aria-hidden />}>
                {t(`places.workplace.${wp}` as never)}
              </Badge>
            ))
          )}
        </div>
      </div>

      {ownServices.length > 0 && (
        <div data-f="F-03-133">
          <p className="mb-1.5 text-sm font-medium text-fg">{t('staffCard.pairsTitle')}</p>
          <ul className="flex flex-col divide-y divide-border">
            {ownServices.map((s) => {
              const isGroup = s.kind === 'group';
              const online = isStaffServicePairOnline(pairsQ.data ?? {}, staffId, s.id);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-sm text-fg">{pickText(s.name, locale)}</span>
                    {savedId === s.id && (
                      <span aria-live="polite" className="inline-flex animate-fade-in items-center gap-1 text-xs font-medium text-success">
                        <Check aria-hidden className="size-3.5" />
                        {t('staffCard.saved')}
                      </span>
                    )}
                  </span>
                  {isGroup ? (
                    <span className="text-xs text-muted">{t('staffCard.pairGroupHint')}</span>
                  ) : (
                    <Switch
                      checked={online}
                      disabled={pairMutation.isPending}
                      onCheckedChange={async (checked) => {
                        try {
                          await pairMutation.mutate({ serviceId: s.id, online: checked });
                          // С2: мгновенный переключатель отвечает тихим «Сохранено ✓» у своей строки
                          setSavedId(s.id);
                          pairsQ.refetch();
                        } catch {
                          toast.error(t('staffCard.updateFailed'));
                        }
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Link
        href="/biz/online/settings"
        className="-mx-1 inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary-text hover:underline"
      >
        {t('staffCard.editLink')}
      </Link>
    </div>
  );
}
