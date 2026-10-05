import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PublicShell } from '@/shell/public/PublicShell';
import { ReferralWelcome } from '@/areas/online/public/ReferralWelcome';
import { ClientLanguageSwitch } from '@/areas/online/public/ClientLanguageSwitch';
import { WidgetLocaleSync } from '@/areas/online/public/WidgetLocaleSync';
import { describeBusiness, seoContext } from '@/lib/seo/describe';
import { notFoundMetadata, pageMetadata } from '@/lib/seo/meta';
import { getPublicBusinessForSeo } from '@/lib/seo/publicData';

// Публичная страница салона/мастера — «ваша ссылка — только ваша» (F-00-006). Файл раздела online.
//
// F-03-027: знак продукта уже выводит сам PublicShell (фундамент) в своём <footer> — раньше здесь
// поверх него ещё раз рендерился src/areas/online/public/PoweredByMark.tsx, и на каждом экране
// /b/[slug]/** было два одинаковых «BookTime» подряд. PublicShell — общий файл (src/shell/**), поэтому
// сами его не трогаем: просьба сделать знак ссылкой (подчёркнутое слово, п. «проверкой 1» в ТЗ) —
// в qa/requests/online.md. PoweredByMark.tsx оставлен: заберёт рендер обратно, когда просьба будет
// выполнена и у PublicShell появится слот/проп для этого знака.
/**
 * SEO (03.10.2026): «<Название> — <услуги>, <район>, Ереван | BookTime», описание из текста бизнеса/услуг/цены «от»,
 * canonical /b/<slug> для всех вложенных страниц (о салоне, форма — та же страница). Картинка — opengraph-image.tsx.
 * Нет такого салона (404 сервера) — noindex; сервер недоступен — заголовок по умолчанию.
 */
export async function generateMetadata({ params }: LayoutProps<'/b/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const [r, ctx] = await Promise.all([getPublicBusinessForSeo(slug), seoContext()]);
  if (!r.ok) return r.notFound ? notFoundMetadata(ctx.t('seo.business.notFound')) : {};
  const seo = describeBusiness(ctx, r.data);
  return pageMetadata({ title: seo.title, description: seo.description, path: `/b/${r.data.business.slug}`, locale: ctx.locale });
}

export default async function PublicLayout({ children, params }: LayoutProps<'/b/[slug]'>) {
  const { slug } = await params;
  return (
    <PublicShell>
      {/* F-03-114: язык ссылки — для новых/неавторизованных визитов, один раз, без цикла обновлений */}
      <WidgetLocaleSync slug={slug} />
      {/* О3: язык — в шапке каждой клиентской страницы (салон, запись, «моя запись», кабинет); в приложении клиента — нет */}
      <ClientLanguageSwitch className="-mt-1 mb-3 flex justify-end" />
      {/* ⭐ «Пригласи подругу»: код из личной ссылки запоминается до записи, сверху — кто пригласил */}
      <Suspense fallback={null}>
        <ReferralWelcome slug={slug} />
      </Suspense>
      {children}
    </PublicShell>
  );
}
