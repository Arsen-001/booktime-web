'use client';

/**
 * F-13-181: FastSign — демо-заполнение анкеты клиентом; ответы «пишутся» в карточку клиента и запись, PDF с
 * подписью (в интерфейсе — счётчик заполненных анкет, без настоящих файлов).
 */
import { FileSignature } from 'lucide-react';
import { demoFillFastSignForm } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import type { AppInstall } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

export function FastSignSettings({
  install,
  onChange,
}: {
  install: AppInstall;
  onChange: () => void;
}) {
  const t = useT('integrations');
  const toast = useToast();
  const fillDemo = useApiMutation(() => demoFillFastSignForm(install.id));

  const onFill = async () => {
    try {
      await fillDemo.mutate(undefined);
      onChange();
      toast.success(t('app.settings.fastSign.filledToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-181" className="flex flex-col gap-4">
      <SectionCard
        title={t('app.settings.fastSign.title')}
        description={t('app.settings.fastSign.hint')}
      >
        <div className="flex flex-col gap-3">
          <p className="text-2xl font-semibold text-fg">
            {install.fastSignFilledCount ?? 0}
          </p>
          <p className="text-xs text-muted">
            {t('app.settings.fastSign.filledCountLabel')}
          </p>
          <Button
            variant="secondary"
            leftIcon={<FileSignature className="h-4 w-4" aria-hidden />}
            loading={fillDemo.isPending}
            onClick={onFill}
            className="self-start"
          >
            {t('app.settings.fastSign.fillDemoCta')}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
