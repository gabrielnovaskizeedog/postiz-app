import { AiCampaignsComponent } from '@gitroom/frontend/components/ai-campaigns/ai.campaigns.component';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} AI Campaigns`,
  description: '',
};

export default async function Page() {
  return <AiCampaignsComponent />;
}
