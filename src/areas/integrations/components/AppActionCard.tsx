'use client';

/**
 * Карточка «статус и действие» справа в карточке приложения (F-13-018, F-13-020, F-13-021, F-13-023).
 * Ревью 27.09: пока ждём активации — «Отменить подключение», демо-активация только на моковой базе (И1);
 * у «Скоро» — «Сообщить мне» вместо мёртвой кнопки (И7); у встроенного — «Открыть» (И10);
 * «работает ли» — InstallHealth (И2); длинный статус переносится внутри значка (И16).
 */
import { ArrowRight, CheckCircle2, Info } from 'lucide-react';
import {
  applyToPartner,
  demoActivatePartner,
  demoPayPartnerSubscription,
  disconnectApp,
  hasAppliedToPartner,
  isSubscribedToCategory,
  subscribeToCategory,
} from '@/api/integrations';
import { useApiMutation, useApiQuery } from '@/api/request';
import { InstallHealth } from '@/areas/integrations/components/InstallHealth';
import { InstallStatusBadge } from '@/areas/integrations/components/InstallStatusBadge';
import { SCOPE_ORDER } from '@/areas/integrations/catalog';
import { useDemoControls } from '@/areas/integrations/hooks/useDemoControls';
import { useCurrent } from '@/demo/hooks';
import { isInstallLive, type AppInstall, type CatalogApp } from '@/domain/integrations';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { useConfirm, useToast } from '@/ui/Toast';

export interface AppActionCardProps {
  app: CatalogApp;
  install?: AppInstall;
  /** Есть право integrations.manage */
  can: boolean;
  /** Эта персона может подключить это приложение (ownerOnly) */
  canConnectApp: boolean;
  onConnect: () => void;
}

