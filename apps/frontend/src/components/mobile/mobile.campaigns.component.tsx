'use client';

import React, { FC } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  CampaignCard,
  NewCampaign,
  useAiCampaigns,
  useIntegrationsList,
} from '@gitroom/frontend/components/ai-campaigns/ai.campaigns.component';

export const MobileCampaignsComponent: FC = () => {
  const t = useT();
  const { data: campaigns, isLoading, mutate } = useAiCampaigns();
  const { data: integrations } = useIntegrationsList();

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex items-center justify-between gap-[12px]">
        <div className="text-[20px] font-[600]">
          {t('ai_campaigns', 'AI Campaigns')}
        </div>
        <Link
          href="/m/nova"
          className="px-[14px] py-[8px] rounded-[8px] bg-[#612BD3] text-white text-[13px]"
        >
          {t('mobile_new_week', 'Plan a week')}
        </Link>
      </div>

      {isLoading && (
        <div className="h-[200px] rounded-[12px] bg-newSep animate-pulse" />
      )}

      {!isLoading && !campaigns?.length && (
        <div className="text-center opacity-60 py-[60px] text-[14px]">
          {t('ai_campaigns_empty', 'You have no AI campaigns yet')}
        </div>
      )}

      {campaigns?.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          integrations={integrations || []}
          onChange={() => mutate()}
        />
      ))}
    </div>
  );
};

export const MobileNewCampaignComponent: FC = () => {
  const t = useT();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[4px]">
        <div className="text-[20px] font-[600]">
          {t('mobile_new_week_title', 'Plan the week')}
        </div>
        <div className="text-[13px] opacity-70">
          {t(
            'mobile_new_week_description',
            'Pick the days and the time, the AI researches what is trending and writes the posts. Nothing is published before you approve it.'
          )}
        </div>
      </div>
      <NewCampaign
        weekly
        onCreated={() => router.push('/m/campanhas')}
        onCancel={() => router.push('/m')}
      />
    </div>
  );
};
