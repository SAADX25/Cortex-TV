import type { ReactNode } from "react";

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function SidebarSection({ title, children, className = "" }: SidebarSectionProps) {
  return (
    <div className={`mt-4 shrink-0 px-3 ${className}`}>
      <p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[0.26em] text-cyan-300/40">
        {title}
      </p>
      {children}
    </div>
  );
}
