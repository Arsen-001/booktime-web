'use client';

/**
 * Четыре счётчика «Пользователей» — они же быстрые фильтры: «Новых за 7 дней» ставит регистрацию с недели назад,
 * «Активных за 7 дней» — «был активен за 7 дней», «С Telegram» / «С WhatsApp» — канал «есть», «Всего» сбрасывает всё.
 * Нажатый счётчик выделен рамкой; повторное нажатие снимает свой фильтр. Числа — по всей базе, без фильтров.
 */
import type { ReactNode } from 'react';
import { CalendarPlus, MessageCircle, Send, UserCheck, Users } from 'lucide-react';
import type { UsersFilterState } from '@/areas/platform/users/useUsersFilters';
import type { PlatformUsersCounters } from '@/domain/platform/types/users';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { addDays, today } from '@/lib/date';
import { StatCard } from '@/ui/StatCard';

/** Тот же порог, что у счётчика на сервере: регистрация не раньше, чем 7 дней назад */
export const weekAgo = () => addDays(today(), -7);

interface Props {
  counters: PlatformUsersCounters | undefined;
  loading: boolean;
  filters: UsersFilterState;
  narrowed: boolean;
  onChange: (patch: Partial<UsersFilterState>) => void;
  onReset: () => void;
}

export function UsersCounters({ counters: c, loading, filters, narrowed, onChange, onReset }: Props) {
  const t = useT('platform');
  const fmt = useFormat();
  const from = weekAgo();
  const newOn = filters.range.from === from && !filters.range.to;
  const activeOn = filters.activeDays === '7';
  const tgOn = filters.telegram === 'yes';
  const waOn = filters.whatsapp === 'yes';

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <Counter pressed={!narrowed} onClick={onReset} label={t('users.counters.total')} value={fmt.number(c?.total ?? 0)} icon={<Users aria-hidden />} loading={loading} />
      <Counter
        pressed={newOn}
        onClick={() => onChange({ range: newOn ? {} : { from } })}
        label={t('users.counters.new7d')}
        value={fmt.number(c?.new7d ?? 0)}
        icon={<CalendarPlus aria-hidden />}
        loading={loading}
      />
      <Counter
        pressed={activeOn}
        onClick={() => onChange({ activeDays: activeOn ? '' : '7' })}
        label={t('users.counters.active7d')}
        value={fmt.number(c?.active7d ?? 0)}
        icon={<UserCheck aria-hidden />}
        loading={loading}
      />
      <Counter
        pressed={tgOn}
        onClick={() => onChange({ telegram: tgOn ? '' : 'yes' })}
        label={t('users.counters.telegram')}
        value={fmt.number(c?.telegram ?? 0)}
        icon={<Send aria-hidden />}
        loading={loading}
      />
      <Counter
        pressed={waOn}
        onClick={() => onChange({ whatsapp: waOn ? '' : 'yes' })}
        label={t('users.counters.whatsapp')}
        value={fmt.number(c?.whatsapp ?? 0)}
        icon={<MessageCircle aria-hidden />}
        loading={loading}
        className="max-sm:col-span-2"
      />
    </div>
  );
}

interface CounterProps {
  pressed: boolean;
  onClick: () => void;
  label: string;
  value: string;
  icon: ReactNode;
  loading: boolean;
  className?: string;
}

function Counter({ pressed, onClick, label, value, icon, loading, className }: CounterProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn('group h-full rounded-lg text-left focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none', className)}
    >
      <StatCard
        label={label}
        value={value}
        icon={icon}
        loading={loading}
        className={cn(
          // Число — по низу карточки: подпись в две строки у соседа не сдвигает ряд чисел
          '[&>p]:mt-auto',
          'group-hover:border-border-strong/60 group-hover:shadow-md motion-safe:group-hover:-translate-y-0.5',
          pressed && 'border-primary ring-1 ring-primary group-hover:border-primary',
        )}
      />
    </button>
  );
}
