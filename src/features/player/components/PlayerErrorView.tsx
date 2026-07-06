export function BrokenTvIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="15" x2="18" y2="15" />
      <line x1="11" y1="18" x2="16" y2="18" />
      <line x1="4" y1="4" x2="20" y2="20" className="text-red-400" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function PlayerErrorView() {
  return null;
}
