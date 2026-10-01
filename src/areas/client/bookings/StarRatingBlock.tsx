'use client';

import { Star } from 'lucide-react';
import { getMyStar, rateStaff, unrateStaff } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { useToast } from '@/ui/Toast';

/** «Понравилось? ★» (F-00-116, F-14-013): только у визита «пришёл», одна на клиента, можно снять. Текстовых отзывов нет */
export function StarRatingBlock({ appUserId, staffId, bookingId }: { appUserId: Id; staffId: Id; bookingId: Id }) {
  const t = useT('client');
  const toast = useToast();
  const q = useApiQuery(clientKeys.myStar(appUserId, staffId), () => getMyStar(appUserId, staffId));
  const rate = useApiMutation(rateStaff);
  const unrate = useApiMutation((sId: Id) => unrateStaff(appUserId, sId));
  const starred = Boolean(q.data);

  const toggle = async () => {
    try {
      if (starred) await unrate.mutate(staffId);
      else {
        await rate.mutate({ appUserId, staffId, bookingId });
        toast.success(t('bookingDetail.rated'));
      }
    } catch {
      toast.error(t('bookingDetail.actionFailed'));
    }
  };

  return (
    <Card data-f="F-14-013 F-00-116" padding="md" className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-medium text-fg">{t('bookingDetail.rateTitle')}</p>
      <Button
        variant={starred ? 'secondary' : 'outline'}
        leftIcon={<Star aria-hidden className={starred ? 'fill-current text-warning' : ''} />}
        onClick={() => void toggle()}
        loading={rate.isPending || unrate.isPending || q.isLoading}
      >
        {starred ? t('bookingDetail.rated') : t('bookingDetail.rateCta')}
      </Button>
    </Card>
  );
}
