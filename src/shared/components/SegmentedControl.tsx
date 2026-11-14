import type { ReactNode } from "react";

export interface SegmentedOption<T> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  tooltip?: string;
}

interface SegmentedControlProps<T> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div className={`grid gap-1 rounded-lg bg-[#050f24]/80 p-1 border border-blue-400/10 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            disabled={option.disabled}
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            title={option.tooltip}
            className={[
              "h-8 rounded-md text-[11px] font-bold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-1 flex items-center justify-center min-w-0 px-1.5",
              isActive
                ? "bg-gradient-to-b from-blue-500 to-blue-600 text-white border border-sky-300/35 shadow-[0_4px_14px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]"
                : option.disabled
                ? "text-blue-200/25 cursor-not-allowed"
                : "text-blue-100/70 hover:bg-blue-500/15 hover:text-white active:scale-[0.97]",
            ].join(" ")}
          >
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
