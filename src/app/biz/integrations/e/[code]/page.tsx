import { DirectLinkScreen } from '@/areas/integrations/DirectLinkScreen';

// /biz/integrations/e/[code] — прямая ссылка mp_<номер>_<имя> (F-13-013).
// Next 16 не декодирует динамический сегмент сам (в отличие от прежних версий) — кириллица в коде
// (наши названия) доходит как %D0%.., decodeURIComponent делаем сами.
export default async function Page({ params }: PageProps<'/biz/integrations/e/[code]'>) {
  const { code } = await params;
  let decoded = code;
  try {
    decoded = decodeURIComponent(code);
  } catch {
    // некорректный % в адресе — передаём как есть, экран покажет «не найдено»
  }
  return <DirectLinkScreen code={decoded} />;
}
