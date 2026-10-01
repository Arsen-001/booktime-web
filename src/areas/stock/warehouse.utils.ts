/**
 * F-08-063: два дефолтных склада («Расходники» и «Товары», F-08-004) заводятся сидом один раз на русском —
 * они не «имя, которое ввёл владелец», а системное значение по умолчанию, поэтому в EN-демо должны идти через
 * i18n, а не показывать русскую строку. Склад, который владелец переименовал сам, — обычные пользовательские
 * данные (⭐ не переводим, как имя клиента).
 */
import { useDemo } from '@/demo/hooks';
import { unitById, type Warehouse } from '@/domain/stock';
import { pickText } from '@/lib/text';
import type { useT } from '@/i18n/useT';

type StockT = ReturnType<typeof useT<'stock'>>;

const DEFAULT_RU_NAME: Record<'writeoff' | 'sale', string> = {
  writeoff: 'Расходники',
  sale: 'Товары',
};

export function warehouseLabel(w: Pick<Warehouse, 'name' | 'type'>, t: StockT): string {
  if (w.type === 'writeoff' && w.name === DEFAULT_RU_NAME.writeoff) return t('warehouseDefault.writeoff');
  if (w.type === 'sale' && w.name === DEFAULT_RU_NAME.sale) return t('warehouseDefault.sale');
  return w.name;
}

/** Как выше, но когда под рукой только денормализованное имя склада (например, `warehouseName` из строки операции), без типа. */
export function warehouseNameLabel(name: string, t: StockT): string {
  if (name === DEFAULT_RU_NAME.writeoff) return t('warehouseDefault.writeoff');
  if (name === DEFAULT_RU_NAME.sale) return t('warehouseDefault.sale');
  return name;
}

/**
 * Ск8/Ск9: остаток товара на конкретном складе из строки каталога. `levels` присылает мок; если его нет
 * (режим api, старый ответ) — известен только общий остаток, его и показываем.
 */
export function stockAtWarehouse(good: { levels?: { warehouseId: string; qty: number }[]; totalStock: number }, warehouseId: string): number {
  if (!good.levels) return good.totalStock;
  return good.levels.find((l) => l.warehouseId === warehouseId)?.qty ?? 0;
}

/** Склад, где этого товара больше всего — «склад по умолчанию» для списания/перемещения (Ск8) */
export function warehouseWithMostStock(good: { levels?: { warehouseId: string; qty: number }[] }): string | undefined {
  const best = [...(good.levels ?? [])].filter((l) => l.qty > 0).sort((a, b) => b.qty - a.qty)[0];
  return best?.warehouseId;
}

/** Количество из поля ввода: пусто/мусор — NaN (ошибка «больше нуля» под полем), запятая = точка */
export function parseQty(text: string): number {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return Number.NaN;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Количество на складе: format.number округляет до целого, а остатки бывают дробными (0,3 флакона после
 * трёх визитов по 10 мл) — «0» или «1» вместо «0,3» врали. До двух знаков, лишние нули отброшены,
 * группы тысяч и минус — как у format.number.
 */
export function formatQty(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded < 0 ? '−' : '';
  const [int, frac] = Math.abs(rounded).toFixed(2).replace(/0+$/, '').replace(/\.$/, '').split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return sign + grouped + (frac ? `,${frac}` : '');
}

/**
 * QA 30.09: короткая единица («шт.», «мл», «флак.») на языке интерфейса. Раньше экраны брали `.short.ru` —
 * в английском кабинете было «Stock 1 шт.», в WhatsApp-заказе и ценниках тоже по-русски.
 */
export function useUnitShort(): (unitId: string) => string {
  const { lang } = useDemo();
  return (unitId: string) => pickText(unitById(unitId).short, lang);
}
