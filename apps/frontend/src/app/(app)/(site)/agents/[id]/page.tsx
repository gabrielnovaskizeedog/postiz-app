import { Metadata } from 'next';
import { Agent } from '@gitroom/frontend/components/agents/agent';
import { AgentChat } from '@gitroom/frontend/components/agents/agent.chat';
export const metadata: Metadata = {
  title: 'SocialNovaskIA - Agente',
  description: '',
};
export default async function Page() {
  return (
    <AgentChat />
  );
}
