import { cn } from '@/lib/cn';

/**
 * Время журнала в 12-часовом формате: «10:00 AM» → «10:00» + мелкое «AM» в одну строку. Крупное время карточки
 * с полноразмерным «AM» занимало всю ширину короткой карточки (имя клиента обрезалось до инициала), а на оси часов
 * переносилось на две строки (qa/full-test-0930/final-mock.md). 24 ч — строка без изменений.
 */
export function TimeText({
  value,
  suffixClassName,
  className,
  hourOnly,
}: {
  value: string;
  suffixClassName?: string;
  className?: string;
  /** Ось часов: «11:00 AM» → «11 AM» (ровный час без минут), чтобы подпись помещалась в узкую колонку часов */
  hourOnly?: boolean;
}) {
  const m = /^(.*?)\s?(AM|PM)$/.exec(value);
  if (!m) return <>{value}</>;
  const main = hourOnly ? m[1].replace(/:00$/, '') : m[1];
  return (
    <span className={cn('whitespace-nowrap', className)}>
      {main}
      <span className={cn('ml-0.5 font-semibold', suffixClassName)}>{m[2]}</span>
    </span>
  );
}
