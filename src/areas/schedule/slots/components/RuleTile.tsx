import type { ReactNode } from 'react';

/** Плитка правила «Шаг записи: 30 мин» — сводка правила окон (F-02-044) */
export function RuleTile({ label, value, muted = false }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-sm text-muted">{label}</p>
      <p className={muted ? 'mt-0.5 truncate text-sm font-medium text-muted' : 'mt-0.5 truncate text-sm font-semibold text-fg'}>{value}</p>
    </div>
  );
}
