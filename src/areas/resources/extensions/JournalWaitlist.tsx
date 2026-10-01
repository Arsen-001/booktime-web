'use client';

import type { JournalWaitlistExtProps } from '@/extensions/types';
import { WaitlistBoard } from '@/areas/resources/waitlist/WaitlistBoard';

/**
 * Вклад в панель «Лист ожидания» журнала (хост journalWaitlist): тот же вид листа, что экран /biz/waitlist — один лист,
 * одни действия. День сетки журнала — фильтр «На день журнала»; «Записать» открывает окно записи журнала (onRecord).
 */
export default function JournalWaitlist({ businessId, locationId, date, staffIds, onRecord }: JournalWaitlistExtProps) {
  return <WaitlistBoard variant="panel" businessId={businessId} locationId={locationId || undefined} journalDate={date} staffIds={staffIds} onRecord={onRecord} />;
}
