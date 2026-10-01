'use client';

/**
 * F-13-142 (Coexistence, свой номер) / F-13-143 (через нас, номер по умолчанию или свой): выбор номера
 * отправителя WhatsApp; пока Meta не одобрила три базовых шаблона — интеграция не активна, и это видно.
 */
import { Info } from 'lucide-react';
import {
  demoApproveMetaTemplates,
  setWhatsappNumberMode,
} from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import type { AppInstall } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

export function WhatsappNumberSettings({
  install,
  onChange,
}: {
  install: AppInstall;
  onChange: () => void;
}) {
  const t = useT('integrations');
  const toast = useToast();
  const mode = install.whatsappNumberMode ?? 'default';
  const approved =
    mode === 'default' ? true : Boolean(install.metaTemplatesApproved);

  const setMode = useApiMutation((next: 'default' | 'own') =>
    setWhatsappNumberMode(install.id, next),
  );
  const approve = useApiMutation(() => demoApproveMetaTemplates(install.id));

  const onModeChange = async (value: string) => {
    try {
      await setMode.mutate(value as 'default' | 'own');
      onChange();
      toast.success(t('app.settings.whatsapp.numberSavedToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onApprove = async () => {
    try {
      await approve.mutate(undefined);
      onChange();
      toast.success(t('app.settings.whatsapp.approvedToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-142 F-13-143">
      <SectionCard title={t('app.settings.whatsapp.numberModeLabel')}>
        <div className="flex flex-col gap-4">
          <ChoiceGroup
            value={mode}
            onValueChange={onModeChange}
            options={[
              {
                value: 'default',
                title: t('app.settings.whatsapp.numberDefault'),
              },
              { value: 'own', title: t('app.settings.whatsapp.numberOwn') },
            ]}
          />

          {!approved ? (
            <div className="flex flex-col gap-2 rounded-lg bg-warning-soft p-3">
              <p className="flex items-start gap-1.5 text-sm text-warning">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t('app.settings.whatsapp.notActiveBanner')}
              </p>
              <Button
                size="sm"
                variant="secondary"
                loading={approve.isPending}
                onClick={onApprove}
                className="self-start"
              >
                {t('app.settings.whatsapp.approveTemplatesDemo')}
              </Button>
            </div>
          ) : (
            <Badge tone="success" className="self-start">
              {t('status.connected')}
            </Badge>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
