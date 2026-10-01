import type { ReactNode } from 'react';

/** Секция формы клиента: заголовок и поля под ним с воздухом (ux-r2 улучшение 3 — не стена из 15 полей) */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}
