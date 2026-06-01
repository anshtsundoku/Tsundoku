// Monoline book stack for interstitials. `count` is 1–6; spines grow slightly each layer.
const LAYOUT = [
  { dx: 0, dy: 0, w: 72, h: 10 },
  { dx: 3, dy: 16, w: 76, h: 11 },
  { dx: -2, dy: 32, w: 80, h: 12 },
  { dx: 4, dy: 49, w: 84, h: 13 },
  { dx: -1, dy: 67, w: 88, h: 14 },
  { dx: 2, dy: 86, w: 92, h: 15 },
];

export default function BookStack({ count = 1 }) {
  const n = Math.min(6, Math.max(1, count));
  const baseX = 14;
  return (
    <svg
      viewBox="0 0 120 140"
      className="w-[120px] h-[140px] text-wood mx-auto block"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {LAYOUT.slice(0, n).map((b, i) => (
        <g key={i}>
          <rect x={baseX + b.dx} y={b.dy} width={b.w} height={b.h} rx="1" />
          <line x1={baseX + b.dx + 8} y1={b.dy + 2} x2={baseX + b.dx + 8} y2={b.dy + b.h - 2} />
          <line x1={baseX + b.dx + b.w - 10} y1={b.dy + 3} x2={baseX + b.dx + b.w - 14} y2={b.dy + b.h - 3} />
        </g>
      ))}
    </svg>
  );
}
