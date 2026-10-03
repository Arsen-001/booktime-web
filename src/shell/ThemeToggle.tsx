'use client';

import { Moon, Sun } from 'lucide-react';
import { useApplyDemo, useDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { IconButton } from '@/ui/IconButton';

/** Светлая / тёмная тема в верхней полосе (владелец 03.10.2026: «рядом с кнопкой входа»); запоминается в cookie theme */
export function ThemeToggle() {
  const t = useT('common');
  const { theme } = useDemo();
  const apply = useApplyDemo();
  const dark = theme === 'dark';
  return (
    <IconButton
      icon={dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
      label={dark ? t('shell.themeLight') : t('shell.themeDark')}
      size="sm"
      onClick={() => apply({ theme: dark ? 'light' : 'dark' })}
    />
  );
}
