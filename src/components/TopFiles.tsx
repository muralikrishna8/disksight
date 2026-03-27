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
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <header className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 flex flex-wrap items-center gap-3 justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
            Largest files
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            From the last full scan of the selected root — select rows to delete several at once
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => onRequestTrash(selectedFiles)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/30 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/50 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Trash selected
            {selectedCount > 0 ? ` (${selectedCount})` : null}
          </button>
        </div>
      </header>
      <ul className="divide-y divide-zinc-800/80 max-h-64 overflow-auto">
        <li className="flex items-center gap-3 px-4 py-2 bg-zinc-900/50 text-xs text-zinc-500">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = !allSelected && !noneSelected;
              }}
              onChange={toggleSelectAll}
              className="rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/40"
            />
            Select all
          </label>
        </li>
        {files.map((f, i) => (
          <li
            key={f.path}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/40"
          >
            <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(f.path)}
                onChange={() => togglePath(f.path)}
                className="rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/40 shrink-0"
              />
              <span className="w-6 text-xs tabular-nums text-zinc-600 text-right font-medium shrink-0">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm text-zinc-200 font-medium" title={f.name}>
                  {f.name}
                </div>
                <div className="text-xs text-zinc-500 truncate" title={f.path}>
                  {f.path}
                </div>
              </div>
            </label>
            <span className="text-sm tabular-nums text-zinc-400 shrink-0">
              {formatBytes(f.size)}
            </span>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onReveal(f.path)}
                className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-emerald-400"
                title="Reveal in Finder"
              >
                <FolderOpen className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => onRequestTrash([f])}
                className="p-2 rounded-lg text-zinc-500 hover:bg-red-950/50 hover:text-red-400"
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
