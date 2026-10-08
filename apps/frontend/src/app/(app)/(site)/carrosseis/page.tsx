import { AiCarouselsComponent } from '@gitroom/frontend/components/ai-carousels/ai.carousels.component';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SocialNovaskIA - Carrosséis IA',
  description: '',
};

export default async function Page() {
  return <AiCarouselsComponent />;
}
