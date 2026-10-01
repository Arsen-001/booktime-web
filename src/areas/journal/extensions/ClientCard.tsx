"use client";

import { ExtensionStub } from "@/extensions/ExtensionStub";
import type { ClientCardExtProps } from "@/extensions/types";

/**
 * Вклад раздела «journal» в карточку клиента (хост «clientCard»). Файл принадлежит разделу «journal».
 * Замените заглушку своим содержимым; пропсы хоста — ClientCardExtProps (src/extensions/types.ts).
 * Посмотреть вклад без хозяина хоста: /dev/ext/clientCard/journal
 */
export default function JournalClientCard(props: ClientCardExtProps) {
  void props;
  return <ExtensionStub host="clientCard" area="journal" />;
}
