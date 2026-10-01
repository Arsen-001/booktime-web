import { PackageFormScreen } from '@/areas/resources/PackageFormScreen';

export default async function Page({ params }: PageProps<'/biz/resources/packages/[packageId]'>) {
  const { packageId } = await params;
  return <PackageFormScreen packageId={packageId} />;
}
