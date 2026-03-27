import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { FileEntry } from "../hooks/useScanner";
import { formatBytes } from "../utils/format";
import { SizeBar } from "./SizeBar";

type SortKey = "name" | "size";

type TreeTableProps = {
  entries: FileEntry[];
  onOpenFolder: (path: string) => void;
  onExpandLazy: (path: string) => void;
  onTrash?: (entry: FileEntry) => void;
};

function Row({
  entry,
  depth,
  maxSize,
  sortKey,
  sortDir,
  onOpenFolder,
  onExpandLazy,
  onTrash,
}: {
  entry: FileEntry;
  depth: number;
  maxSize: number;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onOpenFolder: (path: string) => void;
  onExpandLazy: (path: string) => void;
  onTrash?: (entry: FileEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasVisualChildren =
    entry.isDir &&
    ((entry.children && entry.children.length > 0) || entry.lazyUnloaded);

  const sortedKids = useMemo(() => {
    const kids = entry.children ?? [];
    const copy = [...kids];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else cmp = a.size === b.size ? a.name.localeCompare(b.name) : a.size - b.size;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [entry.children, sortKey, sortDir]);

  const toggle = () => {
    if (!entry.isDir) return;
    if (entry.lazyUnloaded && !expanded) {
      void onExpandLazy(entry.path);
    }
    setExpanded((e) => !e);
  };

  const open = () => {
    if (entry.isDir) onOpenFolder(entry.path);
  };

  return (
    <>
      <tr className="border-b border-zinc-800/80 hover:bg-zinc-900/80 group">
        <td className="py-2 pr-2 align-middle">
          <div
            className="flex items-center gap-1"
            style={{ paddingLeft: depth * 16 }}
          >
            {hasVisualChildren ? (
              <button
                type="button"
                onClick={toggle}
                className="p-0.5 rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                aria-expanded={expanded}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-5 inline-block" />
            )}
            <button
              type="button"
              onClick={open}
              className="flex items-center gap-2 min-w-0 text-left hover:text-emerald-400"
            >
              {entry.isDir ? (
                <Folder className="h-4 w-4 shrink-0 text-amber-500/90" strokeWidth={1.75} />
              ) : (
                <File className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
              )}
              <span className="truncate font-medium text-zinc-200">{entry.name}</span>
              {entry.lazyUnloaded ? (
                <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                  lazy
                </span>
              ) : null}
            </button>
          </div>
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-zinc-300 whitespace-nowrap">
          {formatBytes(entry.size)}
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-zinc-500">
          {entry.isDir ? entry.itemCount : "—"}
        </td>
        <td className="py-2 pl-3">
          <SizeBar value={entry.size} max={maxSize} />
        </td>
        {onTrash ? (
          <td className="py-2 pl-2 w-12 text-right align-middle">
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onTrash(entry);
              }}
              className="p-2 rounded-lg text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-red-950/50 hover:text-red-400 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              title="Move to Trash"
              aria-label={`Move ${entry.name} to Trash`}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </td>
        ) : null}
      </tr>
      {expanded && hasVisualChildren
        ? sortedKids.map((c) => (
            <Row
              key={c.path}
              entry={c}
              depth={depth + 1}
              maxSize={maxSize}
              sortKey={sortKey}
              sortDir={sortDir}
              onOpenFolder={onOpenFolder}
              onExpandLazy={onExpandLazy}
              onTrash={onTrash}
            />
          ))
        : null}
    </>
  );
}

export function TreeTable({
  entries,
  onOpenFolder,
  onExpandLazy,
  onTrash,
}: TreeTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("size");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else cmp = a.size === b.size ? a.name.localeCompare(b.name) : a.size - b.size;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [entries, sortKey, sortDir]);

  const maxSize = useMemo(
    () => sorted.reduce((m, e) => Math.max(m, e.size), 0),
    [sorted]
  );

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "size" ? "desc" : "asc");
    }
  };

  const headerBtn = (k: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1 font-medium hover:text-emerald-400 ${
        sortKey === k ? "text-zinc-100" : "text-zinc-400"
      }`}
    >
      {label}
      {sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  if (!sorted.length) {
    return (
      <p className="text-sm text-zinc-500 py-8 text-center">Nothing in this folder.</p>
    );
  }

  return (
    <div className="overflow-auto max-h-[min(52vh,560px)] rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur z-10 border-b border-zinc-800">
          <tr>
            <th className="text-left py-2 px-2">{headerBtn("name", "Name")}</th>
            <th className="text-right py-2 px-3">{headerBtn("size", "Size")}</th>
            <th className="text-right py-2 px-3 text-zinc-400 font-medium">Items</th>
            <th className="text-left py-2 pl-3 text-zinc-400 font-medium w-[140px]">
              Share
            </th>
            {onTrash ? (
              <th className="w-12 py-2 pl-2" aria-label="Actions" />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <Row
              key={e.path}
              entry={e}
              depth={0}
              maxSize={maxSize}
              sortKey={sortKey}
              sortDir={sortDir}
              onOpenFolder={onOpenFolder}
              onExpandLazy={onExpandLazy}
              onTrash={onTrash}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
