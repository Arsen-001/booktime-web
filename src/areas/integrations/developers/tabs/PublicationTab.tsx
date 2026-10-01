'use client';

/**
 * F-13-047: вкладка «Публикация» — чек-лист того, что проверяют на модерации (F-13-048), «Отправить на
 * проверку», и — пока у platform нет очереди (`qa/requests/integrations.md`) — демо-решение
 * «Одобрить/Отклонить». F-13-045: журнал событий приложения (отправлено/опубликовано/отклонено/отключено).
 */
import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { demoModerateDevApp, submitDevAppForReview, updateDevAppPublicationTexts } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import { DevAppStatusBadge } from '@/areas/integrations/developers/DevAppStatusBadge';
import { canSubmitDevAppForReview, devAppPublishChecklist, type DevApp, type DevAppPublicationTexts } from '@/domain/integrations';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { SectionCard } from '@/ui/SectionCard';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export function PublicationTab({ app, onChanged }: { app: DevApp; onChanged: () => void }) {
  const t = useT('integrations');
  const toast = useToast();
  const { dateTime } = useFormat();
  const [texts, setTexts] = useState<DevAppPublicationTexts>(app.publication);
  const submit = useApiMutation(() => submitDevAppForReview(app.id));
  const moderate = useApiMutation((decision: 'published' | 'rejected') => demoModerateDevApp(app.id, decision));
  const saveTexts = useApiMutation((patch: DevAppPublicationTexts) => updateDevAppPublicationTexts(app.id, patch));

  const checklist = devAppPublishChecklist(app);
  const byKey = new Map(checklist.map((i) => [i.key, i.done]));
  const canSubmit = canSubmitDevAppForReview(app) && app.status === 'draft';

  const onSaveTexts = async () => {
    try {
      await saveTexts.mutate(texts);
      toast.success(t('developers.publication.textsSaved'));
      onChanged();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onSubmit = async () => {
    try {
      await submit.mutate(undefined);
      toast.success(t('developers.app.sentForReview'));
      onChanged();
    } catch {
      toast.error(t('developers.app.registrationUrlRequired'));
    }
  };

  const onModerate = async (decision: 'published' | 'rejected') => {
    try {
      await moderate.mutate(decision);
      toast.success(decision === 'published' ? t('developers.app.demoPublished') : t('developers.app.demoRejected'));
      onChanged();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-047 F-13-048" className="flex flex-col gap-4">
      <SectionCard title={t('developers.publication.checklistTitle')} description={t('developers.publication.checklistHint')}>
        <ul className="flex flex-col gap-2">
          {checklist.map((item) => {
            const done = byKey.get(item.key) ?? false;
            const Icon = done ? CheckCircle2 : Circle;
            return (
              <li key={item.key} className={`flex items-center gap-2 text-sm ${done ? 'text-fg' : 'text-muted'}`}>
                <Icon className={`h-4 w-4 shrink-0 ${done ? 'text-success' : ''}`} aria-hidden />
                {t(`developers.publication.checklist.${item.key}` as never)}
                {!item.required && <span className="text-xs text-muted">{t('developers.publication.optionalMark')}</span>}
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard title={t('developers.publication.instructionsTitle')} description={t('developers.publication.instructionsHint')}>
        <div className="flex flex-col gap-4">
          <FormField label={t('developers.publication.connectInstructionsLabel')} required>
            <Textarea
              value={texts.connectInstructions}
              onChange={(e) => setTexts((v) => ({ ...v, connectInstructions: e.target.value }))}
              rows={3}
            />
          </FormField>
          <FormField label={t('developers.publication.paymentInstructionsLabel')} required>
            <Textarea
              value={texts.paymentInstructions}
              onChange={(e) => setTexts((v) => ({ ...v, paymentInstructions: e.target.value }))}
              rows={3}
            />
          </FormField>
          <Button variant="secondary" loading={saveTexts.isPending} onClick={onSaveTexts} className="self-start">
            {t('developers.publication.saveTexts')}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t('developers.publication.statusTitle')}>
        <div className="flex flex-col items-start gap-3">
          <DevAppStatusBadge status={app.status} />
          {app.status === 'draft' && (
            <Button loading={submit.isPending} onClick={onSubmit} disabled={!canSubmit}>
              {t('developers.app.submitForReview')}
            </Button>
          )}
          {app.status === 'review' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={moderate.isPending} onClick={() => onModerate('published')}>
                {t('developers.app.demoApprove')}
              </Button>
              <Button variant="ghost" loading={moderate.isPending} onClick={() => onModerate('rejected')}>
                {t('developers.app.demoReject')}
              </Button>
              <p className="w-full text-xs text-muted">{t('developers.publication.demoModerationHint')}</p>
            </div>
          )}
          {app.status === 'rejected' && <p className="text-sm text-danger">{t('developers.app.rejectedHint')}</p>}
          {app.status === 'published' && <p className="text-sm text-success">{t('developers.publication.publishedHint')}</p>}
        </div>
      </SectionCard>

      <SectionCard title={t('developers.publication.eventsTitle')}>
        {app.events.length === 0 ? (
          <EmptyState title={t('developers.publication.noEvents')} />
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            {[...app.events].reverse().map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-2">
                <span>{t(`developers.publication.events.${event.type}` as never)}</span>
                <span className="text-xs">{dateTime(event.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
