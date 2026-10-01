'use client';

import { LockKeyhole } from 'lucide-react';
import type { PersonaId } from '@/demo/settings';
import { useApplyDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

export interface AccessDeniedProps {
  kind: 'biz' | 'platform';
}

/** Экран «нет доступа» для каркаса: в демо сразу предлагает сменить персону */
export function AccessDenied({ kind }: AccessDeniedProps) {
  const t = useT('common');
  const apply = useApplyDemo();
  const choices: { persona: PersonaId; label: string }[] =
    kind === 'biz'
      ? [
          { persona: 'owner', label: t('access.asOwner') },
          { persona: 'individual', label: t('access.asIndividual') },
        ]
      : [{ persona: 'platform', label: t('access.asPlatform') }];

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
        {/* Карточка уже с отступом p-6 — свой боковой отступ EmptyState на 360 px отнимал место у кнопок */}
        <EmptyState
          className="px-0"
          icon={<LockKeyhole className="size-8" />}
          title={t('access.title')}
          description={kind === 'biz' ? t('access.bizText') : t('access.platformText')}
          action={
            <div className="flex w-full flex-col gap-2">
              {choices.map((c, i) => (
                <Button
                  key={c.persona}
                  variant={i === 0 ? 'primary' : 'secondary'}
                  fullWidth
                  // Длинная подпись (hy «Մտնել որպես սրահի սեփականատեր») переносится, а не распирает карточку
                  className="h-auto min-h-11 py-2.5 whitespace-normal md:h-auto md:min-h-10"
                  onClick={() => apply({ persona: c.persona })}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          }
        />
      </div>
    </div>
  );
}
