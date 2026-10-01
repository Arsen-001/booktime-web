"use client";

/**
 * Сеть текущего кабинета (F-11-001): у одиночного салона создаётся сама, из одной локации.
 * Все экраны /biz/network/** начинают с этого хука вместо прямого useCurrent().
 */
import { ensureNetwork, isNetworkDeleted } from "@/api/network";
import { useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { useDemoStore } from "@/demo/store";

export function useNetwork() {
  const current = useCurrent();
  const { ready, businessId } = current;
  // F-11-021: сеть, выбранная в переключателе, сильнее «первой сети» персоны
  const pickedNetworkId = useDemoStore((s) => s.networkId);
  const ctxNetworkId = pickedNetworkId ?? current.networkId;
  const q = useApiQuery(
    ["network", "ensure", businessId, ctxNetworkId],
    () => ensureNetwork(businessId!, ctxNetworkId),
    {
      enabled: ready && Boolean(businessId),
    },
  );
  const networkId = q.data?.id;
  // Решение владельца 01.10.2026: удалённая сеть не подменяется новой — экраны показывают «Восстановить / Создать»
  const deletedQ = useApiQuery(
    ["network", "deleted", networkId],
    () => isNetworkDeleted(networkId!),
    { enabled: Boolean(networkId) },
  );
  return {
    ...current,
    deleted: Boolean(deletedQ.data),
    ready: ready && Boolean(q.data),
    isLoading: ready && q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
    network: q.data,
    networkId: q.data?.id,
  };
}
