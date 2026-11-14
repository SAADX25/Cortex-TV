import type { CSSProperties } from "react";

const paths = {
  play: "m9 5 11 7-11 7z", pause: "M8 5v14M16 5v14", close: "m6 6 12 12M18 6 6 18",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  globe: "M2 12h20M12 2a18 18 0 0 1 0 20 18 18 0 0 1 0-20M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  star: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3z",
  tv: "M3 7h18v14H3zM7 2l5 5 5-5", menu: "M4 6h16M4 12h16M4 18h16",
  next: "m5 5 11 7-11 7zM20 5v14", prev: "m19 5-11 7 11 7zM4 5v14", back: "m15 5-7 7 7 7", retry: "M20 8a9 9 0 1 0 1 7M21 3v6h-6",
  chevronUp: "m18 15-6-6-6 6", chevronDown: "m6 9 6 6 6-6",
  volume: "m11 4-6 4H2v8h3l6 4zM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16",
  mute: "m11 4-6 4H2v8h3l6 4zM16 9l6 6M22 9l-6 6",
  fullscreen: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5",
  pip: "M3 4h18v16H3zM12 11h7v7h-7z", aspect: "M3 5h18v14H3zM7 9v6M17 9v6",
  clock: "M12 7v5l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  settings: "m12 2 3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4zM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  news: "M3 3h18v18H3zM7 7h10M7 12h4M7 16h10", arrow: "M4 12h16m-6-6 6 6-6 6",
} as const;
export type IconName = keyof typeof paths;
export default function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
