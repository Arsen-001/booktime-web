import type { ReactNode } from 'react';

export interface RevealProps {
  /** Идёт загрузка — показываем skeleton */
  loading: boolean;
  /** Заглушка в форме содержимого (Skeleton, SkeletonList) */
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Скелетон → содержимое: пока loading — заглушка, потом содержимое на её месте сразу, без проявления. Проявление
 * из прозрачности — это кадр пустого места между скелетом и данными, глаз видит его как мигание (owner 30.09.2026).
 * Скелет должен совпадать с содержимым (DESIGN.md → «The skeleton IS the page») — тогда смена незаметна.
 *
 *   <Reveal loading={q.isLoading} skeleton={<SkeletonList rows={5} />}><ClientsList items={q.data} /></Reveal>
 */
export function Reveal({ loading, skeleton, children, className }: RevealProps) {
  if (loading) return <>{skeleton}</>;
  return <div className={className}>{children}</div>;
}
