import { InviteAcceptScreen } from '@/areas/settings/InviteAcceptScreen';

export default async function Page({ params }: PageProps<'/biz/onboarding/invite/[token]'>) {
  const { token } = await params;
  return <InviteAcceptScreen token={token} />;
}
