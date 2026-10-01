'use client';

/**
 * /biz/waitlist — лист ожидания бизнеса (раздел «resources»). Лист один (владелец, 30.09.2026), и вид у него один —
 * WaitlistBoard: тот же компонент открывает плитка «Лист ожидания» в журнале (вклад journalWaitlist ← resources).
 * Из журнала сюда приходят с ?date= — тогда фильтр «На день журнала» стоит сразу.
 */
import { useSearchParams } from 'next/navigation';
import { useCurrent } from '@/demo/hooks';
import type { ISODate } from '@/domain/core';
import { WaitlistBoard } from '@/areas/resources/waitlist/WaitlistBoard';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function WaitlistScreen() {
  const { businessId, locationId } = useCurrent();
  const dateParam = useSearchParams().get('date');
  const journalDate = dateParam && ISO_DAY.test(dateParam) ? (dateParam as ISODate) : undefined;
  return <WaitlistBoard variant="page" businessId={businessId} locationId={locationId && locationId !== 'all' ? locationId : undefined} journalDate={journalDate} />;
}
