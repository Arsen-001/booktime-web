"use client";

/**
 * 01.10.2026 (решение владельца): права пользователя сети (F-11-029…035) реально режут кабинет сети —
 * пункты меню (BizShell → visibleNav, hiddenHrefs) и сами экраны (NetworkAccessGate).
 * Владелец (network.manage) видит всё; пользователь сети — только разделы своих галочек.
 */
import { useMemo } from "react";
import * as networkApi from "@/api/network";
import { getMyNetworkAccess } from "@/api/network";
import { useApiQuery } from "@/api/request";
import { useCan, useCurrent } from "@/demo/hooks";
import type { NetworkPermissionKey } from "@/domain/network";

// Только в разработке: проверяющие зовут API сети напрямую (qa/full-test-0930/network/j-*.mjs), чтобы убедиться,
// что права режет сама функция, а не только экран. В сборке для людей этого нет.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __bpNetworkApi?: typeof networkApi }).__bpNetworkApi = networkApi;
}

/** Раздел кабинета сети → право сети; самый длинный префикс важнее. Обзор и переключатель — без права. */
const SECTION_PERMISSIONS: [string, NetworkPermissionKey][] = [
  ["/biz/network/analytics", "analytics"],
  ["/biz/network/clients", "clients"],
  ["/biz/network/records", "records"],
  ["/biz/network/staff/payroll", "payroll"],
  ["/biz/network/staff", "staff"],
  ["/biz/network/services/subdivisions", "subdivisions"],
  ["/biz/network/services/migration", "migrations"],
  ["/biz/network/services", "services"],
  ["/biz/network/goods/migration", "migrations"],
  ["/biz/network/goods", "goods"],
  ["/biz/network/loyalty", "loyalty"],
  ["/biz/network/telephony", "telephony"],
  ["/biz/network/settings/users", "users"],
  ["/biz/network/settings/plans", "plans"],
  ["/biz/network/settings/fields", "fields"],
  ["/biz/network/settings", "settings"],
];

export function networkPermissionFor(pathname: string): NetworkPermissionKey | undefined {
  let best: [string, NetworkPermissionKey] | undefined;
  for (const entry of SECTION_PERMISSIONS) {
    const [prefix] = entry;
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && (!best || prefix.length > best[0].length)) best = entry;
  }
  return best?.[1];
}

export function useNetworkAccess() {
  const { ready, staffId, businessId } = useCurrent();
  const canManage = useCan("network.manage");
  const q = useApiQuery(
    ["network", "myAccess", staffId, businessId, canManage],
    () => getMyNetworkAccess(staffId, businessId, canManage),
    { enabled: ready },
  );
  return useMemo(() => {
    const permissions = new Set(q.data?.permissions ?? []);
    const member = canManage || Boolean(q.data?.member);
    const hiddenHrefs = new Set(
      SECTION_PERMISSIONS.filter(([, key]) => !permissions.has(key)).map(([href]) => href),
    );
    return {
      loading: !ready || q.isLoading,
      member,
      canSee: (pathname: string) => {
        const key = networkPermissionFor(pathname);
        return !key || permissions.has(key);
      },
      /** Адреса пунктов меню сети, которые пользователю сети закрыты */
      hiddenHrefs: member && !canManage ? hiddenHrefs : new Set<string>(),
    };
  }, [q.data, q.isLoading, ready, canManage]);
}
