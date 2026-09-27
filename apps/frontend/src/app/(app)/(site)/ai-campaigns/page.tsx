import { AiCampaignsComponent } from '@gitroom/frontend/components/ai-campaigns/ai.campaigns.component';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: `SocialNovaskIA - Campanhas IA`,
  description: '',
};

export default async function Page() {
  return <AiCampaignsComponent />;
}
