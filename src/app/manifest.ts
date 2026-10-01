import type { MetadataRoute } from 'next';
import common from '@messages/ru/common.json';

// PWA-манифест: чтобы веб-версию можно было поставить на телефон как приложение (иконка на
// экране, standalone-окно без адресной строки). Имя и цвета — из общих источников (не дублируем):
// `common.app.name` («BookTime», см. Logo.tsx) и палитра «Индиго» из
// `src/styles/tokens.css` (`--primary` / `--bg`, светлая тема — манифест языка не переключает).
// Иконки — знак BT из src/shell/brand-mark.json, собираются `node scripts/brand-icons.mjs`.
//
// Пуш-уведомления и офлайн-режим не входят: см. docs/PWA.md — там же список, что понадобится
// service worker'у, когда появится бэкенд.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: common.app.name,
    short_name: common.app.name,
    description: common.app.tagline,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f7f7fb', // tokens-ok — manifest PWA — только литералы цвета
    theme_color: '#3b32c9', // tokens-ok — manifest PWA — только литералы цвета
    lang: 'ru',
    dir: 'ltr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
