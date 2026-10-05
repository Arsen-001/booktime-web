import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Язык живёт в cookie `lang`; у публичных страниц есть адреса /hy/…, /en/… (src/i18n/localePath.ts); см. src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Картинки рисуются как есть: data:/blob: (демо), /public и фото с сервера (https://api…/v1/files/… или бакет,
  // docs/DEPLOY.md «Файлы и фото») — без оптимизатора Next, поэтому remotePatterns не нужны.
  images: { unoptimized: true },
  // Значок Next в углу мешает снимкам замеров и перекрывает нижние вкладки
  devIndicators: false,
  // React Compiler: сам запоминает компоненты и значения — перерисовывается только то, чьи данные
  // поменялись (замер и решение — docs/STATE.md). Выключить у одного компонента — 'use no memo'.
  reactCompiler: true,
  // Sentry — только ошибки (tracesSampleRate: 0, без Replay). Флаги сборки SDK, как `bundleSizeOptimizations`
  // у withSentryConfig (его webpack.treeshake с Turbopack не работает): вырезают из бандла трассировку
  // (browserTracingIntegration, спаны, web-vitals), отладочные логи SDK и части Replay. Отчёты об ошибках остаются.
  compiler: {
    define: {
      __SENTRY_DEBUG__: false,
      __SENTRY_TRACING__: false,
      __RRWEB_EXCLUDE_CANVAS__: true,
      __RRWEB_EXCLUDE_IFRAME__: true,
      __RRWEB_EXCLUDE_SHADOW_DOM__: true,
      __SENTRY_EXCLUDE_REPLAY_WORKER__: true,
    },
  },
};

export default withNextIntl(nextConfig);
