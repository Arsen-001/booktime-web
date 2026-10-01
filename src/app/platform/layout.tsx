import { PlatformShell } from '@/shell/platform/PlatformShell';

// Каркас нашей панели. Файл в путях раздела platform — раздел может его менять.
export default function PlatformLayout({ children }: LayoutProps<'/platform'>) {
  return <PlatformShell>{children}</PlatformShell>;
}
