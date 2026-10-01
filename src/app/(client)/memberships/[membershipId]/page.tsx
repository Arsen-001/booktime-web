import { MembershipDetailScreen } from '@/areas/client/memberships/MembershipDetailScreen';

// /memberships/[membershipId] — карточка абонемента (F-14-038, F-14-039, F-14-045)
export default async function Page({ params }: PageProps<'/memberships/[membershipId]'>) {
  const { membershipId } = await params;
  return <MembershipDetailScreen membershipId={membershipId} />;
}
