import React from 'react';

/** Single-weight line icons on a 24-unit grid. */
type P = {size?: number; color?: string; stroke?: number; fill?: string; style?: React.CSSProperties};
const Svg: React.FC<P & {children: React.ReactNode}> = ({size = 24, color = 'currentColor', stroke = 1.8, fill = 'none', style, children}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {children}
  </svg>
);

export const Spark: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 2.5C12.7 8.2 15.8 11.3 21.5 12 15.8 12.7 12.7 15.8 12 21.5 11.3 15.8 8.2 12.7 2.5 12 8.2 11.3 11.3 8.2 12 2.5Z" />
  </Svg>
);
export const Arrow: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </Svg>
);
export const Plane: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M21 15.5v-1.8l-7.6-4.9V4a1.4 1.4 0 0 0-2.8 0v4.8L3 13.7v1.8l7.6-2.4v4.8l-2 1.5V21l3.4-1 3.4 1v-1.6l-2-1.5v-4.8z" />
  </Svg>
);
export const Bed: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M3 5v14M3 14h18v5M3 17h18M6.5 11a1.8 1.8 0 1 0 0-.1M10 14v-3.5h7.5A3.5 3.5 0 0 1 21 14" />
  </Svg>
);
export const Weather: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M9 3v1.5M3.5 9H5M4.9 4.9l1 1M13.1 4.9l-1 1M6.2 11.4A3.5 3.5 0 1 1 12 7.6" />
    <path d="M17.5 20H9.2a4.2 4.2 0 1 1 3.6-6.4 3.3 3.3 0 0 1 4.7 6.4z" />
  </Svg>
);
export const Check: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M5 12.5l4.4 4.4L19 7.4" />
  </Svg>
);
export const Pin: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z" />
    <circle cx="12" cy="9.8" r="2.3" />
  </Svg>
);
export const Calendar: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);
export const Wallet: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6" />
    <path d="M16.5 13.5h.01" />
  </Svg>
);