export function AppActionCard({ app, install, can, canConnectApp, onConnect }: AppActionCardProps) {
  const t = useT('integrations');
  const toast = useToast();
  const confirm = useConfirm();
  const demo = useDemoControls();
  const { date } = useFormat();
  const { ready, businessId } = useCurrent();
  const comingSoon = app.price.model === 'comingSoon';

  const activate = useApiMutation((installId: string) => demoActivatePartner(installId));
  const pay = useApiMutation((installId: string) => demoPayPartnerSubscription(installId));
  const disconnect = useApiMutation((installId: string) => disconnectApp(installId));
  const appliedQ = useApiQuery(['integrations', 'appliedToPartner', app.id, businessId], () => hasAppliedToPartner(app.id, businessId!), {
    enabled: ready && Boolean(businessId) && Boolean(app.partnerApplicationOnly),
  });
  const apply = useApiMutation(() => applyToPartner(app.id, businessId!));
  const subQ = useApiQuery(['integrations', 'subscribed', businessId, app.categoryId], () => isSubscribedToCategory(businessId!, app.categoryId), {
    enabled: ready && Boolean(businessId) && comingSoon,
  });
  const subscribe = useApiMutation(() => subscribeToCategory(businessId!, app.categoryId));

  const run = async (action: () => Promise<unknown>, okKey: string) => {
    try {
      await action();
      toast.success(t(okKey as never));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const handleDisconnect = async () => {
    if (!install) return;
    const pending = install.status === 'pendingActivation';
    const ok = await confirm({
      title: pending ? t('app.cancelConfirm.title') : t('app.disconnectConfirm.title'),
      description: pending ? t('app.cancelConfirm.text') : t('app.disconnectConfirm.text'),
      tone: 'danger',
      confirmLabel: pending ? t('app.cancelConfirm.confirm') : t('app.disconnectConfirm.confirm'),
    });
    if (!ok) return;
    await run(() => disconnect.mutate(install.id), pending ? 'app.cancelConfirm.doneToast' : 'installed.disconnectedToast');
  };

  const isLive = install ? isInstallLive(install.status) : false;
  const pending = install?.status === 'pendingActivation';
  const unpaid = install && (install.status === 'autoDisconnected' || install.status === 'error');

  return (
    <Card data-f="F-13-018 F-13-020 F-13-021 F-13-023" className="flex min-w-0 flex-col gap-3">
      {install && <InstallStatusBadge status={install.status} wrap className="self-start" />}
      {pending && <p className="text-sm text-muted">{t('installed.pendingHint')}</p>}

      {app.builtin ? (
        <>
          <p className="text-sm text-muted">{t('app.builtinAlways')}</p>
          {app.builtinHref && (
            <LinkButton href={app.builtinHref} fullWidth rightIcon={<ArrowRight aria-hidden />}>
              {t('app.openBuiltin')}
            </LinkButton>
          )}
        </>
      ) : !can ? (
        <p className="text-sm text-muted">{t('app.noPermission')}</p>
      ) : !canConnectApp ? (
        <p className="text-sm text-muted">{t('app.ownerOnlyHint')}</p>
      ) : pending && install ? (
        <>
          <Button variant="secondary" fullWidth loading={disconnect.isPending} onClick={handleDisconnect}>
            {t('app.cancelConnect')}
          </Button>
          {demo && (
            <Button variant="ghost" size="sm" loading={activate.isPending} onClick={() => run(() => activate.mutate(install.id), 'installed.activatedToast')}>
              {t('installed.demoActivate')}
            </Button>
          )}
        </>
      ) : unpaid && install ? (
        demo ? (
          <Button variant="secondary" fullWidth loading={pay.isPending} onClick={() => run(() => pay.mutate(install.id), 'installed.paidToast')}>
            {t('installed.demoPay')}
          </Button>
        ) : (
          <p className="text-sm text-danger">{t('installed.unpaidHint')}</p>
        )
      ) : isLive && install ? (
        <Button variant="secondary" fullWidth loading={disconnect.isPending} onClick={handleDisconnect}>
          {t('installed.disconnect')}
        </Button>
      ) : app.connectedBySupport ? (
        <Button fullWidth variant="secondary" data-f="F-13-163" onClick={() => toast.success(t('app.connectedBySupportToast'))}>
          {t('app.connectedBySupportCta')}
        </Button>
      ) : app.partnerApplicationOnly ? (
        <Button
          fullWidth
          variant="secondary"
          data-f="F-13-137"
          loading={apply.isPending}
          disabled={Boolean(appliedQ.data)}
          onClick={() => run(() => apply.mutate(undefined), 'app.applyToPartner.appliedToast')}
        >
          {appliedQ.data ? t('app.applyToPartner.appliedCta') : t('app.applyToPartner.cta')}
        </Button>
      ) : comingSoon ? (
        subQ.data ? (
          <Badge tone="success" className="self-start">
            {t('category.comingSoon.subscribedBadge')}
          </Badge>
        ) : (
          <Button fullWidth variant="secondary" loading={subscribe.isPending} onClick={() => run(() => subscribe.mutate(undefined), 'category.comingSoon.subscribed')}>
            {t('app.notifyMe')}
          </Button>
        )
      ) : (
        <Button fullWidth leftIcon={<CheckCircle2 aria-hidden />} onClick={onConnect}>
          {t('app.connectCta')}
        </Button>
      )}

      {comingSoon && !subQ.data && <p className="text-xs text-muted">{t('app.notifyMeHint')}</p>}

      {app.partnerApplicationOnly && (
        <p className="text-xs text-muted" data-f="F-13-137">
          {t('app.applyToPartner.hint')}
        </p>
      )}

      {app.connectedBySupport && (
        <p className="text-xs text-muted" data-f="F-13-163">
          {t('app.connectedBySupportHint')}
        </p>
      )}

      {app.worksOnTrial === false && (
        <p className="flex items-start gap-1.5 text-xs text-muted" data-f="F-13-212">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('app.notOnTrial')}
        </p>
      )}

      {install && install.status === 'connected' && !app.builtin && (
        <div className="flex flex-col gap-2 border-t border-border pt-3" data-f="F-13-017">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('health.title')}</p>
          <InstallHealth install={install} canTest={can} />
          <p className="text-xs text-muted">
            {t('app.settings.connectedAt')}: {date(install.activatedAt ?? install.connectedAt, 'long')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SCOPE_ORDER.filter((s) => install.grantedScopes.includes(s)).map((scope) => (
              <Badge key={scope} variant="soft" size="sm" className="h-auto whitespace-normal py-0.5">
                {t(`connect.permissions.scopes.${scope}` as never)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
