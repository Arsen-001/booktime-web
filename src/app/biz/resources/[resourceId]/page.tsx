import { ResourceDetailScreen } from '@/areas/resources/ResourceDetailScreen';

export default async function Page({ params }: PageProps<'/biz/resources/[resourceId]'>) {
  const { resourceId } = await params;
  return <ResourceDetailScreen resourceId={resourceId} />;
}
