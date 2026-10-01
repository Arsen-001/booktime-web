'use client';

/**
 * Тексты «Пригласи подругу» в приложении клиента: награды словами и готовое сообщение подруге со ссылкой.
 * Полный адрес ссылки — от адреса сайта (window.location.origin), путь отдаёт сервер.
 */
import type { ReferralInvite, ReferralReward } from '@/api/referral';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';

export function useReferralTexts() {
  const t = useT('client');
  const fmt = useFormat();
  const inviteeReward = (r: ReferralReward | undefined) =>
    r ? (r.valueType === 'percent' ? t('referral.reward.inviteePercent', { value: r.value }) : t('referral.reward.inviteeFixed', { amount: fmt.money(r.value) })) : t('referral.reward.inviteeNone');
  const referrerReward = (r: ReferralReward | undefined) =>
    r ? (r.valueType === 'percent' ? t('referral.reward.referrerPercent', { value: r.value }) : t('referral.reward.referrerFixed', { amount: fmt.money(r.value) })) : t('referral.reward.referrerNone');
  const urlOf = (invite: ReferralInvite) => (typeof window === 'undefined' ? invite.path : `${window.location.origin}${invite.path}`);
  return {
    rewards: (invite: ReferralInvite) => t('referral.rewards', { invitee: inviteeReward(invite.inviteeReward), referrer: referrerReward(invite.referrerReward) }),
    url: urlOf,
    message: (invite: ReferralInvite) => t('referral.shareMessage', { business: invite.businessName, reward: inviteeReward(invite.inviteeReward), url: urlOf(invite) }),
    telegramText: (invite: ReferralInvite) => t('referral.shareTelegram', { business: invite.businessName, reward: inviteeReward(invite.inviteeReward) }),
  };
}
