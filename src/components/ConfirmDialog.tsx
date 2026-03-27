import { Trash2, X } from "lucide-react";
import type { ReactNode } from "react";

import { formatBytes } from "../utils/format";

type TrashItem = { name: string; size: number };

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  items: TrashItem[];
  onConfirm: () => void;
  onCancel: () => void;
};

function describeTrashItems(items: TrashItem[]): ReactNode {
  if (items.length === 0) return null;
  if (items.length === 1) {
    const [{ name, size }] = items;
    return (
      <>
        Move <span className="text-zinc-200 font-medium break-all">{name}</span> (
        {formatBytes(size)}) to Trash? You can restore it from Finder.
      </>
    );
  }
  const total = items.reduce((s, i) => s + i.size, 0);
  const preview = items.slice(0, 5);
  const rest = items.length - preview.length;
  return (
    <>
      Move{" "}
      <span className="text-zinc-200 font-medium tabular-nums">{items.length}</span>{" "}
      files ({formatBytes(total)} total) to Trash? You can restore them from Finder.
      <ul className="mt-3 max-h-32 overflow-auto rounded-lg border border-zinc-800/80 bg-zinc-950/50 py-1.5 px-3 text-xs text-zinc-500 space-y-1">
        {preview.map((i, idx) => (
          <li key={`${i.name}-${idx}`} className="truncate" title={i.name}>
            {i.name}
          </li>
        ))}
        {rest > 0 ? (
          <li className="text-zinc-600">…and {rest} more</li>
        ) : null}
      </ul>
    </>
  );
}

export function ConfirmDialog({
  open,
  title,
  items,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open || !items.length) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-zinc-800">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <Trash2 className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 id="confirm-title" className="text-lg font-semibold text-zinc-100">
                {title}
              </h2>
              <p className="mt-1 text-sm text-zinc-400 leading-relaxed">
                {describeTrashItems(items)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex justify-end gap-2 p-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-500"
          >
            Move to Trash
          </button>
        </div>
      </div>
    </div>
  );
}
