'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isApiMode } from '@/api/http';
import { setApiIdentity, type ApiIdentity } from '@/api/identity';
import { syncCore } from '@/api/mirror';
import { startLive } from '@/api/live.server';
import { usePlatformSession, useSession, type SessionMembership, type SessionView } from '@/api/session';
import type { Permission } from '@/config/permissions';
import { useApplyDemo, useDemo } from '@/demo/hooks';
import type { PersonaId } from '@/demo/settings';

/**
 * Живой сайт (режим api, PLAN.md §8.2): «кто я» — от сессии сервера, а не от демо-переключателя.
 * Экраны пока читают персону (useDemo/useCurrent), поэтому мост переводит сессию в персону:
 *   нет сессии → guest; «Я клиент» → client (appUser = id человека); «Мой бизнес» → роль в выбранном бизнесе;
 *   на /platform — сессия команды платформы (своя cookie) → platform.
 * Без сессии кабинет /biz ведёт на /login, панель — на /platform/login (proxy.ts ловит это раньше, здесь —
 * истёкшая или отозванная сессия). В демо-сборке (mock) ничего не делает.
 *
 * Бизнес, сотрудник, филиалы и права — из членства (этап 3): мост кладёт их в ApiIdentity и зеркалит свой бизнес с
 * сервера в ядро браузера (src/api/mirror.ts), чтобы разделы, ещё работающие с моковой базой, видели те же данные.
 * Бизнеса у человека нет — кабинет ведёт на регистрацию бизнеса, а не в демо-бизнес.
 */
function activeMembership(session: SessionView | null): SessionMembership | undefined {
  if (!session || session.mode === 'client') return undefined;
  return session.memberships.find((m) => m.businessId === session.activeBusinessId) ?? session.memberships[0];
}

function identityOf(m: SessionMembership | undefined): ApiIdentity | null {
  if (!m) return null;
  return {
    businessId: m.businessId,
    staffId: m.staffId,
    networkId: m.networkId ?? undefined,
    businessIds: m.businessIds?.length ? m.businessIds : [m.businessId],
    locationIds: m.locationIds ?? [],
    permissions: (m.permissions ?? []) as Permission[],
  };
}

function personaOfSession(session: SessionView | null): { persona: PersonaId; appUser: string } {
  if (!session) return { persona: 'guest', appUser: '' };
  if (session.mode === 'client') return { persona: 'client', appUser: session.user.id };
  const active = activeMembership(session);
  if (!active) return { persona: 'client', appUser: session.user.id }; // бизнеса нет — кабинет ведёт на регистрацию
  if (session.staffLogin) return { persona: 'admin', appUser: '' };
  if (active.role === 'admin') return { persona: 'admin', appUser: '' };
  if (active.role === 'master') return { persona: 'master', appUser: '' };
  if (active.networkId) return { persona: 'network', appUser: '' };
  return { persona: active.kind === 'individual' ? 'individual' : 'owner', appUser: '' };
}

export function SessionBridge() {
  const api = isApiMode();
  const pathname = usePathname();
  const router = useRouter();
  const apply = useApplyDemo();
  const { persona, appUser } = useDemo();
  const onPlatform = pathname.startsWith('/platform');
  const session = useSession();
  const platform = usePlatformSession();

  const q = onPlatform ? platform : session;
  const loaded = api && !q.isLoading && !q.isError;
  const membership = loaded && !onPlatform ? activeMembership(session.data ?? null) : undefined;
  const noBusiness = Boolean(loaded && !onPlatform && session.data && session.data.mode === 'business' && !membership);
  const identityJson = JSON.stringify(identityOf(membership));
  const mirrorFor = membership?.businessId;
  const target: { persona: PersonaId; appUser: string } | undefined = !loaded
    ? undefined
    : onPlatform
      ? { persona: platform.data ? 'platform' : 'guest', appUser: '' }
      : personaOfSession(session.data ?? null);

  // Сначала — «кто я» (права и бизнес от сервера), затем персона: экраны не успевают увидеть демо-бизнес
  // Сервер не ответил — «кто я» неизвестен, но экраны не должны ждать вечно: покажут свои ошибки запросов
  const failed = api && q.isError;
  useEffect(() => {
    if (!api || !(loaded || failed)) return;
    setApiIdentity(JSON.parse(identityJson) as ApiIdentity | null);
  }, [api, loaded, failed, identityJson]);

  useEffect(() => {
    if (!mirrorFor) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    syncCore(mirrorFor)
      .then(() => {
        // Чужие правки записей и графика — событиями SSE (этап 7): зеркало перечитывается само
        if (!cancelled) stop = startLive(mirrorFor, JSON.parse(identityJson)?.businessIds ?? [mirrorFor]);
      })
      .catch(() => {
        /* сервер недоступен — экраны покажут свою ошибку на своих запросах */
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [mirrorFor, identityJson]);

  useEffect(() => {
    if (!target) return;
    if (target.persona !== persona || target.appUser !== appUser) apply(target);
    if (onPlatform && target.persona === 'guest' && pathname !== '/platform/login') router.replace('/platform/login');
    if (!onPlatform && target.persona === 'guest' && pathname.startsWith('/biz')) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
    // Вошёл «Мой бизнес», а бизнеса нет — регистрация бизнеса (приглашение в салон принимается на своём экране)
    if (noBusiness && pathname.startsWith('/biz') && !pathname.startsWith('/biz/onboarding/invite')) router.replace('/register-business');
  }, [target?.persona, target?.appUser, pathname, noBusiness]);

  return null;
}
