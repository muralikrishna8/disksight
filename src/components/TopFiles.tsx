import { FolderOpen, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { TopFileEntry } from "../hooks/useScanner";
import { formatBytes } from "../utils/format";

type TopFilesProps = {
  files: TopFileEntry[];
  onRequestTrash: (items: TopFileEntry[]) => void;
  onReveal: (path: string) => void;
};

export function TopFiles({ files, onRequestTrash, onReveal }: TopFilesProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pathsKey = files.map((f) => f.path).join("\0");
  useEffect(() => {
    setSelected(new Set());
  }, [pathsKey]);

  if (!files.length) return null;

  const togglePath = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const allSelected = files.every((f) => selected.has(f.path));
  const noneSelected = files.every((f) => !selected.has(f.path));
  const selectedCount = files.filter((f) => selected.has(f.path)).length;
  const selectedFiles = files.filter((f) => selected.has(f.path));

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(files.map((f) => f.path)));
  };

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-200">
            Largest files
          </h2>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-500">
            From the last full scan of the selected root — select rows to delete
            several at once
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => onRequestTrash(selectedFiles)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:pointer-events-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Trash selected
            {selectedCount > 0 ? ` (${selectedCount})` : null}
          </button>
        </div>
      </header>
      <ul className="max-h-64 divide-y divide-zinc-200/90 overflow-auto dark:divide-zinc-800/80">
        <li className="flex items-center gap-3 bg-zinc-50/80 px-4 py-2 text-xs text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-500">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = !allSelected && !noneSelected;
              }}
              onChange={toggleSelectAll}
              className="rounded border-zinc-300 bg-white text-emerald-600 focus:ring-emerald-500/40 dark:border-zinc-600 dark:bg-zinc-900"
            />
            Select all
          </label>
        </li>
        {files.map((f, i) => (
          <li
            key={f.path}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
          >
            <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(f.path)}
                onChange={() => togglePath(f.path)}
                className="shrink-0 rounded border-zinc-300 bg-white text-emerald-600 focus:ring-emerald-500/40 dark:border-zinc-600 dark:bg-zinc-900"
              />
              <span className="w-6 shrink-0 text-right text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-600">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-200"
                  title={f.name}
                >
                  {f.name}
                </div>
                <div
                  className="truncate text-xs text-zinc-600 dark:text-zinc-500"
                  title={f.path}
                >
                  {f.path}
                </div>
              </div>
            </label>
            <span className="shrink-0 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
              {formatBytes(f.size)}
            </span>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onReveal(f.path)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-emerald-600 dark:hover:bg-zinc-800 dark:hover:text-emerald-400"
                title="Reveal in Finder"
              >
                <FolderOpen className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => onRequestTrash([f])}
                className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                title="Move to Trash"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
