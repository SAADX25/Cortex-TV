import type { ReactNode } from "react";

interface SettingCardProps {
  children: ReactNode;
  className?: string;
}

export function SettingCard({ children, className = "" }: SettingCardProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-blue-400/20 bg-gradient-to-b from-[#0d2148]/75 to-[#07142e]/85 p-2 shadow-[inset_0_1px_0_rgba(191,219,254,0.08),0_4px_16px_rgba(2,8,24,0.3)] ${className}`}>
      {children}
    </div>
  );
}
