'use client';

/** /platform/connect — подключить салон на визите (F-00-176): список начатых, мастер шагов, экран «передать владельцу». */
import { useSearchParams } from 'next/navigation';
import { ConnectHandoff } from '@/areas/platform/connect/ConnectHandoff';
import { ConnectStart } from '@/areas/platform/connect/ConnectStart';
import { ConnectWizard } from '@/areas/platform/connect/ConnectWizard';

export function ConnectScreen() {
  const params = useSearchParams();
  const draftId = params.get('draft');
  const doneId = params.get('done');
  if (doneId) return <ConnectHandoff businessId={doneId} />;
  if (draftId) return <ConnectWizard key={draftId} draftId={draftId} />;
  return <ConnectStart visitId={params.get('visit') ?? undefined} />;
}
