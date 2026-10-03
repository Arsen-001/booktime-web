'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, PointerEvent } from 'react';
import { inAttr, useInView, useReducedMotion } from '@/areas/client/home/landing';
import { CLIENT_SPHERES, SPHERE_ICON } from '@/areas/client/ui/sphereIcons';
import type { SphereId } from '@/domain/core';
import { useT } from '@/i18n/useT';

/** Цвет сферы на плитке — из палитры графиков (токены, свои для тёмной темы) */
const SPHERE_TONE: Record<SphereId, string> = {
  nails: 'var(--chart-5)',
  barber: 'var(--chart-2)',
  hair: 'var(--chart-4)',
  cosmetology: 'var(--chart-6)',
  massage: 'var(--chart-3)',
  dental: 'var(--chart-1)',
  fitness: 'var(--chart-8)',
  carwash: 'var(--chart-7)',
  general: 'var(--chart-7)',
};

/**
 * Сферы плитками для гостя (F-00-110): все восемь видны сразу; при наведении плитка заливается цветом сферы из
 * иконки и чуть наклоняется за мышью (вариант «Живая запись», 03.10.2026). Тап — поиск по сфере.
 */
export function SphereGrid() {
  const tc = useT('common');
  const t = useT('client');
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLUListElement>();

  const tilt = (e: PointerEvent<HTMLAnchorElement>) => {
    if (reduced || e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${-y * 8}deg) rotateY(${x * 10}deg) translateY(-4px)`;
  };

  return (
    <section className="flex flex-col gap-5">
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-fg md:text-[2rem]">{t('home.spheresTitle')}</h2>
      <ul ref={ref} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5">
        {CLIENT_SPHERES.map((id, i) => {
          const Icon = SPHERE_ICON[id];
          return (
            <li key={id} className="lp-rv min-w-0" style={{ '--d': i } as CSSProperties} {...inAttr(inView)}>
              <Link
                href={`/search?sphere=${id}`}
                onPointerMove={tilt}
                onPointerLeave={(e) => (e.currentTarget.style.transform = '')}
                style={{ '--tone': SPHERE_TONE[id] } as CSSProperties}
                className="lp-tile flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-4 focus-visible:outline-2 focus-visible:outline-focus sm:gap-7 sm:p-5 [--fill-x:16px] [--fill-y:16px] sm:[--fill-x:20px] sm:[--fill-y:20px]"
              >
                <span className="lp-tile-icon inline-flex size-12 items-center justify-center rounded-2xl">
                  <Icon aria-hidden className="size-6" />
                </span>
                <span className="min-w-0">
                  <b className="block font-display text-[1.0625rem] font-bold tracking-tight text-fg [overflow-wrap:anywhere] sm:text-xl">
                    {tc(`spheres.${id}`)}
                  </b>
                  <span className="mt-0.5 hidden text-sm text-muted sm:block">{t(`home.sphereHints.${id as Exclude<SphereId, 'general'>}`)}</span>
                </span>
                <ArrowRight aria-hidden className="lp-tile-go absolute top-5 right-5 size-5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
