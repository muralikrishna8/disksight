import { FolderOpen, Trash2 } from "lucide-react";

import type { TopFileEntry } from "../hooks/useScanner";
import { formatBytes } from "../utils/format";

type TopFilesProps = {
  files: TopFileEntry[];
  onTrash: (file: TopFileEntry) => void;
  onReveal: (path: string) => void;
};

export function TopFiles({ files, onTrash, onReveal }: TopFilesProps) {
  if (!files.length) return null;
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <header className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
          Largest files
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          From the last full scan of the selected root
        </p>
      </header>
      <ul className="divide-y divide-zinc-800/80 max-h-64 overflow-auto">
        {files.map((f, i) => (
          <li
            key={f.path}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/40"
          >
            <span className="w-6 text-xs tabular-nums text-zinc-600 text-right font-medium">
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
                onClick={() => onTrash(f)}
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
