import { AboutScreen } from '@/areas/online/public/AboutScreen';

export default async function Page({ params }: PageProps<'/b/[slug]/about'>) {
  const { slug } = await params;
  return <AboutScreen slug={slug} />;
}
