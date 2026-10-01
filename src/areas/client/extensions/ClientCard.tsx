'use client';

import { ExtensionStub } from '@/extensions/ExtensionStub';
import type { ClientCardExtProps } from '@/extensions/types';

/**
 * Вклад раздела «client» в карточку клиента (хост «clientCard», F-14-074 — разовый пуш клиенту). Файл принадлежит
 * разделу «client» (пару завёл хранитель ядра k4 по просьбе client-g3-2). Замените заглушку своим содержимым;
 * пропсы хоста — ClientCardExtProps (src/extensions/types.ts). Пока здесь заглушка, людям вкладка не видна.
 * Посмотреть вклад без хозяина хоста: /dev/ext/clientCard/client
 */
export default function ClientClientCard(props: ClientCardExtProps) {
  void props;
  return <ExtensionStub host="clientCard" area="client" />;
}
