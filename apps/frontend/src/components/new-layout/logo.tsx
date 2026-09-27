'use client';

// SocialNovaskIA mark: a speech bubble (social) with an "N" drawn as a flow
// of connected nodes (automation) and a spark (AI)
export const Logo = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="60"
      height="60"
      viewBox="0 0 64 64"
      fill="none"
      className="mt-[8px] min-w-[60px] min-h-[60px]"
    >
      <defs>
      <linearGradient id="snBg" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#8B5CF6"/>
      <stop offset="0.5" stopColor="#612BD3"/>
      <stop offset="1" stopColor="#E23DF0"/>
      </linearGradient>
      <linearGradient id="snShine" x1="32" y1="4" x2="32" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28"/>
      <stop offset="1" stopColor="#FFFFFF" stopOpacity="0"/>
      </linearGradient>
      </defs>
      <path d="M18 4H46C53.732 4 60 10.268 60 18V42C60 49.732 53.732 56 46 56H22L10.5 62.5C9.2 63.2 7.7 62.2 8 60.8L9.4 53.2C6.1 50.6 4 46.6 4 42V18C4 10.268 10.268 4 18 4Z" fill="url(#snBg)"/>
      <path d="M18 4H46C53.732 4 60 10.268 60 18V26C48 32 16 32 4 26V18C4 10.268 10.268 4 18 4Z" fill="url(#snShine)"/>
      <path d="M20 42V19.5L44 40.5V18" stroke="#FFFFFF" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="20" cy="42" r="4.6" fill="#FFFFFF"/>
      <circle cx="20" cy="42" r="2" fill="#612BD3"/>
      <circle cx="44" cy="40.5" r="4.6" fill="#FFFFFF"/>
      <circle cx="44" cy="40.5" r="2" fill="#B53BEA"/>
      <circle cx="20" cy="19.5" r="3.2" fill="#FFFFFF"/>
      <path d="M50 7.5C50.6 11.4 51.6 12.4 55.5 13C51.6 13.6 50.6 14.6 50 18.5C49.4 14.6 48.4 13.6 44.5 13C48.4 12.4 49.4 11.4 50 7.5Z" fill="#FFE27A"/>
    </svg>
  );
};
