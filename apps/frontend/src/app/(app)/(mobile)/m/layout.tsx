import { ReactNode } from 'react';
import { Metadata } from 'next';
import { MobileLayoutComponent } from '@gitroom/frontend/components/mobile/mobile.layout.component';

export const metadata: Metadata = {
  title: 'SocialNovaskIA',
  description: '',
};

export default function Layout({ children }: { children: ReactNode }) {
  return <MobileLayoutComponent>{children}</MobileLayoutComponent>;
}
