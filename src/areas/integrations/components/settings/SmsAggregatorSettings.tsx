'use client';

/**
 * F-13-155: общее подключение SMS-агрегатора — «Ключ авторизации» + «Имя отправителя SMS»; рассылки недоступны
 * до одобрения имени. F-13-141 (billsPerMessage-приложения используют MessageBalanceSettings отдельно): здесь
 * же демо-кнопка «Отправить тестовое сообщение» с предупреждением про проверку не на своём номере.
 * F-13-157…162/164 (MESSAGGIO, SMS.to, SMSPRO.KG, InterConnect Solutions, Apifonica, INTEL TELECOM, WAxSMS) —
 * все семь описаны в ТЗ отдельными карточками одного и того же генерального SMS-подключения; у нас они —
 * один каталожный партнёр «ГлобалSMS» (`smsAggregatorAuth: true`, см. src/mock/slices/integrations.ts) и
 * проходят через это же окно: ключ авторизации, имя отправителя, одобрение, тестовое сообщение.
 */
import { useState } from 'react';
import { Eye, EyeOff, Info, KeyRound } from 'lucide-react';
import {
  demoApproveSenderName,
  setSmsAggregatorAuth,
} from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import { useDemoControls } from '@/areas/integrations/hooks/useDemoControls';
import { canSendBulkSms, type AppInstall } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { IconButton } from '@/ui/IconButton';
import { useToast } from '@/ui/Toast';

export function SmsAggregatorSettings({
  install,
  onChange,
}: {
  install: AppInstall;
  onChange: () => void;
}) {
  const t = useT('integrations');
  const toast = useToast();
  // И4: сохранённый ключ в поле не возвращается никогда — сервер отдаёт только маску (••••1234);
  // «Заменить ключ» открывает пустое поле для нового
  const hasSavedKey = Boolean(install.authKey);
  const [replacingKey, setReplacingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [authKey, setAuthKey] = useState('');
  const [senderName, setSenderName] = useState(install.senderName ?? '');
  const editingKey = !hasSavedKey || replacingKey;

  const save = useApiMutation(() =>
    setSmsAggregatorAuth({ installId: install.id, authKey, senderName }),
  );
  const approve = useApiMutation(() => demoApproveSenderName(install.id));

  const status = install.senderNameStatus ?? 'none';
  const demo = useDemoControls();
  const canSend = canSendBulkSms(install);

  const onSave = async () => {
    try {
      await save.mutate(undefined);
      setAuthKey('');
      setReplacingKey(false);
      setShowKey(false);
      onChange();
      toast.success(t('app.settings.sms.submit'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onApprove = async () => {
    try {
      await approve.mutate(undefined);
      onChange();
      toast.success(t('app.settings.sms.statusApproved'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-155 F-13-157 F-13-158 F-13-159 F-13-160 F-13-161 F-13-162 F-13-164">
      <SectionCard title={t('app.settings.sms.title')}>
        <div className="flex flex-col gap-4">
          <FormField label={t('app.settings.sms.authKeyLabel')} hint={editingKey ? t('app.settings.sms.authKeyHint') : undefined}>
            {editingKey ? (
              <Input
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={authKey}
                onChange={(e) => setAuthKey(e.target.value)}
                className="font-mono"
                rightSlot={
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={showKey ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    label={showKey ? t('app.settings.sms.hideKey') : t('app.settings.sms.showKey')}
                    onClick={() => setShowKey((v) => !v)}
                  />
                }
              />
            ) : (
              <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3">
                <span className="flex items-center gap-2 font-mono text-sm text-fg">
                  <KeyRound className="h-4 w-4 text-muted" aria-hidden />
                  {install.authKey}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setReplacingKey(true)}>
                  {t('app.settings.sms.replaceKey')}
                </Button>
              </div>
            )}
          </FormField>
          <FormField
            label={t('app.settings.sms.senderNameLabel')}
            hint={t('app.settings.sms.senderNameHint')}
          >
            <Input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
            />
          </FormField>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                status === 'approved'
                  ? 'success'
                  : status === 'pending'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {t(
                `app.settings.sms.status${status === 'approved' ? 'Approved' : status === 'pending' ? 'Pending' : 'None'}` as never,
              )}
            </Badge>
            {status === 'pending' && demo && (
              <Button
                size="sm"
                variant="secondary"
                loading={approve.isPending}
                onClick={onApprove}
              >
                {t('app.settings.sms.approveDemo')}
              </Button>
            )}
          </div>

          <Button
            loading={save.isPending}
            onClick={onSave}
            disabled={(editingKey && !authKey.trim()) || !senderName.trim()}
            className="self-start"
          >
            {t('app.settings.sms.submit')}
          </Button>

          {!canSend && (
            <p className="flex items-start gap-1.5 rounded-lg bg-surface-2 p-3 text-sm text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t('app.settings.sms.blockedUntilApproved')}
            </p>
          )}

          <p className="text-xs text-muted">
            {t('app.settings.sms.testOwnNumberNote')}
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
