'use client';

/** F-13-036: «Доступ к API» — системный пользователь (User ID) и его права; после сохранения — User token. */
import { useState } from 'react';
import { updateDevAppApiAccess } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import { CopyRow } from '@/areas/integrations/components/CopyRow';
import { maskToken, REQUESTED_SCOPES, type DevApp } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

export function ApiAccessTab({ app, onChanged }: { app: DevApp; onChanged: () => void }) {
  const t = useT('integrations');
  const toast = useToast();
  const [systemUserId, setSystemUserId] = useState(app.apiAccess.systemUserId ?? '');
  const [permissions, setPermissions] = useState<string[]>(app.apiAccess.permissions);
  // Ревью 27.09: токен целиком — только сразу после выпуска; дальше маска без «Копировать»
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const mutation = useApiMutation((input: { systemUserId: string; permissions: string[] }) => updateDevAppApiAccess(app.id, input));

  const toggle = (scope: string) => setPermissions((prev) => (prev.includes(scope) ? prev.filter((p) => p !== scope) : [...prev, scope]));

  const save = async () => {
    try {
      const before = app.apiAccess.userToken;
      const updated = await mutation.mutate({ systemUserId, permissions });
      const token = updated.apiAccess.userToken;
      if (token && token !== before) setFreshToken(token);
      toast.success(t('developers.apiAccess.saved'));
      onChanged();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-036 F-13-060" className="flex flex-col gap-4">
      <SectionCard title={t('developers.apiAccess.userTitle')} description={t('developers.apiAccess.userHint')}>
        <div className="flex flex-col gap-4">
          <FormField label={t('developers.apiAccess.userIdLabel')} optional hint={t('developers.apiAccess.userIdHint')}>
            <Input value={systemUserId} onChange={(e) => setSystemUserId(e.target.value)} className="font-mono" placeholder="1234" />
          </FormField>
          {freshToken ? (
            <CopyRow label={t('developers.apiAccess.tokenLabel')} value={freshToken} hint={t('api.keys.revealText')} />
          ) : (
            app.apiAccess.userToken && (
              <CopyRow label={t('developers.apiAccess.tokenLabel')} value={maskToken(app.apiAccess.userToken)} copyable={false} hint={t('api.keys.shownOnce')} />
            )
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('developers.apiAccess.permissionsTitle')} description={t('developers.apiAccess.permissionsHint')}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {REQUESTED_SCOPES.map((scope) => (
            <Checkbox key={scope} checked={permissions.includes(scope)} onCheckedChange={() => toggle(scope)} label={t(`developers.apiAccess.scope.${scope}`)} />
          ))}
        </div>
      </SectionCard>

      <Button loading={mutation.isPending} onClick={save} className="self-start">
        {t('developers.apiAccess.save')}
      </Button>
    </div>
  );
}
