export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { Activate } from '@gitroom/frontend/components/auth/activate';
export const metadata: Metadata = {
  title: 'SocialNovaskIA - Ativar sua conta',
  description: '',
};
export default async function Auth() {
  return <Activate />;
}
