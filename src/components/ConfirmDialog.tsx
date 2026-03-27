import { Trash2, X } from "lucide-react";

import { formatBytes } from "../utils/format";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  itemName: string;
  itemSize: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  itemName,
  itemSize,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
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
                Move{" "}
                <span className="text-zinc-200 font-medium break-all">{itemName}</span>{" "}
                ({formatBytes(itemSize)}) to Trash? You can restore it from Finder.
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
