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
    <div className={`grid gap-[3px] ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
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
              "h-8 rounded-lg text-[11px] font-bold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 focus-visible:outline-offset-1 flex items-center justify-center min-w-0 px-1",
              isActive
                ? "bg-gradient-to-b from-cyan-400 to-cyan-500 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.30)]"
                : option.disabled
                ? "text-white/20 cursor-not-allowed"
                : "text-white/55 hover:bg-white/[0.06] hover:text-white/80 active:scale-[0.97]",
            ].join(" ")}
          >
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
