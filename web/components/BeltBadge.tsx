// A little belt drawn in the belt's colour.
export default function BeltBadge({ color, size = 40, title }: { color: string; size?: number; title?: string }) {
  const light = ["#f8fafc", "#facc15"].includes(color.toLowerCase());
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 50 30" role="img" aria-label={title}>
      {title && <title>{title}</title>}
      <rect x="2" y="9" width="46" height="10" rx="2" fill={color} stroke={light ? "#94a3b8" : "none"} />
      <path d="M21 19 L15 29 L20 29 L25 21 L30 29 L35 29 L29 19 Z" fill={color} stroke={light ? "#94a3b8" : "none"} />
      <rect x="20" y="7" width="10" height="14" rx="2" fill={color} stroke={light ? "#64748b" : "#00000040"} />
    </svg>
  );
}
