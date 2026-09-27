import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'SocialNovaskIA - Agente',
  description: '',
};

export default async function Page() {
  return redirect('/agents/new');
}
