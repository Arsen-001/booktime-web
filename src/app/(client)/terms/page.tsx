import type { Metadata } from 'next';
import { LegalPage, legalMetadata } from '@/areas/client/legal/LegalPage';

// /terms — публичная юридическая страница (04.10.2026; нужна App Store и Google Play), ru/hy/en: /terms, /hy/terms, /en/terms
export function generateMetadata(): Promise<Metadata> {
  return legalMetadata('terms');
}

export default function Page() {
  return <LegalPage kind="terms" />;
}
