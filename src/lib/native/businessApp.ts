/**
 * Приложение «BookTime Business» — только кабинет (проверка на телефоне 05.10.2026: на входе были клиентские вкладки,
 * «Главная» открывала клиентский сайт). Экраны клиента, которые в нём открылись по ссылке или вкладке, src/proxy.ts
 * переводит в кабинет (без входа — на вход бизнеса). Остаются доступными: кабинет, вход, регистрация бизнеса,
 * страница «Для бизнеса», юридические страницы и поддержка (/privacy, /terms, /account-deletion, /support — и с /hy, /en),
 * публичные страницы салонов и мастеров (/b/…, /masters/…, /places/…: мастер смотрит, как его видят клиенты), /o/…, /s/….
 */
const CLIENT_ONLY_PATHS = [
  '/search',
  '/bookings',
  '/favorites',
  '/profile',
  '/notifications',
  '/certificates',
  '/memberships',
  '/loyalty-cards',
  '/diary',
];

/** Путь (без языкового префикса) — экран приложения клиента, которому нет места в Business */
export function isClientOnlyPath(path: string): boolean {
  return path === '/' || CLIENT_ONLY_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
