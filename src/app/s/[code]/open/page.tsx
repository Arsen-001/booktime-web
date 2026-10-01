import { ShortLinkRedirect } from '@/areas/notify/short/ShortLinkRedirect';
import { PublicShell } from '@/shell/public/PublicShell';

// Короткая ссылка SMS в режиме mock (база — в браузере) и «ссылка не найдена»; в режиме api сюда не попадают —
// /s/<code> отвечает 302 сразу с сервера (route.ts рядом). Файл раздела notify.
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <PublicShell>
      <ShortLinkRedirect code={code} />
    </PublicShell>
  );
}
