import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Язык живёт в cookie `lang`; у публичных страниц есть адреса /hy/…, /en/… (src/i18n/localePath.ts); см. src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Демо без бэкенда: картинки — локальные data:/blob: и /public.
  images: { unoptimized: true },
  // Значок Next в углу мешает снимкам замеров и перекрывает нижние вкладки
  devIndicators: false,
  // React Compiler: сам запоминает компоненты и значения — перерисовывается только то, чьи данные
  // поменялись (замер и решение — docs/STATE.md). Выключить у одного компонента — 'use no memo'.
  reactCompiler: true,
};

export default withNextIntl(nextConfig);
