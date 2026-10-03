import common from '@messages/ru/common.json';
import { OG_SIZE, renderOgCard } from '@/lib/seo/ogCard';

// Картинка по умолчанию для ссылок на сайт (главная, поиск, карточки) — SEO, 03.10.2026. Собирается при сборке,
// язык — ru (у поисковиков и мессенджеров нет cookie языка). Своя у страницы салона: src/app/b/[slug]/opengraph-image.tsx
export const alt = `${common.app.name} — ${common.app.tagline}`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderOgCard({ title: common.app.tagline, subtitle: common.seo.og.subtitle, tagline: common.seo.city, footer: 'booktime.am' });
}
