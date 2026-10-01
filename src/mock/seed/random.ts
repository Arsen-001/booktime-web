/** Детерминированный ГПСЧ для сида: одинаковое зерно → одинаковые данные при каждом сиде. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly gen: () => number;

  constructor(seed: number) {
    this.gen = mulberry32(seed);
  }

  /** [0, 1) */
  next(): number {
    return this.gen();
  }

  /** Целое от min до max включительно */
  int(min: number, max: number): number {
    return min + Math.floor(this.gen() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.gen() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.gen() * items.length)];
  }

  /** Выбор по весам: [[значение, вес], …] */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = this.gen() * total;
    for (const [value, w] of items) {
      r -= w;
      if (r < 0) return value;
    }
    return items[items.length - 1][0];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.gen() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.max(0, Math.min(n, items.length)));
  }
}
