'use client';

/**
 * Строка «Установлено» (F-13-007, F-13-018, F-13-021, F-13-043, F-13-173). Ревью 27.09: у каждой строки свои
 * ожидания — «Отключить» крутит только свою кнопку, и перед отключением спрашиваем (И3); статус на телефоне —
 * под названием, а не сжимает его (И17); «работает ли» — InstallHealth (И2); демо-кнопки — только на моковой базе (И1).
 */
import Link from 'next/link';
import { Send } from 'lucide-react';
import { demoActivatePartner, demoPayPartnerSubscription, disconnectApp, type InstalledRow } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import { APP_ICON, appIconKey, appTileTone } from '@/areas/integrations/catalog';
import { InstallHealth } from '@/areas/integrations/components/InstallHealth';
import { InstallStatusBadge } from '@/areas/integrations/components/InstallStatusBadge';
import { useDemoControls } from '@/areas/integrations/hooks/useDemoControls';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useConfirm, useToast } from '@/ui/Toast';

export function InstalledRowCard({ row, can }: { row: InstalledRow; can: boolean }) {
  const { install, app } = row;
  const t = useT('integrations');
  const toast = useToast();
  const confirm = useConfirm();
  const demo = useDemoControls();
  const { date } = useFormat();
  const Icon = APP_ICON[appIconKey(app)];
  const tile = appTileTone(app.id);

  const activate = useApiMutation((installId: string) => demoActivatePartner(installId));
  const pay = useApiMutation((installId: string) => demoPayPartnerSubscription(installId));
  const disconnect = useApiMutation((installId: string) => disconnectApp(installId));

  const run = async (action: () => Promise<unknown>, okKey: string) => {
    try {
      await action();
      toast.success(t(okKey as never));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const pending = install.status === 'pendingActivation';

  const onDisconnect = async () => {
    const ok = await confirm({
      title: pending ? t('app.cancelConfirm.title') : t('app.disconnectConfirm.title'),
      description: pending ? t('app.cancelConfirm.text') : t('app.disconnectConfirm.text'),
      tone: 'danger',
      confirmLabel: pending ? t('app.cancelConfirm.confirm') : t('app.disconnectConfirm.confirm'),
    });
    if (!ok) return;
    await run(() => disconnect.mutate(install.id), pending ? 'app.cancelConfirm.doneToast' : 'installed.disconnectedToast');
  };

  return (
    <Card as="li" className="flex flex-col gap-3" data-installed-row={install.id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <Link href={`/biz/integrations/apps/${app.id}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-1">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: tile.fill, color: tile.ink }} aria-hidden>
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-left text-sm font-semibold text-fg underline decoration-border-strong underline-offset-2">{app.name}</span>
            <span className="block text-xs text-muted">{app.subtitle}</span>
          </span>
        </Link>
        <InstallStatusBadge status={install.status} wrap className="self-start sm:ml-auto" />
      </div>

      {install.status === 'connected' && !app.builtin && <InstallHealth install={install} canTest={can} compact className="rounded-lg bg-surface-2 p-3" />}

      {install.status === 'connected' && install.paidUntil && (
        <p className="text-xs text-muted" data-f="F-13-043">
          {t('app.payments.paidUntil')}: {date(install.paidUntil, 'long')}
        </p>
      )}

      {pending && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted">{t('installed.pendingHint')}</span>
          {can && demo && (
            <Button size="sm" variant="ghost" loading={activate.isPending} onClick={() => run(() => activate.mutate(install.id), 'installed.activatedToast')}>
              {t('installed.demoActivate')}
            </Button>
          )}
        </div>
      )}

      {(install.status === 'autoDisconnected' || (install.status === 'error' && install.errorText === 'partnerSubscriptionUnpaid')) && (
        <div className="flex flex-col gap-2 rounded-lg bg-danger-soft p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-danger">{t('installed.unpaidHint')}</span>
          {can && demo && (
            <Button size="sm" variant="secondary" loading={pay.isPending} onClick={() => run(() => pay.mutate(install.id), 'installed.paidToast')}>
              {t('installed.demoPay')}
            </Button>
          )}
        </div>
      )}

      {install.status === 'error' && install.errorText === 'activationExpired' && (
        <div className="flex flex-col gap-2 rounded-lg bg-danger-soft p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-danger">{t('installed.expiredHint')}</span>
          <LinkButton href={`/biz/integrations/apps/${app.id}`} size="sm" variant="secondary">
            {t('installed.reconnect')}
          </LinkButton>
        </div>
      )}

      {can && !app.builtin && install.status !== 'error' && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-danger" loading={disconnect.isPending} onClick={onDisconnect}>
            {pending ? t('app.cancelConnect') : t('installed.disconnect')}
          </Button>
        </div>
      )}
      {app.builtin && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted" data-f="F-13-173">
          <span>{t('installed.builtinHint')}</span>
          <Link href={app.builtinHref ?? '/biz/online'} className="inline-flex min-h-11 items-center underline decoration-border-strong underline-offset-2">
            {t('installed.builtinLink')}
          </Link>
        </div>
      )}
    </Card>
  );
}

/** Вид строки в скелетоне: встроенное (без «Отключить»), ждёт активации, подключено */
export type InstalledRowSkeletonVariant = 'builtin' | 'pending' | 'connected';

/**
 * Скелетон строки «Установлено» — та же разметка, что строка своего вида: значок 40 px, название и подзаголовок,
 * статус; у встроенного — строка «Всегда включено…», у ждущего — плашка активации, у подключённого — блок «работает
 * ли» и «Отключить». В демо первыми идут встроенные, затем ждущее активации, затем подключённые.
 */
export function InstalledRowCardSkeleton({ can, variant = 'connected' }: { can: boolean; variant?: InstalledRowSkeletonVariant }) {
  const t = useT('integrations');
  const demo = useDemoControls();
  return (
    <Card as="li" className="flex flex-col gap-3" aria-hidden>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <span className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-1">
          <Skeleton variant="rect" className="h-10 w-10 shrink-0 rounded-xl" />
          <span className="min-w-0 flex-1">
            <span className="block text-left text-sm font-semibold text-fg">
              <SkeletonText width="16ch" />
            </span>
            <span className="block text-xs text-muted">
              {variant === 'pending' ? (
                // Рядом с длинным статусом подзаголовок переносится — но только когда статус справа (от sm)
                <>
                  <span className="sm:hidden">
                    <SkeletonText width="30ch" />
                  </span>
                  <span className="hidden sm:block">
                    <Skeleton lines={2} />
                  </span>
                </>
              ) : (
                <SkeletonText width="30ch" />
              )}
            </span>
          </span>
        </span>
        <Badge tone="neutral" className="h-auto min-h-7 max-w-full self-start rounded-xl py-1 sm:ml-auto">
          <SkeletonText width={variant === 'pending' ? '22ch' : '10ch'} />
        </Badge>
      </div>

      {variant === 'builtin' && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
          <span>{t('installed.builtinHint')}</span>
          <span className="inline-flex min-h-11 items-center underline decoration-border-strong underline-offset-2">{t('installed.builtinLink')}</span>
        </div>
      )}

      {variant === 'pending' && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted">{t('installed.pendingHint')}</span>
          {can && demo && (
            <Button size="sm" variant="ghost" disabled tabIndex={-1}>
              {t('installed.demoActivate')}
            </Button>
          )}
        </div>
      )}

      {variant === 'connected' && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3 text-sm">
          <p className="flex items-start gap-2 text-muted">
            <span className="mt-0.5 h-4 w-4 shrink-0" />
            <SkeletonText width="34ch" />
          </p>
          <p className="flex items-start gap-2 text-muted">
            <span className="mt-0.5 h-4 w-4 shrink-0" />
            <SkeletonText width="18ch" />
          </p>
          {can && (
            <Button variant="secondary" size="sm" leftIcon={<Send aria-hidden />} disabled tabIndex={-1} className="self-start">
              {t('health.testCta')}
            </Button>
          )}
        </div>
      )}

      {can && variant !== 'builtin' && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-danger" disabled tabIndex={-1}>
            {variant === 'pending' ? t('app.cancelConnect') : t('installed.disconnect')}
          </Button>
        </div>
      )}
    </Card>
  );
}
