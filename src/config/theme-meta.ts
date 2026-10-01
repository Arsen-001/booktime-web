/**
 * Цвета для МЕТАДАННЫХ (build-q2 №1–4): `<meta name="theme-color">` в src/app/layout.tsx и PWA-манифест
 * src/app/manifest.ts. Метаданные не читают CSS-переменные, поэтому здесь — одна копия значений токенов
 * из src/styles/tokens.css. Сменилась палитра в tokens.css — поменяйте и здесь (одно место вместо двух файлов).
 * В компонентах эти значения не использовать — только токены (bg-bg, bg-primary…).
 */
export const THEME_META = {
  /** --bg светлой темы */
  lightBackground: '#f7f7fb', // tokens-ok: копия --bg (светлая), метаданные не читают CSS-переменные
  /** --bg тёмной темы */
  darkBackground: '#0f0f1a', // tokens-ok: копия --bg (тёмная)
  /** --primary светлой темы — акцент бренда «Индиго» */
  primary: '#3b32c9', // tokens-ok: копия --primary (светлая)
} as const;
