"use client";

/**
 * Права раздела «payroll» (F-09-085…089). Принадлежит разделу.
 * Комбинирует базовое `payroll.view`/`payroll.manage` (фундамент) с override по сотруднику,
 * который владелец задаёт в /biz/payroll/settings (см. `resolvePayrollAccess` в api/payroll.ts).
 * Запрос об отдельных правах в src/config/permissions.ts — qa/requests/payroll.md.
 */
import { useMemo } from "react";
import {
  listPayrollRights,
  resolvePayrollAccess,
  type ResolvedPayrollAccess,
} from "@/api/payroll";
import { useApiQuery } from "@/api/request";
import { useCan, useCurrent } from "@/demo/hooks";
import { today } from "@/lib/date";

export function usePayrollAccess(): ResolvedPayrollAccess & { ready: boolean } {
  const { ready, persona, staffId, businessId } = useCurrent();
  const q = useApiQuery(
    ["payroll", "rights", businessId],
    () => listPayrollRights(businessId!),
    {
      enabled: ready && Boolean(businessId),
    },
  );
  // Решение владельца 01.10.2026: без payroll.view / payroll.manage (у администратора по умолчанию их нет)
  // сотрудник видит только свою зарплату — даже если в «Основных настройках» ему открыт расчёт.
  const canView = useCan("payroll.view");
  const canManage = useCan("payroll.manage");
  const canSeePayroll = canView || canManage;
  return useMemo(() => {
    const access = resolvePayrollAccess(persona, staffId, q.data ?? {}, canSeePayroll);
    return { ...access, ready: ready && !q.isLoading };
  }, [persona, staffId, q.data, q.isLoading, ready, canSeePayroll]);
}

/** F-09-086/094: дата разрешена при «только текущий день» — единственная допустимая дата — сегодня */
export function isDateAllowed(
  scope: "none" | "today" | "all",
  date: string,
): boolean {
  if (scope === "none") return false;
  if (scope === "today") return date === today();
  return true;
}
