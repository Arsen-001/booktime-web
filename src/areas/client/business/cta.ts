/**
 * Кнопки-ссылки страницы /business — те же, что на главной гостя (крупные, rounded-xl, h-12/14): главная залитая
 * с блеском (.lp-shine) и спокойная с рамкой. На тёмном блоке — светлые варианты.
 */
const BASE =
  'group inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold whitespace-nowrap transition-[transform,background-color,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-14 sm:px-6';

export const ctaPrimary = `${BASE} lp-shine bg-primary text-primary-contrast shadow-md hover:-translate-y-px hover:bg-primary-hover focus-visible:outline-focus`;
export const ctaSecondary = `${BASE} border border-border bg-surface text-fg hover:border-border-strong/45 hover:bg-surface-2 focus-visible:outline-focus`;
export const ctaOnDark = `${BASE} bg-primary-contrast text-primary hover:-translate-y-px focus-visible:outline-primary-contrast`;
export const ctaOnDarkGhost = `${BASE} border border-primary-contrast/35 text-primary-contrast hover:bg-primary-contrast/10 focus-visible:outline-primary-contrast`;

/** Заголовок секции — как на главной гостя */
export const sectionTitle = 'font-display text-2xl font-extrabold tracking-tight text-balance text-fg md:text-[2rem]';
