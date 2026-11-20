'use client';

/**
 * «Вход закрыт: адрес не салона» (F-10-091, ответ 22, 20.11.2026) — вместо кабинета, когда у сотрудника стоит «Вход только
 * с IP салона», а он открыл кабинет не из интернета салона. Не пустая страница и не «нет доступа»: адрес, почему закрыто
 * и что делать — владелец добавляет этот адрес одной кнопкой (карточка сотрудника → «Доступ и уведомления»).
 *
 * Откуда «закрыто»: режим api — blockedIp членства в «кто я» сервера (GET /v1/auth/session; сервер проверяет адрес и на
 * каждом запросе кабинета — 403 ip_not_allowed перечитывает «кто я», src/api/request.ts); демо — getCabinetIpBlock()
 * (адрес браузера в демо — DEMO_CLIENT_IP). «Проверить снова» перечитывает то же.
 */
import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { isApiMode } from '@/api/http';
import { useApiQuery } from '@/api/request';
import { useSession } from '@/api/session';
import { getCabinetIpBlock } from '@/api/staff';
import { useCurrent } from '@/demo/hooks';
import { activeMembership } from '@/demo/SessionBridge';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

interface SalonIpBlock {
  ip: string | null;
  recheck: () => void;
  checking: boolean;
}

function useSalonIpBlock(): SalonIpBlock {
  const api = isApiMode();
  const session = useSession();
  const { ready, persona, businessId, staffId } = useCurrent();
  const demo = useApiQuery(['staff', 'cabinetIpBlock', persona, businessId, staffId], getCabinetIpBlock, { enabled: !api && ready });
  if (api) {
    const m = activeMembership(session.data ?? null);
    return { ip: m?.blockedIp ?? null, recheck: () => void session.refetch(), checking: session.isFetching };
  }
  return { ip: demo.data ?? null, recheck: () => void demo.refetch(), checking: demo.isFetching };
}

export function SalonIpGate({ children }: { children: ReactNode }) {
  const block = useSalonIpBlock();
  if (!block.ip) return <>{children}</>;
  return <SalonIpBlocked ip={block.ip} onRecheck={block.recheck} checking={block.checking} />;
}

function SalonIpBlocked({ ip, onRecheck, checking }: { ip: string; onRecheck: () => void; checking: boolean }) {
  const t = useT('staff');
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] place-items-center bg-bg px-4 py-10" data-f="F-10-091">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm" role="alert">
        <EmptyState
          className="px-0"
          icon={<ShieldAlert className="size-8" />}
          title={t('salonIpBlocked.title')}
          description={t('salonIpBlocked.text', { ip })}
          action={
            <div className="flex w-full flex-col gap-3">
              <p className="text-sm text-muted">{t('salonIpBlocked.ownerHint')}</p>
              <div className="flex w-full flex-col gap-2">
                <Button
                  variant="primary"
                  fullWidth
                  loading={checking}
                  onClick={onRecheck}
                  className="h-auto min-h-11 py-2.5 whitespace-normal md:h-auto md:min-h-10"
                >
                  {t('salonIpBlocked.recheck')}
                </Button>
                <LinkButton href="/" variant="secondary" fullWidth className="h-auto min-h-11 py-2.5 whitespace-normal md:h-auto md:min-h-10">
                  {t('salonIpBlocked.toHome')}
                </LinkButton>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
