'use client';

/** Вкладка «Файлы» карточки клиента (F-04-086). Раздел «clients». */
import { useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Download, File as FileIcon, Trash2, Upload } from 'lucide-react';
import { clientFileHref, clientFileMaxMb, deleteFile, listFiles, uploadClientFile } from '@/api/clients';
import { useApiMutation, useApiQuery } from '@/api/request';
import { CLIENT_FILE_EXTENSIONS } from '@/domain/clients';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Skeleton } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';
import { useToast } from '@/ui/Toast';

export interface FilesTabProps {
  clientId: string;
  uploaderName: string;
  /** F-04-198: тонкие права «Загружать файлы» / «Удалять файлы» — не заданы, берём грубое clients.edit */
  canUpload?: boolean;
  canDelete?: boolean;
}

const ACCEPT = CLIENT_FILE_EXTENSIONS.map((e) => `.${e}`).join(',');

function extOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/** Ошибка загрузки → ключ текста (сервер проверяет тип по содержимому файла, размер и место) */
function uploadErrorKey(error: unknown): 'card.files.tooBig' | 'card.files.badExt' | 'card.files.quota' | 'card.files.tooMany' | 'card.files.network' | 'card.files.uploadFailed' {
  switch ((error as { code?: string } | null)?.code) {
    case 'file_too_large':
    case 'too_big':
      return 'card.files.tooBig';
    case 'unsupported_file':
    case 'bad_ext':
      return 'card.files.badExt';
    case 'upload_quota':
      return 'card.files.quota';
    case 'rate_limited':
      return 'card.files.tooMany';
    case 'network':
      return 'card.files.network';
    default:
      return 'card.files.uploadFailed';
  }
}

/** Размер файла на языке интерфейса (было «КБ/МБ» по-русски на любом языке) */
function formatSize(bytes: number, locale: string): string {
  const small = bytes < 1024 * 1024;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: small ? 'kilobyte' : 'megabyte',
    unitDisplay: 'short',
    maximumFractionDigits: small ? 0 : 1,
  }).format(small ? Math.max(1, Math.round(bytes / 1024)) : bytes / (1024 * 1024));
}

export function FilesTab({ clientId, uploaderName, canUpload: canUploadProp, canDelete: canDeleteProp }: FilesTabProps) {
  const t = useT('clients');
  const fmt = useFormat();
  const locale = useLocale();
  const toast = useToast();
  const canEditCoarse = useCan('clients.edit');
  const canUpload = canUploadProp ?? canEditCoarse;
  const canDelete = canDeleteProp ?? canEditCoarse;
  const inputRef = useRef<HTMLInputElement>(null);

  const filesQ = useApiQuery(['clients', 'files', clientId], () => listFiles(clientId), { enabled: Boolean(clientId) });
  // Режим api: файл уходит на сервер как есть (закрытое хранилище) с процентом; мок — data: URL, как раньше
  const upload = useApiMutation((args: { file: File; onProgress: (f: number) => void }) =>
    uploadClientFile({ clientId, file: args.file, uploadedBy: uploaderName }, { onProgress: args.onProgress }),
  );
  const [progress, setProgress] = useState<number | null>(null);
  const maxMb = clientFileMaxMb();
  const remove = useApiMutation((args: { clientId: string; fileId: string }) => deleteFile(args.clientId, args.fileId));
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(filesQ.data ?? []);

  const handleFiles = async (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list)) {
      const ext = extOf(file.name);
      if (!(CLIENT_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
        toast.error(t('card.files.badExt'));
        continue;
      }
      if (file.size > maxMb * 1024 * 1024) {
        toast.error(t('card.files.tooBig', { mb: maxMb }));
        continue;
      }
      setProgress(0);
      try {
        await upload.mutate({ file, onProgress: setProgress });
      } catch (e) {
        toast.error(t(uploadErrorKey(e), { mb: maxMb }));
      } finally {
        setProgress(null);
      }
    }
    filesQ.refetch();
  };

  if (filesQ.isError) return <ErrorState onRetry={filesQ.refetch} />;
  if (filesQ.isLoading) return <Skeleton lines={3} />;

  const files = filesQ.data ?? [];

  return (
    <div data-f="F-04-086 F-04-198" className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('card.files.hint', { mb: maxMb })}</p>
        {canUpload && (
          <Button size="sm" variant="outline" leftIcon={<Upload aria-hidden />} loading={upload.isPending} onClick={() => inputRef.current?.click()}>
            {progress !== null && progress > 0 ? t('card.files.uploading', { pct: Math.round(progress * 100) }) : t('card.files.upload')}
          </Button>
        )}
      </div>

      {files.length === 0 ? (
        <EmptyState
          title={t('card.files.emptyTitle')}
          description={t('card.files.emptyText')}
          action={
            canUpload ? (
              <Button size="sm" leftIcon={<Upload aria-hidden />} onClick={() => inputRef.current?.click()}>
                {t('card.files.upload')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {pageItems.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <FileIcon aria-hidden className="size-5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{f.name}</p>
                <p className="text-xs text-muted">
                  {formatSize(f.size, locale)} · {fmt.dateTime(f.uploadedAt)} · {f.uploadedBy}
                </p>
              </div>
              <a
                href={clientFileHref(f)}
                download={f.name}
                aria-label={t('card.files.download')}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-fg hover:bg-surface-2 active:bg-surface-3 [&_svg]:size-4"
              >
                <Download aria-hidden />
              </a>
              {canDelete && (
                <IconButton
                  icon={<Trash2 aria-hidden />}
                  label={t('card.files.delete')}
                  size="sm"
                  onClick={async () => {
                    await remove.mutate({ clientId, fileId: f.id });
                    filesQ.refetch();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {pager}
    </div>
  );
}
