import { StoryViewScreen } from '@/areas/client/stories/StoryViewScreen';

interface PageProps {
  params: Promise<{ storyId: string }>;
}

// /stories/[storyId] — раздел «client»: просмотр сторис (F-00-159…162, F-14-033…036).
export default async function Page({ params }: PageProps) {
  const { storyId } = await params;
  return <StoryViewScreen storyId={storyId} />;
}
