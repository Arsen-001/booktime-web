'use client';

/**
 * Ревью 27.09 (И2): «работает ли» — последнее событие обмена, ошибки за 7 дней с причиной и «Отправить тест».
 * Одинаково в карточке приложения и в строке «Установлено». Ожидание теста — своё у каждого подключения.
 * Данные — поля AppInstall (lastEventAt, recentErrors, lastTest); сервер этих полей пока не отдаёт — тогда
 * показываем «нет данных», а не выдуманное «всё хорошо».
 */
import { Activity, AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { sendInstallTest } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import { recentInstallErrors, type AppInstall } from '@/domain/integrations';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { nowDateTime } from '@/lib/date';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Toast';

export interface InstallHealthProps {
  install: AppInstall;
  canTest: boolean;
  /** compact — строка «Установлено»: без списка ошибок, только число и последняя причина */
  compact?: boolean;
  className?: string;
}

export function InstallHealth({ install, canTest, compact = false, className }: InstallHealthProps) {
  const t = useT('integrations');
  const toast = useToast();
  const { date, time } = useFormat();
  const test = useApiMutation((installId: string) => sendInstallTest(installId));
  const errors = recentInstallErrors(install, nowDateTime(), 7);
  const at = (iso: string) => `${date(iso)} ${time(iso)}`;

  const onTest = async () => {
    try {
      const result = await test.mutate(install.id);
      if (result.ok) toast.success(t('health.testOk'));
      else toast.error(t('health.testFailed', { reason: t(`health.reason.${result.reason ?? 'partnerRejected'}` as never) }));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div className={cn('flex flex-col gap-2 text-sm', className)} data-install-health={install.id}>
      <p className="flex items-start gap-2 text-muted">
        <Activity className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {install.lastEventAt
            ? t('health.lastEvent', { kind: t(`health.kind.${install.lastEventKind ?? 'sync'}` as never), at: at(install.lastEventAt) })
            : t('health.noEvents')}
        </span>
      </p>
      <p className={cn('flex items-start gap-2', errors.length ? 'text-danger' : 'text-muted')}>
        {errors.length ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />}
        <span>
          {errors.length
            ? compact
              ? t('health.errorsCompact', { count: errors.length, reason: t(`health.reason.${errors[0].reason}` as never) })
              : t('health.errorsCount', { count: errors.length })
            : t('health.noErrors')}
        </span>
      </p>
      {!compact && errors.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg bg-danger-soft p-2.5 text-xs">
          {errors.slice(0, 5).map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-x-2 text-danger">
              <span>{t(`health.reason.${e.reason}` as never)}</span>
              <span className="text-muted">{at(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
      {install.lastTest && (
        <p className={cn('text-xs', install.lastTest.ok ? 'text-muted' : 'text-danger')}>
          {install.lastTest.ok
            ? t('health.lastTestOk', { at: at(install.lastTest.at) })
            : t('health.lastTestFailed', { at: at(install.lastTest.at), reason: t(`health.reason.${install.lastTest.reason ?? 'partnerRejected'}` as never) })}
        </p>
      )}
      {canTest && install.status === 'connected' && (
        <Button variant="secondary" size="sm" leftIcon={<Send aria-hidden />} loading={test.isPending} onClick={onTest} className="self-start">
          {t('health.testCta')}
        </Button>
      )}
    </div>
  );
}
