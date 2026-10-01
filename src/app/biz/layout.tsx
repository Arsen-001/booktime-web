import { ExtensionStubsProvider } from '@/extensions/ExtensionStubsProvider';
import { listStubPairs } from '@/extensions/stubs.server';
import { BizShell } from '@/shell/biz/BizShell';

// Каркас кабинета бизнеса (файл фундамента). Разделы живут в своих папках src/app/biz/<раздел>/.
// Вклады-заглушки в окнах и карточках не показываем людям (useExtensions) — список считает сервер.
export default function BizLayout({ children }: LayoutProps<'/biz'>) {
  return (
    <ExtensionStubsProvider stubs={listStubPairs()}>
      <BizShell>{children}</BizShell>
    </ExtensionStubsProvider>
  );
}
