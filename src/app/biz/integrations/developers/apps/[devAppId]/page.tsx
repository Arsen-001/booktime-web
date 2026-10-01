import { DevAppDetailScreen } from '@/areas/integrations/developers/DevAppDetailScreen';

// /biz/integrations/developers/apps/[devAppId] — вкладки «Общая информация», «О приложении»,
// «Настройки для разработки», «Доступ к API» (F-13-033…036, F-13-046).
export default async function Page({ params }: PageProps<'/biz/integrations/developers/apps/[devAppId]'>) {
  const { devAppId } = await params;
  return <DevAppDetailScreen devAppId={devAppId} />;
}
