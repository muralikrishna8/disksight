import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { FileEntry } from "../hooks/useScanner";
import { formatBytes } from "../utils/format";
import { SizeBar } from "./SizeBar";

const VISIBLE_CHILDREN_CHUNK = 500;

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

  const [visibleChildCount, setVisibleChildCount] = useState(VISIBLE_CHILDREN_CHUNK);
  useEffect(() => {
    setVisibleChildCount(VISIBLE_CHILDREN_CHUNK);
  }, [sortedKids.length, entry.path, sortKey, sortDir]);

  const visibleKids =
    sortedKids.length > visibleChildCount
      ? sortedKids.slice(0, visibleChildCount)
      : sortedKids;
  const hiddenChildCount = sortedKids.length - visibleKids.length;

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
      <tr className="border-b border-zinc-200/90 hover:bg-zinc-50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/80 group">
        <td className="py-2 pr-2 align-middle">
          <div
            className="flex items-center gap-1"
            style={{ paddingLeft: depth * 16 }}
          >
            {hasVisualChildren ? (
              <button
                type="button"
                onClick={toggle}
                className="p-0.5 rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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
              className="flex items-center gap-2 min-w-0 text-left hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              {entry.isDir ? (
                <Folder className="h-4 w-4 shrink-0 text-amber-500/90" strokeWidth={1.75} />
              ) : (
                <File className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
              )}
              <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                {entry.name}
              </span>
              {entry.lazyUnloaded ? (
                <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-600">
                  lazy
                </span>
              ) : null}
            </button>
          </div>
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-zinc-700 whitespace-nowrap dark:text-zinc-300">
          {formatBytes(entry.size)}
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-zinc-600 dark:text-zinc-500">
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
              className="p-2 rounded-lg text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:hover:bg-red-950/50 dark:hover:text-red-400"
              title="Move to Trash"
              aria-label={`Move ${entry.name} to Trash`}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </td>
        ) : null}
      </tr>
      {expanded && hasVisualChildren ? (
        <>
          {visibleKids.map((c) => (
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
          ))}
          {hiddenChildCount > 0 ? (
            <tr className="border-b border-zinc-200/90 dark:border-zinc-800/80">
              <td
                colSpan={onTrash ? 5 : 4}
                className="py-2 pr-2"
                style={{ paddingLeft: (depth + 1) * 16 + 24 }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setVisibleChildCount((n) => n + VISIBLE_CHILDREN_CHUNK)
                  }
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-600 dark:text-emerald-500/90 dark:hover:text-emerald-400"
                >
                  Show more ({hiddenChildCount.toLocaleString()} hidden)
                </button>
              </td>
            </tr>
          ) : null}
        </>
      ) : null}
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

  const [visibleRootCount, setVisibleRootCount] = useState(VISIBLE_CHILDREN_CHUNK);
  useEffect(() => {
    setVisibleRootCount(VISIBLE_CHILDREN_CHUNK);
  }, [sorted.length, sortKey, sortDir]);

  const visibleRoot =
    sorted.length > visibleRootCount ? sorted.slice(0, visibleRootCount) : sorted;
  const hiddenRootCount = sorted.length - visibleRoot.length;

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
      className={`inline-flex items-center gap-1 font-medium hover:text-emerald-600 dark:hover:text-emerald-400 ${
        sortKey === k
          ? "text-zinc-900 dark:text-zinc-100"
          : "text-zinc-600 dark:text-zinc-400"
      }`}
    >
      {label}
      {sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  if (!sorted.length) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-500 py-8 text-center">
        Nothing in this folder.
      </p>
    );
  }

  return (
    <div className="overflow-auto max-h-[min(52vh,560px)] rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <tr>
            <th className="text-left py-2 px-2">{headerBtn("name", "Name")}</th>
            <th className="text-right py-2 px-3">{headerBtn("size", "Size")}</th>
            <th className="text-right py-2 px-3 font-medium text-zinc-600 dark:text-zinc-400">
              Items
            </th>
            <th className="text-left py-2 pl-3 font-medium text-zinc-600 w-[140px] dark:text-zinc-400">
              Share
            </th>
            {onTrash ? (
              <th className="w-12 py-2 pl-2" aria-label="Actions" />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {visibleRoot.map((e) => (
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
          {hiddenRootCount > 0 ? (
            <tr className="border-b border-zinc-200/90 dark:border-zinc-800/80">
              <td
                colSpan={onTrash ? 5 : 4}
                className="py-2 px-2"
              >
                <button
                  type="button"
                  onClick={() =>
                    setVisibleRootCount((n) => n + VISIBLE_CHILDREN_CHUNK)
                  }
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-600 dark:text-emerald-500/90 dark:hover:text-emerald-400"
                >
                  Show more ({hiddenRootCount.toLocaleString()} hidden)
                </button>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
