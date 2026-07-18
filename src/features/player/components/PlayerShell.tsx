import type { ReactNode } from "react";

interface PlayerShellProps {
  isMobile: boolean;
  isLandscape: boolean;
  hasSidebar: boolean;
  children: ReactNode;
}

export default function PlayerShell({
  isMobile,
  isLandscape,
  hasSidebar,
  children,
}: PlayerShellProps) {
  if (isMobile) {
    return (
      <div
        className={
          isLandscape
            ? "fixed inset-0 z-[9999] bg-black w-screen h-screen flex flex-col"
            : "fixed top-0 inset-x-0 z-[100] flex flex-col bg-black"
        }
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-row items-center justify-between p-6 bg-black"
      style={{
        paddingRight: hasSidebar ? "max(1.5rem, calc(430px + 1.5rem))" : undefined,
      }}
    >
      {children}
    </div>
  );
}
