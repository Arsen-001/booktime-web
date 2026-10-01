import { MembershipTypeFormScreen } from '@/areas/loyalty/membership-types/MembershipTypeFormScreen';

// /biz/loyalty/memberships/types/[typeId] — правка, архивирование, дублирование, удаление типа абонемента.
export default async function Page({ params }: PageProps<'/biz/loyalty/memberships/types/[typeId]'>) {
  const { typeId } = await params;
  return <MembershipTypeFormScreen typeId={typeId} />;
}
