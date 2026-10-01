'use client';

/**
 * Один из шести блоков схемы сотрудника (F-09-011): заголовок с переключателем, пояснение,
 * поля раскрываются только когда блок включён. Принадлежит разделу «payroll».
 */
import type { ReactNode } from 'react';
import { SectionCard } from '@/ui/SectionCard';
import { Switch } from '@/ui/Switch';

export interface BlockCardProps {
  title: ReactNode;
  description: ReactNode;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children?: ReactNode;
  dataF?: string;
}

export function BlockCard({ title, description, enabled, onEnabledChange, children, dataF }: BlockCardProps) {
  return (
    <div data-f={dataF}>
      <SectionCard
        title={title}
        description={description}
        actions={
          <Switch checked={enabled} onCheckedChange={onEnabledChange} aria-label={typeof title === 'string' ? title : undefined} />
        }
      >
        {enabled ? <div className="flex flex-col gap-4">{children}</div> : null}
      </SectionCard>
    </div>
  );
}
