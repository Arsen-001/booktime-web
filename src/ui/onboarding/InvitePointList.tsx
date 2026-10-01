import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InvitePoint {
  icon: ReactNode;
  text: ReactNode;
}

export interface InvitePointListProps {
  title?: ReactNode;
  points: InvitePoint[];
  /** primary — «что увидит салон», success — «что останется вашим» */
  tone: 'primary' | 'success';
}

/** Столбик пунктов со значками для InviteCard: «Салон увидит…» / «Останется вашим…» */
export function InvitePointList({ title, points, tone }: InvitePointListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {title && <p className="text-sm font-medium text-muted">{title}</p>}
      <ul className="flex flex-col gap-2.5">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4',
                tone === 'primary' ? 'bg-primary-soft text-primary-text' : 'bg-success-soft text-success',
              )}
            >
              {point.icon}
            </span>
            <span className="pt-1 text-base leading-snug text-fg">{point.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
