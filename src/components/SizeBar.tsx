type SizeBarProps = {
  value: number;
  max: number;
};

export function SizeBar({ value, max }: SizeBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-2 flex-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500/80 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-500 w-8 tabular-nums text-right">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}
