import type { Metadata } from 'next';
import { SupportPage, supportMetadata } from '@/areas/client/legal/SupportPage';

// /support — «Помощь и поддержка» (05.10.2026; Support URL для App Store и Google Play), ru/hy/en: /support, /hy/support, /en/support
export function generateMetadata(): Promise<Metadata> {
  return supportMetadata();
}

export default function Page() {
  return <SupportPage />;
}
