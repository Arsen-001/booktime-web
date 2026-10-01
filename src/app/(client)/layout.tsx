import { ExtensionStubsProvider } from '@/extensions/ExtensionStubsProvider';
import { listStubPairs } from '@/extensions/stubs.server';
import { ClientShell } from '@/shell/client/ClientShell';

// Каркас приложения клиента. Файл в путях раздела client — раздел может его менять.
export default function ClientLayout({ children }: LayoutProps<'/'>) {
  return (
    // Вклады-заглушки (профиль клиента: loyalty, finance) людям не показываем — список считает сервер
    <ExtensionStubsProvider stubs={listStubPairs()}>
      <ClientShell>
        {/* Один продукт для любой сферы (F-00-003) и бесплатно для клиента (F-00-005) — верно для всех экранов приложения */}
        <div data-f="F-00-003 F-00-005">{children}</div>
      </ClientShell>
    </ExtensionStubsProvider>
  );
}
