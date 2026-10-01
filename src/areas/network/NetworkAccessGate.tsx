'use client';

/**
 * Сеть1: кабинет сети (/biz/network/**) несёт базу клиентов всех филиалов с суммами, рассылки, выгрузку и
 * аналитику — закрыт по прямому адресу без права network.manage, а не только скрыт в меню (src/config/nav.ts).
 * Открытым остаётся «Переключатель» (/biz/network/switch): там сотрудник видит свои филиалы и «вас не добавили»
 * (F-11-005). Подключается из src/app/biz/network/layout.tsx (по образцу FinanceAccessGate).
 */
import type { ReactNode } from 'react';
import { LockKeyhole, Plus, Trash2, Undo2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { restoreNetwork } from '@/api/network';
import { useApiMutation } from '@/api/request';
import { useNetwork } from '@/areas/network/lib/useNetwork';
import { useNetworkAccess } from '@/areas/network/lib/useNetworkAccess';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { useToast } from '@/ui/Toast';

/**
 * Решение владельца 01.10.2026: единственная сеть удалена — новая сама не заводится (ensureNetwork), а экраны
 * сети показывают одно пустое состояние: «Восстановить сеть» и «Создать сеть». Настройки (там своя плашка
 * восстановления по прямой ссылке), переключатель и создание сети открыты как обычно.
 */
function DeletedNetworkGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const t = useT('network');
  const toast = useToast();
  const { deleted, networkId, network } = useNetwork();
  const restore = useApiMutation((id: string) => restoreNetwork(id));
  const open = ['/biz/network/settings', '/biz/network/switch', '/biz/network/new'].some((p) => pathname.startsWith(p));
  if (!deleted || !networkId || open) return <>{children}</>;
  return (
    <div data-f="F-11-019 F-11-020" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 py-6">
      <EmptyState
        icon={<Trash2 aria-hidden />}
        title={t('deletedGate.title', { name: network?.name ?? '' })}
        description={t('deletedGate.body')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              leftIcon={<Undo2 aria-hidden />}
              loading={restore.isPending}
              onClick={async () => {
                try {
                  await restore.mutate(networkId);
                  toast.success(t('settings.restoreDone'));
                } catch {
                  toast.error(t('deletedGate.restoreFailed'));
                }
              }}
            >
              {t('settings.restoreAction')}
            </Button>
            <LinkButton href="/biz/network/new" variant="secondary" leftIcon={<Plus aria-hidden />}>
              {t('deletedGate.create')}
            </LinkButton>
          </div>
        }
      />
    </div>
  );
}

export function NetworkAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const canManage = useCan('network.manage');
  const isSwitch = pathname?.startsWith('/biz/network/switch') ?? false;
  const t = useT('ui');
  const access = useNetworkAccess();
  // Пока права пользователя сети читаются — страница как есть (у владельца они не нужны)
  if (!canManage && !isSwitch && access.loading) return null;
  // Сеть1 + 01.10.2026: вход — владельцу (network.manage) или пользователю сети; раздел — по его правам сети
  const newNetwork = pathname?.startsWith('/biz/network/new') ?? false;
  const allowed = isSwitch || (canManage ? true : access.member && !newNetwork && access.canSee(pathname ?? ''));

  if (!allowed) {
    return (
      <div data-testid="network-denied" className="grid min-h-[60dvh] place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <EmptyState icon={<LockKeyhole aria-hidden className="size-8" />} title={t('permission.denied')} description={t('permission.deniedHint')} />
        </div>
      </div>
    );
  }

  if (isSwitch) return <>{children}</>;
  return <DeletedNetworkGate>{children}</DeletedNetworkGate>;
}
