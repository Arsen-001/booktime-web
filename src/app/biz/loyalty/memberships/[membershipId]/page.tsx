import { MembershipDetailScreen } from '@/areas/loyalty/memberships/MembershipDetailScreen';

// /biz/loyalty/memberships/[membershipId] — карточка абонемента в сети (F-06-187, F-06-194).
export default async function Page({ params }: PageProps<'/biz/loyalty/memberships/[membershipId]'>) {
  const { membershipId } = await params;
  return <MembershipDetailScreen membershipId={membershipId} />;
}
