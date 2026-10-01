import { redirect } from 'next/navigation';
import { BizHome } from '@/areas/reports/home/BizHome';
import { PERSONA_PERMISSIONS } from '@/config/permissions';
import { getDemoSettings } from '@/demo/server';

/**
 * Стартовая страница кабинета (⭐ владелец, 01.10.2026): у кого по умолчанию есть отчёты (владелец, мастер-индивидуал,
 * владелец сети) — главная с пятью цифрами и действиями; мастер и администратор — сразу журнал (F-01-204), без
 * лишнего кадра. Права, выданные/снятые владельцем, проверяет BizHome уже в браузере.
 */
export default async function BizIndex() {
  const { persona } = await getDemoSettings();
  if (!PERSONA_PERMISSIONS[persona].includes('reports.view')) redirect('/biz/journal');
  return <BizHome />;
}
