import { BrandKitComponent } from '@gitroom/frontend/components/brand-kit/brand.kit.component';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SocialNovaskIA - Minha marca',
  description: '',
};

export default async function Page() {
  return (
    <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col">
      <BrandKitComponent />
    </div>
  );
}
