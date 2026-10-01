'use client';

/**
 * ⭐ F-00-139: сканер штрихкода камерой — `BarcodeDetector` браузера; где его нет — ручной ввод кода.
 * F-08-090: обычный USB/Bluetooth-сканер не нуждается в этом компоненте — он работает как клавиатура
 * в любом текстовом поле (Input товара, поиск), это окно — только для камеры телефона.
 */
import { useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';

export interface CameraScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}

interface BrowserBarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BrowserBarcodeDetector;
  }
}

/** Окно всегда смонтировано (родитель держит его в дереве закрытым — overlays-mounted-while-closed) */
export function CameraScanner({ open, onOpenChange, onDetected }: CameraScannerProps) {
  const t = useT('stock');
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('scanner.title')} size="sm">
      {open && <CameraScannerBody onDetected={onDetected} />}
    </Modal>
  );
}

/** Своя копия на каждое открытие (key снаружи) — состояние и доступ к камере не переживают закрытие */
function CameraScannerBody({ onDetected }: { onDetected: (code: string) => void }) {
  const t = useT('stock');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [supported] = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let raf = 0;
    const detector = new window.BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'qr_code'] });

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {
            // кадр пропущен — пробуем следующий
          }
          raf = requestAnimationFrame(() => void tick());
        };
        raf = requestAnimationFrame(() => void tick());
      })
      .catch(() => setCameraError(true));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [supported, onDetected]);

  const submitManual = () => {
    if (manualCode.trim()) onDetected(manualCode.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      {supported && !cameraError ? (
        <div className="relative overflow-hidden rounded-xl bg-surface-3">
          <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
          <ScanLine className="pointer-events-none absolute inset-x-6 top-1/2 size-6 -translate-y-1/2 text-primary-text" aria-hidden />
        </div>
      ) : (
        <p className="text-sm text-muted">{cameraError ? t('scanner.cameraDenied') : t('scanner.notSupported')}</p>
      )}
      <FormField label={t('scanner.manualLabel')} hint={t('scanner.manualHint')}>
        <div className="flex gap-2">
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitManual();
            }}
            autoFocus={!supported || cameraError}
            placeholder={t('scanner.manualPlaceholder')}
            className="flex-1"
          />
          <Button type="button" onClick={submitManual} disabled={!manualCode.trim()}>
            {t('scanner.manualSubmit')}
          </Button>
        </div>
      </FormField>
    </div>
  );
}
