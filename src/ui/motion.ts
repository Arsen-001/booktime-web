import { useSyncExternalStore } from 'react';
import { useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react';

/*
 * Движение UI-кита (docs/design/DESIGN.md → Motion). ЕДИНСТВЕННОЕ место, где живут длительности, пружина и готовые
 * сценарии появления/ухода. Компоненты берут отсюда пресеты и кладут их на `m.*` из 'motion/react-m'
 * (LazyMotion подключён один раз в MotionProvider — полный `motion.*` не нужен и запрещён режимом strict).
 *
 *   const p = useMotionPreset(PRESETS.popover);
 *   <AnimatePresence>{open && <m.div {...p}>…</m.div>}</AnimatePresence>
 *
 * Правила (DESIGN.md → «Скорость»): двигаем только transform и opacity; layout/drag не подключены (только
 * domAnimation); в массовых списках (сетка журнала, таблицы) — никаких m.* и AnimatePresence, только CSS 150 мс;
 * при prefers-reduced-motion любое движение сворачивается в короткий crossfade (useMotionPreset делает это сам,
 * а MotionConfig reducedMotion="user" страхует всё остальное).
 */

/** Длительности, секунды (Motion считает в секундах). В CSS — те же числа в мс: --dur-fast и т. д. */
export const DURATION = {
  /** Мелочи: подсказка, поповер, смена иконки */
  fast: 0.15,
  /** Обычное: модалка, тост, вкладки */
  normal: 0.22,
  /** Крупное: шторка, панель, переход страницы */
  large: 0.32,
} as const;

/** Кривые: выход — быстрее и «от нас», вход — мягкое торможение */
export const EASE = {
  out: [0.2, 0.8, 0.2, 1],
  in: [0.4, 0, 1, 1],
  inOut: [0.4, 0, 0.2, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Одна пружина на всё «физическое»: шторка, панель, перетаскивание, скользящий индикатор */
export const SPRING = { type: 'spring', stiffness: 400, damping: 34, mass: 1 } as const satisfies Transition;

/** Пружина чуть мягче — для индикаторов вкладок и сегментов (короткий путь, без «звона») */
export const SPRING_SNAPPY = { type: 'spring', stiffness: 500, damping: 40, mass: 0.8 } as const satisfies Transition;

export const TRANSITION = {
  fast: { duration: DURATION.fast, ease: EASE.out },
  normal: { duration: DURATION.normal, ease: EASE.out },
  large: { duration: DURATION.large, ease: EASE.out },
  exitFast: { duration: DURATION.fast, ease: EASE.in },
  /**
   * Уход мелкой панели (поповер, меню, список, подсказка): та же длительность fast, но кривая out — прозрачность
   * заметно меняется с первого кадра. С ease-in первые кадры почти стоят, и уход за 100–150 мс читается как «пропало».
   */
  exitSoft: { duration: DURATION.fast, ease: EASE.out },
  spring: SPRING,
} as const satisfies Record<string, Transition>;

/** Готовый сценарий: раскладывается на m.* как {...preset} */
export interface MotionPreset {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition?: Transition;
}

/** Затемнение под окном и шторкой */
const backdrop: MotionPreset = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: TRANSITION.normal },
  exit: { opacity: 0, transition: TRANSITION.exitFast },
};

/** Просто проявиться (содержимое после скелетона, панель вкладки) */
const fade: MotionPreset = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: TRANSITION.normal },
  exit: { opacity: 0, transition: TRANSITION.exitFast },
};

/** Проявиться с подъёмом на 6px — карточки, пустые состояния, контент после загрузки */
const rise: MotionPreset = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: TRANSITION.large },
  exit: { opacity: 0, transition: TRANSITION.exitFast },
};

/** Поповер, меню, выпадающий список: из точки у кнопки */
const popover: MotionPreset = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: TRANSITION.fast },
  exit: { opacity: 0, scale: 0.98, transition: TRANSITION.exitSoft },
};

/** Подсказка: проявиться на месте и так же плавно погаснуть (не исчезать за кадр, когда мышь ушла) */
const tooltip: MotionPreset = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: TRANSITION.fast },
  exit: { opacity: 0, transition: TRANSITION.exitSoft },
};

/** Окно на десктопе: лёгкое увеличение */
const dialog: MotionPreset = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: TRANSITION.normal },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: TRANSITION.exitFast },
};

/** Шторка/окно снизу на телефоне — пружиной */
const slideUp: MotionPreset = {
  initial: { y: '100%' },
  animate: { y: 0, transition: SPRING },
  exit: { y: '100%', transition: { duration: DURATION.normal, ease: EASE.in } },
};

/** Боковая панель справа */
const slideInRight: MotionPreset = {
  initial: { x: '100%' },
  animate: { x: 0, transition: SPRING },
  exit: { x: '100%', transition: { duration: DURATION.normal, ease: EASE.in } },
};

/** Боковая панель слева (меню телефона) */
const slideInLeft: MotionPreset = {
  initial: { x: '-100%' },
  animate: { x: 0, transition: SPRING },
  exit: { x: '-100%', transition: { duration: DURATION.normal, ease: EASE.in } },
};

/** Тост: снизу (телефон/десктоп), уходит вбок */
const toast: MotionPreset = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: SPRING },
  exit: { opacity: 0, x: 24, transition: TRANSITION.exitFast },
};

/** Элемент списка: добавление/удаление (вместе с layout у соседей) */
const listItem: MotionPreset = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: SPRING },
  exit: { opacity: 0, scale: 0.96, transition: TRANSITION.exitFast },
};

export const PRESETS = {
  backdrop,
  fade,
  rise,
  popover,
  tooltip,
  dialog,
  slideUp,
  slideInRight,
  slideInLeft,
  toast,
  listItem,
} as const;

export type PresetName = keyof typeof PRESETS;

/** Crossfade вместо движения — для prefers-reduced-motion */
const REDUCED: MotionPreset = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.fast } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Пресет с учётом настройки «уменьшить движение»: движение → crossfade */
export function reducePreset(preset: MotionPreset, reduced: boolean | null): MotionPreset {
  return reduced ? REDUCED : preset;
}

/** Хук: пресет, уважающий prefers-reduced-motion */
export function useMotionPreset(preset: MotionPreset): MotionPreset {
  const reduced = useReducedMotion();
  // Пока идёт гидратация — полный пресет, как на сервере (он не знает prefers-reduced-motion): иначе у блока, открытого
  // уже в HTML (Collapse в левом меню), style сервера и клиента расходятся — ошибка гидратации. Сразу после неё — свой.
  const hydrated = useSyncExternalStore(subscribeNever, hydratedOnClient, notHydratedOnServer);
  return reducePreset(preset, hydrated && reduced);
}

const subscribeNever = () => () => {};
const hydratedOnClient = () => true;
const notHydratedOnServer = () => false;

/** Переход «физической» вещи (индикатор, перетаскивание) с учётом reduced-motion: мгновенно вместо пружины */
export function useSpring(transition: Transition = SPRING): Transition {
  const reduced = useReducedMotion();
  return reduced ? { duration: 0 } : transition;
}
