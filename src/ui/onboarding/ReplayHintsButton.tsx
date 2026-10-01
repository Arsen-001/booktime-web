'use client';

import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '@/ui/Button';
import { resetOnboarding, useOnboardingScope, type OnceOptions } from '@/ui/onboarding/onboardingStore';
import { useToast } from '@/ui/Toast';

export interface ReplayHintsButtonProps {
  /** Подпись: «Показать подсказки снова» */
  children: ReactNode;
  /** Только подсказки раздела, например 'journal.' (по умолчанию — все подсказки текущей персоны) */
  idPrefix?: string;
  scope?: OnceOptions['scope'];
  /** Тост после нажатия: «Подсказки появятся снова» */
  doneMessage?: ReactNode;
  onDone?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** «Показать подсказки снова»: забывает, что туры, приветствия и баннеры уже видели, — для настроек и меню «Помощь» */
export function ReplayHintsButton({
  children,
  idPrefix,
  scope,
  doneMessage,
  onDone,
  variant = 'outline',
  size = 'md',
  className,
}: ReplayHintsButtonProps) {
  const current = useOnboardingScope(scope);
  const toast = useToast();
  return (
    <Button
      variant={variant}
      size={size}
      leftIcon={<RotateCcw aria-hidden />}
      className={className}
      onClick={() => {
        // Префиксы ключей + id раздела (hint. — HintBanner и PermissionPrimer; choice. — OneTimeChoice:
        // после повтора «Позже» в окне выбора снова спросит)
        if (idPrefix) {
          ['tour.', 'hint.', 'welcome.', 'checklist.', 'beacon.', 'choice.'].forEach((kind) =>
            resetOnboarding(current, `${kind}${idPrefix}`),
          );
        } else {
          resetOnboarding(current);
        }
        if (doneMessage) toast.success(doneMessage);
        onDone?.();
      }}
    >
      {children}
    </Button>
  );
}
