import type { ReactNode } from "react";

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function SidebarSection({ title, children, className = "" }: SidebarSectionProps) {
  return (
    <div className={`mt-4 shrink-0 px-3.5 ${className}`}>
      <p className="mb-2 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300/75">
        <span className="h-1 w-1 rounded-full bg-sky-400/80" />
        {title}
      </p>
      {children}
    </div>
  );
}
