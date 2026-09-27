import React from 'react';

export const LogoTextComponent = () => {
  return (
    <svg
      width="236"
      height="40"
      viewBox="0 0 236 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
      <linearGradient id="snBgW" x1="2" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#8B5CF6"/><stop offset="0.5" stopColor="#612BD3"/><stop offset="1" stopColor="#E23DF0"/>
      </linearGradient>
      <linearGradient id="snTxt" x1="190" y1="0" x2="232" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#A78BFA"/><stop offset="1" stopColor="#F472F6"/>
      </linearGradient>
      </defs>
      <g transform="scale(0.5625)">
      <path d="M18 4H46C53.732 4 60 10.268 60 18V42C60 49.732 53.732 56 46 56H22L10.5 62.5C9.2 63.2 7.7 62.2 8 60.8L9.4 53.2C6.1 50.6 4 46.6 4 42V18C4 10.268 10.268 4 18 4Z" fill="url(#snBgW)"/>
      <path d="M20 42V19.5L44 40.5V18" stroke="#FFFFFF" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="20" cy="42" r="4.6" fill="#FFFFFF"/><circle cx="20" cy="42" r="2" fill="#612BD3"/>
      <circle cx="44" cy="40.5" r="4.6" fill="#FFFFFF"/><circle cx="44" cy="40.5" r="2" fill="#B53BEA"/>
      <circle cx="20" cy="19.5" r="3.2" fill="#FFFFFF"/>
      <path d="M50 7.5C50.6 11.4 51.6 12.4 55.5 13C51.6 13.6 50.6 14.6 50 18.5C49.4 14.6 48.4 13.6 44.5 13C48.4 12.4 49.4 11.4 50 7.5Z" fill="#FFE27A"/>
      </g>
      <text x="44" y="27" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif" fontSize="21" letterSpacing="-0.4" fill="currentColor"><tspan fontWeight="400" opacity="0.85">Social</tspan><tspan fontWeight="700">Novask</tspan><tspan fontWeight="800" fill="url(#snTxt)">IA</tspan></text>
    </svg>
  );
};
