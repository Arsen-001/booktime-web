/** Набор значений технического перерыва — один на меню строки, ячейку таблицы и форму (У9): 5 мин … 1 ч, шаг 5 */
export const TECH_BREAK_MINUTES: readonly number[] = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);

/** Значение для выпадающего списка: 'shared' | 'none' | число минут строкой */
export function techBreakValue(bufferAfterMin: number | undefined): string {
  if (bufferAfterMin == null) return 'shared';
  if (bufferAfterMin === 0) return 'none';
  return String(bufferAfterMin);
}

export function techBreakFromValue(value: string): number | undefined {
  if (value === 'shared') return undefined;
  if (value === 'none') return 0;
  return Number(value);
}
