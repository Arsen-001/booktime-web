import type { Metadata } from 'next';
import { LegalPage, legalMetadata } from '@/areas/client/legal/LegalPage';

// /account-deletion — публичная юридическая страница (04.10.2026; нужна App Store и Google Play), ru/hy/en: /account-deletion, /hy/account-deletion, /en/account-deletion
export function generateMetadata(): Promise<Metadata> {
  return legalMetadata('account-deletion');
}

export default function Page() {
  return <LegalPage kind="account-deletion" />;
}
