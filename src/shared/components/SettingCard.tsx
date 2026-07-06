import type { ReactNode } from "react";

interface SettingCardProps {
  children: ReactNode;
  className?: string;
}

export function SettingCard({ children, className = "" }: SettingCardProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}>
      {children}
    </div>
  );
}
