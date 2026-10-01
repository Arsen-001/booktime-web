'use client';

/**
 * F-13-178: Kommo/amoCRM — режим синхронизации статусов записи со сделкой и «искать дубли сделок».
 */
import { setKommoDedupe, setKommoSyncMode } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import { KOMMO_SYNC_MODES, type AppInstall, type KommoSyncMode } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

export function KommoSettings({
  install,
  onChange,
}: {
  install: AppInstall;
  onChange: () => void;
}) {
  const t = useT('integrations');
  const toast = useToast();
  const mode = install.kommoSyncMode ?? 'conditional';

  const setMode = useApiMutation((m: KommoSyncMode) =>
    setKommoSyncMode(install.id, m),
  );
  const setDedupe = useApiMutation((v: boolean) =>
    setKommoDedupe(install.id, v),
  );

  const onModeChange = async (value: string) => {
    try {
      await setMode.mutate(value as KommoSyncMode);
      onChange();
      toast.success(t('app.settings.kommo.savedToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onDedupeChange = async (value: boolean) => {
    try {
      await setDedupe.mutate(value);
      onChange();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-178" className="flex flex-col gap-4">
      <SectionCard
        title={t('app.settings.kommo.title')}
        description={t('app.settings.kommo.hint')}
      >
        <div className="flex flex-col gap-4">
          <Select
            value={mode}
            onValueChange={onModeChange}
            options={KOMMO_SYNC_MODES.map((m) => ({
              value: m,
              label: t(`app.settings.kommo.mode.${m}` as never),
            }))}
          />
          <Switch
            checked={install.kommoDedupe ?? false}
            onCheckedChange={onDedupeChange}
            label={t('app.settings.kommo.dedupeLabel')}
            description={t('app.settings.kommo.dedupeHint')}
          />
        </div>
      </SectionCard>
    </div>
  );
}
