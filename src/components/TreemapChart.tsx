import { useMemo } from "react";
import {
  ResponsiveContainer,
  Treemap,
  Tooltip,
  type TooltipProps,
} from "recharts";

import type { FileEntry } from "../hooks/useScanner";
import { formatBytes } from "../utils/format";

type TreemapPayload = {
  name: string;
  size: number;
  path: string;
  isDir: boolean;
  fill?: string;
};

const COLORS = [
  "#34d399",
  "#2dd4bf",
  "#22d3ee",
  "#38bdf8",
  "#60a5fa",
  "#818cf8",
  "#a78bfa",
  "#c084fc",
  "#e879f9",
  "#fb7185",
];

function cellFill(index: number) {
  return COLORS[index % COLORS.length] ?? "#34d399";
}

type TreemapNodeProps = {
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  index?: number;
  payload?: TreemapPayload;
};

type TreemapContentProps = TreemapNodeProps & {
  onCellClick: (p: TreemapPayload) => void;
};

function TreemapContent(props: TreemapContentProps) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    name,
    index = 0,
    payload,
    onCellClick,
  } = props;
  if (width < 4 || height < 4) return null;
  const fill = payload?.fill ?? cellFill(index);
  const p = payload;
  return (
    <g className="cursor-pointer">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={0.72}
        stroke="#09090b"
        strokeWidth={1}
        rx={2}
        onClick={() => p && onCellClick(p)}
      />
      {width > 56 && height > 20 ? (
        <text
          x={x + 6}
          y={y + 16}
          fill="#fafafa"
          fontSize={11}
          fontWeight={600}
          className="pointer-events-none"
        >
          {name && name.length > 24 ? `${name.slice(0, 22)}…` : name}
        </text>
      ) : null}
      {width > 56 && height > 36 ? (
        <text
          x={x + 6}
          y={y + 30}
          fill="#e4e4e7"
          fontSize={10}
          className="pointer-events-none opacity-90"
        >
          {p ? formatBytes(p.size) : ""}
        </text>
      ) : null}
    </g>
  );
}

function TreemapTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload as TreemapPayload | undefined;
  if (!item) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold text-zinc-100">{item.name}</div>
      <div className="text-zinc-400">{formatBytes(item.size)}</div>
      {item.isDir ? (
        <div className="text-zinc-500 mt-1">Click to open folder</div>
      ) : null}
    </div>
  );
}

type TreemapChartProps = {
  entries: FileEntry[];
  onOpenFolder: (path: string) => void;
};

export function TreemapChart({ entries, onOpenFolder }: TreemapChartProps) {
  const data = useMemo(() => {
    const list: TreemapPayload[] = entries
      .filter((e) => e.size > 0)
      .map((e, i) => ({
        name: e.name,
        size: e.size,
        path: e.path,
        isDir: e.isDir,
        fill: cellFill(i),
      }));
    const total = list.reduce((s, e) => s + e.size, 0);
    return [
      {
        name: "root",
        size: total,
        path: "",
        isDir: true,
        children: list,
      },
    ];
  }, [entries]);

  const onCellClick = (p: TreemapPayload) => {
    if (p.isDir) onOpenFolder(p.path);
  };

  if (!entries.filter((e) => e.size > 0).length) {
    return (
      <div className="flex h-[min(52vh,560px)] items-center justify-center rounded-lg border border-zinc-800 text-sm text-zinc-500">
        No sized items to chart.
      </div>
    );
  }

  return (
    <div className="h-[min(52vh,560px)] min-h-[280px] rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="size"
          nameKey="name"
          stroke="#09090b"
          isAnimationActive={false}
          content={<TreemapContent onCellClick={onCellClick} />}
        >
          <Tooltip content={<TreemapTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
