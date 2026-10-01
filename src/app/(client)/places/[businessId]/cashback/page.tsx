import { CashbackDetailScreen } from '@/areas/client/loyalty/CashbackDetailScreen';

// /places/[businessId]/cashback — экран деталей кэшбэка компании (F-14-049…052)
export default async function Page({ params }: PageProps<'/places/[businessId]/cashback'>) {
  const { businessId } = await params;
  return <CashbackDetailScreen businessId={businessId} />;
}
