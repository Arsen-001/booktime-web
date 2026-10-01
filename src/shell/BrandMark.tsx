import mark from './brand-mark.json';

const { rows, cell, gap, radius } = mark;
const pitch = cell + gap;
// '.' — свободный день: бледная клетка, чтобы знак читался как календарь, а BT — как выбранные дни
const FILL: Record<string, string> = { b: 'var(--brand-b)', t: 'var(--brand-t)', x: 'var(--brand-x)', '.': 'var(--brand-empty)' };

export const BRAND_MARK_WIDTH = rows[0].length * pitch - gap;
export const BRAND_MARK_HEIGHT = rows.length * pitch - gap;

/** Знак BookTime: монограмма BT из клеток календаря. Форма и цвета иконок — в brand-mark.json, цвета в интерфейсе — токены --brand-*. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${BRAND_MARK_WIDTH} ${BRAND_MARK_HEIGHT}`}
      className={className}
    >
      {rows.flatMap((row, r) =>
        [...row].map((ch, c) =>
          FILL[ch] ? (
            <rect
              key={`${r}-${c}`}
              x={c * pitch}
              y={r * pitch}
              width={cell}
              height={cell}
              rx={radius}
              style={{ fill: FILL[ch] }}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
