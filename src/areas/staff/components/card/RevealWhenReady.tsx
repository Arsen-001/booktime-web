"use client";

/**
 * Вкладка карточки, собранная из вкладов других разделов (график, онлайн-запись, уведомления), показывается ОДНИМ
 * куском (М2 обзора «Сотрудники»): раньше каждая часть приходила со своей заглушкой — 128 px, потом 700, потом
 * 2 000 — и страница прыгала пять раз. Пока внутри есть хоть один [data-skeleton], содержимое монтируется и грузится
 * невидимым (не занимает места), а на его месте стоит одна заглушка примерной высоты вкладки; как только заглушек
 * внутри не осталось два кадра подряд — содержимое встаёт целиком, сразу (без проявления: оно мигает).
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/ui/Skeleton";

export function RevealWhenReady({ estimate, children }: { estimate: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || ready) return;
    let frame = 0;
    let quiet = 0;
    const started = performance.now();
    const check = () => {
      const loading = el.querySelector("[data-skeleton], [aria-busy='true']");
      quiet = loading ? 0 : quiet + 1;
      // Два кадра без заглушек или 4 с — показываем (вклад мог так и не прийти: пусть покажет свою ошибку сам)
      if (quiet >= 2 || performance.now() - started > 4000) setReady(true);
      else frame = requestAnimationFrame(check);
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  const cards = Math.max(1, Math.round(estimate / 260));
  return (
    <div className="relative">
      {!ready && (
        <div data-skeleton aria-busy className="flex flex-col gap-5" style={{ minHeight: estimate }}>
          {Array.from({ length: cards }, (_, i) => (
            <Skeleton key={i} variant="rect" className="h-[15rem] w-full rounded-2xl" />
          ))}
        </div>
      )}
      <div
        ref={ref}
        aria-hidden={!ready || undefined}
        className={cn(!ready && "invisible absolute inset-x-0 top-0 overflow-hidden")}
        style={ready ? undefined : { height: estimate }}
      >
        {children}
      </div>
    </div>
  );
}
