'use client';

/**
 * Счётчики по системам записи — сколько мест на Emly, Altegio, без системы… Это и главный фильтр экрана: нажатие
 * добавляет систему в выбор (мультивыбор), «Все» снимает выбор. Все чипы на месте уже при загрузке (числа — полосой).
 */
import { BOOKING_SYSTEMS, type BookingSystem } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Chip } from '@/ui/Chip';
import { ScrollRow } from '@/ui/ScrollRow';

export function SystemCounters({ counts, value, onValueChange }: { counts?: Record<BookingSystem, number>; value: BookingSystem[]; onValueChange: (v: BookingSystem[]) => void }) {
  const t = useT('platform');
  const total = counts ? BOOKING_SYSTEMS.reduce((sum, s) => sum + counts[s], 0) : undefined;
  const toggle = (s: BookingSystem) => onValueChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  return (
    <div role="group" aria-label={t('prospects.countsLabel')}>
      <ScrollRow gap="sm">
        <Chip selected={value.length === 0} onClick={() => onValueChange([])} count={total} countLoading={!counts}>
          {t('prospects.allSystems')}
        </Chip>
        {BOOKING_SYSTEMS.map((s) => (
          <Chip
            key={s}
            selected={value.includes(s)}
            onClick={() => toggle(s)}
            count={counts?.[s]}
            countLoading={!counts}
            // Пустую систему не выбрать (ноль мест), но она видна — ряд не прыгает от фильтра к фильтру
            disabled={Boolean(counts) && counts?.[s] === 0 && !value.includes(s)}
          >
            {t(`prospects.system.${s}`)}
          </Chip>
        ))}
      </ScrollRow>
    </div>
  );
}
