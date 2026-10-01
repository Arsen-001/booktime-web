import type { ReactNode } from 'react';

/** Подпись и поле условия фильтра */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-fg">{label}</span>
      {children}
    </div>
  );
}
