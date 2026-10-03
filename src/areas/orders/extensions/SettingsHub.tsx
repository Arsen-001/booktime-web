'use client';

/**
 * Вклад раздела «Заказы» в хаб настроек /biz/settings (хост «settingsHub»): плитка ведёт на /biz/orders/settings
 * (HUB_MODULES), здесь — тот же переключатель для /dev/ext/settingsHub/orders.
 */
import type { SettingsHubExtProps } from '@/extensions/types';
import { OrdersToggleCard } from '@/areas/orders/settings/OrdersToggleCard';

export default function OrdersSettingsHub(props: SettingsHubExtProps) {
  void props;
  return <OrdersToggleCard />;
}
