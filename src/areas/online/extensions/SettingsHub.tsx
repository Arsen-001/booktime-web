'use client';

import { ExtensionStub } from '@/extensions/ExtensionStub';
import type { SettingsHubExtProps } from '@/extensions/types';

/**
 * Вклад раздела «online» в хаб настроек /biz/settings (хост «settingsHub»). Файл принадлежит разделу «online».
 * Замените заглушку своим содержимым; пропсы хоста — SettingsHubExtProps (src/extensions/types.ts).
 * Посмотреть вклад без хозяина хоста: /dev/ext/settingsHub/online
 */
export default function OnlineSettingsHub(props: SettingsHubExtProps) {
  void props;
  return <ExtensionStub host="settingsHub" area="online" />;
}
