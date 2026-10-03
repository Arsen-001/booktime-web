/**
 * Сборка срезов разделов. Файл фундамента — разделы его НЕ правят (правят только свой срез).
 */
import type { AreaId } from '@/config/areas';
import type { SliceDef } from '@/mock/slice';
import { clientSlice } from '@/mock/slices/client';
import { platformSlice } from '@/mock/slices/platform';
import { journalSlice } from '@/mock/slices/journal';
import { scheduleSlice } from '@/mock/slices/schedule';
import { onlineSlice } from '@/mock/slices/online';
import { clientsSlice } from '@/mock/slices/clients';
import { notifySlice } from '@/mock/slices/notify';
import { loyaltySlice } from '@/mock/slices/loyalty';
import { financeSlice } from '@/mock/slices/finance';
import { stockSlice } from '@/mock/slices/stock';
import { payrollSlice } from '@/mock/slices/payroll';
import { staffSlice } from '@/mock/slices/staff';
import { networkSlice } from '@/mock/slices/network';
import { reportsSlice } from '@/mock/slices/reports';
import { integrationsSlice } from '@/mock/slices/integrations';
import { settingsSlice } from '@/mock/slices/settings';
import { resourcesSlice } from '@/mock/slices/resources';
import { servicesSlice } from '@/mock/slices/services';
import { ordersSlice } from '@/mock/slices/orders';

export const SLICES = {
  client: clientSlice,
  platform: platformSlice,
  journal: journalSlice,
  schedule: scheduleSlice,
  online: onlineSlice,
  clients: clientsSlice,
  notify: notifySlice,
  loyalty: loyaltySlice,
  finance: financeSlice,
  stock: stockSlice,
  payroll: payrollSlice,
  staff: staffSlice,
  network: networkSlice,
  reports: reportsSlice,
  integrations: integrationsSlice,
  settings: settingsSlice,
  resources: resourcesSlice,
  services: servicesSlice,
  orders: ordersSlice,
} satisfies Record<AreaId, SliceDef<unknown>>;

type SliceState<T> = T extends SliceDef<infer S> ? S : never;

/** Состояние всех срезов: AreaStates['journal'] — тип среза журнала */
export type AreaStates = { [K in AreaId]: SliceState<(typeof SLICES)[K]> };
