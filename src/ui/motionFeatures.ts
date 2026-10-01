// Возможности Motion, которые MotionProvider подгружает отдельным куском уже после первой отрисовки. Только
// domAnimation (анимации, AnimatePresence, hover/tap) — без layout и drag: они тяжелее и не нужны (индикаторы
// вкладок — Web Animations API, смахивание шторки — свой указатель). См. DESIGN.md → «Скорость».
import { domAnimation } from 'motion/react';

export default domAnimation;
