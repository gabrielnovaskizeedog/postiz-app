'use client';

import React, { FC, ReactNode, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const useSelf = () => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return (await fetch(path)).json();
  }, []);

  return useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
};

const TABS = [
  {
    path: '/m',
    key: 'mobile_tab_agenda',
    fallback: 'Schedule',
    icon: (
      <path
        d="M19.5 9.5H1.5M14.5 1.5V5.5M6.5 1.5V5.5M6.3 21.5H14.7C16.38 21.5 17.22 21.5 17.86 21.17C18.43 20.89 18.89 20.43 19.17 19.86C19.5 19.22 19.5 18.38 19.5 16.7V8.3C19.5 6.62 19.5 5.78 19.17 5.14C18.89 4.57 18.43 4.11 17.86 3.83C17.22 3.5 16.38 3.5 14.7 3.5H6.3C4.62 3.5 3.78 3.5 3.14 3.83C2.57 4.11 2.11 4.57 1.83 5.14C1.5 5.78 1.5 6.62 1.5 8.3V16.7C1.5 18.38 1.5 19.22 1.83 19.86C2.11 20.43 2.57 20.89 3.14 21.17C3.78 21.5 4.62 21.5 6.3 21.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    path: '/m/campanhas',
    key: 'mobile_tab_campaigns',
    fallback: 'Campaigns',
    icon: (
      <path
        d="M9.5 2L11 7.5L16.5 9L11 10.5L9.5 16L8 10.5L2.5 9L8 7.5L9.5 2ZM17.5 13L18.25 15.25L20.5 16L18.25 16.75L17.5 19L16.75 16.75L14.5 16L16.75 15.25L17.5 13Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    path: '/m/nova',
    key: 'mobile_tab_new',
    fallback: 'New week',
    icon: (
      <path
        d="M11 6.5V15.5M6.5 11H15.5M21 11C21 16.52 16.52 21 11 21C5.48 21 1 16.52 1 11C1 5.48 5.48 1 11 1C16.52 1 21 5.48 21 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

const BottomNav: FC = () => {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-[50] bg-newBgColorInner border-t border-newBorder pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-3 max-w-[640px] mx-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.path}
            href={tab.path}
            className={clsx(
              'flex flex-col items-center gap-[4px] py-[10px] text-[12px]',
              pathname === tab.path ? 'text-[#A78BFA]' : 'opacity-60'
            )}
          >
            <svg width="22" height="23" viewBox="0 0 22 23" fill="none">
              {tab.icon}
            </svg>
            {t(tab.key, tab.fallback)}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export const MobileLayoutComponent: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const t = useT();
  const { data: user } = useSelf();

  // Makes the app installable on the phone home screen
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (!user) return null;

  return (
    <ContextWrapper user={user}>
      <MantineWrapper>
        <Toaster />
        <div className="min-h-screen flex flex-col bg-newBgColor text-newTextColor">
          <header className="sticky top-0 z-[40] bg-newBgColorInner border-b border-newBorder pt-[env(safe-area-inset-top)]">
            <div className="max-w-[640px] mx-auto flex items-center justify-between px-[16px] h-[56px]">
              <div className="flex items-center gap-[8px]">
                <img src="/logo.svg" alt="SocialNovaskIA" className="w-[30px] h-[30px]" />
                <div className="text-[17px]">
                  Social<b>Novask</b>
                  <b className="text-[#C084FC]">IA</b>
                </div>
              </div>
              <a href="/launches" className="text-[12px] opacity-60 underline">
                {t('mobile_full_version', 'Full version')}
              </a>
            </div>
          </header>
          <main className="flex-1 w-full max-w-[640px] mx-auto px-[16px] pt-[16px] pb-[96px]">
            {children}
          </main>
          <BottomNav />
        </div>
      </MantineWrapper>
    </ContextWrapper>
  );
};
