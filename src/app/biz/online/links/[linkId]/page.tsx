import { LinkSettingsScreen } from '@/areas/online/links/LinkSettingsScreen';

export default async function Page({ params }: PageProps<'/biz/online/links/[linkId]'>) {
  const { linkId } = await params;
  return <LinkSettingsScreen linkId={linkId} />;
}
