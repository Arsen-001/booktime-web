'use client';

import { ExtensionStub } from '@/extensions/ExtensionStub';
import type { ClientProfileExtProps } from '@/extensions/types';

/**
 * Вклад раздела «finance» в профиль клиента в приложении (хост «clientProfile»). Файл принадлежит разделу «finance».
 * Замените заглушку своим содержимым; пропсы хоста — ClientProfileExtProps (src/extensions/types.ts).
 * Посмотреть вклад без хозяина хоста: /dev/ext/clientProfile/finance
 */
export default function FinanceClientProfile(props: ClientProfileExtProps) {
  void props;
  return <ExtensionStub host="clientProfile" area="finance" />;
}
