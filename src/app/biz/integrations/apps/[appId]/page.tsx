import { AppScreen } from '@/areas/integrations/AppScreen';

// /biz/integrations/apps/[appId] — карточка приложения (F-13-008). Решение владельца 01.10: сегмент — id или
// code приложения («Ссылка для отзыва» из кабинета разработчика строится по code). Next 16 не декодирует
// динамический сегмент — кириллица в code доходит как %D0%.., декодируем сами (как в /e/[code]).
export default async function Page({ params }: PageProps<'/biz/integrations/apps/[appId]'>) {
  const { appId } = await params;
  let decoded = appId;
  try {
    decoded = decodeURIComponent(appId);
  } catch {
    // некорректный % в адресе — передаём как есть, экран покажет «не найдено»
  }
  return <AppScreen appId={decoded} />;
}
