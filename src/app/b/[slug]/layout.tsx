import { Suspense } from 'react';
import { PublicShell } from '@/shell/public/PublicShell';
import { ReferralWelcome } from '@/areas/online/public/ReferralWelcome';
import { ClientLanguageSwitch } from '@/areas/online/public/ClientLanguageSwitch';
import { WidgetLocaleSync } from '@/areas/online/public/WidgetLocaleSync';

// Публичная страница салона/мастера — «ваша ссылка — только ваша» (F-00-006). Файл раздела online.
//
// F-03-027: знак продукта уже выводит сам PublicShell (фундамент) в своём <footer> — раньше здесь
// поверх него ещё раз рендерился src/areas/online/public/PoweredByMark.tsx, и на каждом экране
// /b/[slug]/** было два одинаковых «BookTime» подряд. PublicShell — общий файл (src/shell/**), поэтому
// сами его не трогаем: просьба сделать знак ссылкой (подчёркнутое слово, п. «проверкой 1» в ТЗ) —
// в qa/requests/online.md. PoweredByMark.tsx оставлен: заберёт рендер обратно, когда просьба будет
// выполнена и у PublicShell появится слот/проп для этого знака.
export default async function PublicLayout({ children, params }: LayoutProps<'/b/[slug]'>) {
  const { slug } = await params;
  return (
    <PublicShell>
      {/* F-03-114: язык ссылки — для новых/неавторизованных визитов, один раз, без цикла обновлений */}
      <WidgetLocaleSync slug={slug} />
      {/* О3: язык — в шапке каждой клиентской страницы (салон, запись, «моя запись», кабинет) */}
      <div className="-mt-1 mb-3 flex justify-end">
        <ClientLanguageSwitch />
      </div>
      {/* ⭐ «Пригласи подругу»: код из личной ссылки запоминается до записи, сверху — кто пригласил */}
      <Suspense fallback={null}>
        <ReferralWelcome slug={slug} />
      </Suspense>
      {children}
    </PublicShell>
  );
}
