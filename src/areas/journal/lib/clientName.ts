/**
 * Имя клиента в блоке записи (F-01-026): «имя и первая буква фамилии, независимо от прав».
 * «Анна Саргсян» → «Анна С.»; одно слово (нет фамилии) — как есть.
 */
export function shortClientName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name;
  const [first, last] = parts;
  return `${first} ${last[0]?.toUpperCase()}.`;
}
