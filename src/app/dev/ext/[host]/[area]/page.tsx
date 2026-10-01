import { DevExtFrame } from '@/shell/dev/DevExtFrame';

// Вклад раздела в пустой рамке хоста на моковых данных — пока хозяин хоста не построил экран.
export default async function Page({ params }: PageProps<'/dev/ext/[host]/[area]'>) {
  const { host, area } = await params;
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <DevExtFrame host={host} area={area} />
    </div>
  );
}
