import { CabinetScreen } from '@/areas/online/public/CabinetScreen';

export default async function Page({ params }: PageProps<'/b/[slug]/me'>) {
  const { slug } = await params;
  return <CabinetScreen slug={slug} />;
}
