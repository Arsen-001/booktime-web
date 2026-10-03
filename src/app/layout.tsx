import type { Metadata, Viewport } from 'next';
import { Manrope, Noto_Sans, Noto_Sans_Armenian } from 'next/font/google';
import '@/i18n/types';
import { Providers } from '@/app/providers';
import { DemoProvider } from '@/demo/DemoProvider';
import { getDemoSettings } from '@/demo/server';
import { SessionBridge } from '@/demo/SessionBridge';
import { NativeAppBridge } from '@/lib/native/NativeAppBridge';
import { IntlProvider } from '@/i18n/IntlProvider';
import { loadMessages } from '@/i18n/load';
import { DemoSwitcher } from '@/shell/demo/DemoSwitcher';
import { AnalyticsScripts } from '@/shell/AnalyticsScripts';
import { ToastViewport } from '@/ui/Toast';
import { ViewportHintProvider } from '@/ui/device/ViewportHintProvider';
import { getViewportHint } from '@/ui/device/viewportHint.server';
import { SidebarHintProvider } from '@/shell/workspace/SidebarHint';
import { SIDEBAR_COOKIE } from '@/demo/store';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { isIndexable, siteUrl } from '@/lib/seo/site';
import './globals.css';

// Шрифт ОБЯЗАН иметь армянские буквы (F-00-175): Noto Sans (латиница, кириллица) + Noto Sans Armenian
const notoSans = Noto_Sans({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-noto-sans',
  display: 'swap',
});
// Заголовки главной (font-display): Manrope; армянских букв в нём нет — их берёт Noto Sans Armenian из стека
const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});
const notoArmenian = Noto_Sans_Armenian({
  subsets: ['armenian'],
  variable: '--font-noto-armenian',
  display: 'swap',
});

// SEO (03.10.2026): заголовок и описание по умолчанию — на языке запроса (common.seo); адрес сайта для canonical и
// og:url; noindex на всех страницах сборок, которые не индексируются (demo, staging, превью) — src/lib/seo/site.ts
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  const indexable = isIndexable();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t('seo.home.title'), template: '%s · BookTime' },
    description: t('seo.home.description'),
    applicationName: 'BookTime',
    ...(!indexable && { robots: { index: false, follow: false } }),
    openGraph: { type: 'website', siteName: 'BookTime', title: t('seo.home.title'), description: t('seo.home.description') },
    twitter: { card: 'summary_large_image' },
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      // Открыт с домашнего экрана — без адресной строки Safari (PWA "как приложение").
      capable: true,
      statusBarStyle: 'default',
      title: 'BookTime',
    },
    icons: {
      icon: [
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Разные цвета строки состояния/адреса под тему (браузер сам берёт подходящий по prefers-color-scheme).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7fb' }, // tokens-ok — meta theme-color — браузер не читает CSS-переменные
    { media: '(prefers-color-scheme: dark)', color: '#0f0f1a' }, // tokens-ok — meta theme-color — браузер не читает CSS-переменные
  ],
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const demo = await getDemoSettings();
  const { messages, fallbackKeys } = await loadMessages(demo.lang);
  const viewportWidth = await getViewportHint();
  const sidebarCookie = (await cookies()).get(SIDEBAR_COOKIE)?.value;
  const sidebar = sidebarCookie === 'collapsed' || sidebarCookie === 'expanded' ? sidebarCookie : undefined;

  return (
    <html
      lang={demo.lang}
      data-theme={demo.theme}
      data-font={demo.font}
      className={`${notoSans.variable} ${notoArmenian.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-bg text-fg">
        <IntlProvider locale={demo.lang} messages={messages} fallbackKeys={fallbackKeys}>
          <DemoProvider initial={demo}>
            <ViewportHintProvider width={viewportWidth}>
              <SidebarHintProvider value={sidebar}>
              <Providers>
                {children}
                <SessionBridge />
                {/* Сайт внутри приложений BookTime (booktime-mobile): пуши, «Поделиться», «Назад» — src/lib/native */}
                <NativeAppBridge />
                {/* Демо-персоны и сброс демо-данных — только без настоящего сервера (сборка с NEXT_PUBLIC_DATA=api — booktime.am, staging) */}
                {process.env.NEXT_PUBLIC_DATA !== 'api' && <DemoSwitcher />}
                <ToastViewport />
                {/* Аналитика посещений — только живой сайт (api + production), без DNT/GPC: src/lib/analytics.ts */}
                <AnalyticsScripts />
              </Providers>
              </SidebarHintProvider>
            </ViewportHintProvider>
          </DemoProvider>
        </IntlProvider>
      </body>
    </html>
  );
}
