/** Новый id с префиксом сущности: newId('bk') → 'bk_m1x2y3z4' */
export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}
