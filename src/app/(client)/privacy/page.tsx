import type { Metadata } from 'next';
import { LegalPage, legalMetadata } from '@/areas/client/legal/LegalPage';

// /privacy — публичная юридическая страница (04.10.2026; нужна App Store и Google Play), ru/hy/en: /privacy, /hy/privacy, /en/privacy
export function generateMetadata(): Promise<Metadata> {
  return legalMetadata('privacy');
}

export default function Page() {
  return <LegalPage kind="privacy" />;
}
