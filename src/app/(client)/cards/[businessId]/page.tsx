import { WalletPlaceScreen } from '@/areas/client/wallet/WalletPlaceScreen';

// /cards/[businessId] — всё, что у клиента есть в одном салоне (17.11.2026)
export default async function Page({ params }: PageProps<'/cards/[businessId]'>) {
  const { businessId } = await params;
  return <WalletPlaceScreen businessId={businessId} />;
}
