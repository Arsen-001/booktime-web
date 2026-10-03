import 'server-only';
import { ImageResponse } from 'next/og';
import brand from '@/shell/brand-mark.json';

/**
 * Картинка для соцсетей и мессенджеров (Open Graph, 1200×630) — SEO, 03.10.2026. Тёмный фон и знак BT из
 * src/shell/brand-mark.json, крупно — название, ниже — услуги и район, внизу — адрес страницы.
 * next/og не читает CSS-переменные, поэтому цвета — из brand-mark.json (палитра иконок PWA).
 *
 * Шрифт: Noto Sans + Noto Sans Armenian (как на сайте, F-00-175) с Google Fonts, только нужные буквы (&text=).
 * Нет сети — встроенный шрифт next/og без кириллицы и армянского: тогда строки не на латинице не рисуем.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const C = brand.icon;
const TEXT = '#f4f3ff'; // tokens-ok — next/og не читает CSS-переменные
const MUTED = '#a9a6c9'; // tokens-ok — next/og не читает CSS-переменные

async function loadFont(family: string, text: string): Promise<ArrayBuffer | undefined> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@700&text=${encodeURIComponent(text)}`, {
        next: { revalidate: 60 * 60 * 24 * 7 },
        signal: AbortSignal.timeout(4000),
      })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return undefined;
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 }, signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.arrayBuffer() : undefined;
  } catch {
    return undefined;
  }
}

const LATIN_ONLY = /^[\x20-\x7E -ɏ‐-‧·]*$/;

function BrandMark({ cell }: { cell: number }) {
  const gap = Math.round((cell * brand.gap) / brand.cell);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {brand.rows.map((row, y) => (
        <div key={y} style={{ display: 'flex', gap }}>
          {row.split('').map((ch, x) => (
            <div
              key={x}
              style={{
                width: cell,
                height: cell,
                borderRadius: Math.round((cell * brand.radius) / brand.cell),
                background: ch === 'b' ? C.b : ch === 't' ? C.t : ch === 'x' ? C.x : C.empty,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export interface OgCardInput {
  title: string;
  subtitle?: string;
  /** Нижняя строка: «Свободное время и онлайн-запись» */
  tagline?: string;
  /** booktime.am/b/<slug> */
  footer: string;
}

export async function renderOgCard({ title, subtitle, tagline, footer }: OgCardInput): Promise<ImageResponse> {
  const all = [title, subtitle, tagline, footer, 'BookTime'].filter(Boolean).join(' ');
  const [sans, armenian] = await Promise.all([loadFont('Noto+Sans', all), loadFont('Noto+Sans+Armenian', all)]);
  const fonts = [
    ...(sans ? [{ name: 'Noto Sans', data: sans, weight: 700 as const, style: 'normal' as const }] : []),
    ...(armenian ? [{ name: 'Noto Sans Armenian', data: armenian, weight: 700 as const, style: 'normal' as const }] : []),
  ];
  // Без своих шрифтов не-латинские буквы превратились бы в квадраты — такие строки пропускаем
  const show = (s: string | undefined) => (s && (sans || LATIN_ONLY.test(s)) ? s : undefined);
  const titleShown = show(title) ?? 'BookTime';
  const titleSize = titleShown.length > 40 ? 64 : titleShown.length > 24 ? 76 : 92;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: C.bg,
          color: TEXT,
          fontFamily: fonts.length ? '"Noto Sans", "Noto Sans Armenian"' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <BrandMark cell={18} />
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>BookTime</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>{titleShown}</div>
          {show(subtitle) && <div style={{ display: 'flex', fontSize: 40, color: MUTED }}>{show(subtitle)}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 28 }}>
          <div style={{ display: 'flex', flexShrink: 0, whiteSpace: 'nowrap', color: C.b }}>{show(tagline) ?? ''}</div>
          <div
            style={{
              display: 'flex',
              flex: 1,
              minWidth: 0,
              justifyContent: 'flex-end',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              color: MUTED,
            }}
          >
            {footer}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined },
  );
}
