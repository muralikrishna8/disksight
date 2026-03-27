import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  FolderOpen,
  Home,
  LayoutGrid,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Breadcrumb } from "./components/Breadcrumb";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TopFiles } from "./components/TopFiles";
import { TreemapChart } from "./components/TreemapChart";
import { TreeTable } from "./components/TreeTable";
import {
  type FileEntry,
  type TopFileEntry,
  useScanner,
} from "./hooks/useScanner";
import { formatBytes } from "./utils/format";

/** Avoid double-opening the folder dialog in React Strict Mode (dev). */
let hasPromptedInitialFolder = false;

function findNode(root: FileEntry, path: string): FileEntry | null {
  if (root.path === path) return root;
  for (const c of root.children ?? []) {
    const f = findNode(c, path);
    if (f) return f;
  }
  return null;
}

export default function App() {
  const topN = 20;
  const {
    result,
    loading,
    error,
    progress,
    scan,
    expandLazy,
    cancelScan,
    scanPath,
  } = useScanner("", topN);

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [confirmTrashItems, setConfirmTrashItems] = useState<TopFileEntry[]>(
    []
  );
  const [showTreemap, setShowTreemap] = useState(false);

  const pickFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select folder to analyse",
    });
    if (selected === null) return;
    await scan(selected);
  }, [scan]);

  useEffect(() => {
    if (hasPromptedInitialFolder) return;
    hasPromptedInitialFolder = true;
    void pickFolder();
  }, [pickFolder]);

  useEffect(() => {
    if (result?.root.path) setCurrentPath(result.root.path);
  }, [result?.root.path]);

  const rootPath = result?.root.path ?? scanPath;
  const activePath = currentPath ?? rootPath;
  const rootLabel = result?.root.name ?? "Folder";

  const folderNode = useMemo(() => {
    if (!result || !activePath) return null;
    return findNode(result.root, activePath);
  }, [result, activePath]);

  useEffect(() => {
    if (!folderNode?.lazyUnloaded) return;
    void expandLazy(folderNode.path);
  }, [folderNode?.path, folderNode?.lazyUnloaded, expandLazy]);

  const childEntries = folderNode?.children ?? [];

  const goUp = useCallback(() => {
    if (!folderNode || !result) return;
    const p = folderNode.path.replace(/\/$/, "");
    const parentPath = p.split("/").slice(0, -1).join("/") || "/";
    if (parentPath.length >= result.root.path.length) {
      const parent = findNode(result.root, parentPath);
      if (parent) setCurrentPath(parent.path);
    }
  }, [folderNode, result]);

  const onOpenFolder = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  const onRescan = useCallback(() => {
    void scan();
  }, [scan]);

  const goScanRoot = useCallback(() => {
    if (!result) return;
    setCurrentPath(result.root.path);
  }, [result]);

  const onReveal = useCallback(async (path: string) => {
    try {
      await invoke("open_in_finder_cmd", { path });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const onTrashConfirmed = useCallback(async () => {
    if (!confirmTrashItems.length) return;
    try {
      for (const item of confirmTrashItems) {
        await invoke("move_to_trash_cmd", { path: item.path });
      }
      setConfirmTrashItems([]);
      void scan();
    } catch (e) {
      console.error(e);
    }
  }, [confirmTrashItems, scan]);

  const showMainPanels = !!result;
  const showIdleEmpty = !result && !loading;

  return (
    <div className="min-h-full flex flex-col">
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Disk Analyser
            </h1>
            <div className="mt-2">
              {result ? (
                <Breadcrumb
                  rootPath={rootPath}
                  currentPath={activePath}
                  homeLabel={rootLabel}
                  onNavigate={setCurrentPath}
                />
              ) : (
                <span className="text-sm text-zinc-500">
                  {loading
                    ? "Scanning selected folder…"
                    : "Pick a folder to see sizes and largest files."}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void pickFolder()}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              <FolderOpen className="h-4 w-4" />
              Choose folder…
            </button>
            <button
              type="button"
              onClick={goScanRoot}
              disabled={!result || activePath === rootPath}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Home className="h-4 w-4" />
              Root
            </button>
            <button
              type="button"
              onClick={goUp}
              disabled={!result || activePath === rootPath}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => setShowTreemap((v) => !v)}
              disabled={!result}
              aria-pressed={showTreemap}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none aria-pressed:bg-zinc-800 aria-pressed:border-emerald-600/50"
            >
              <LayoutGrid className="h-4 w-4" />
              {showTreemap ? "Hide treemap" : "Show treemap"}
            </button>
            {loading ? (
              <button
                type="button"
                onClick={cancelScan}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Cancel scan
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRescan}
              disabled={loading || !scanPath}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Rescan
            </button>
          </div>
        </div>
        {loading && progress ? (
          <div className="mt-3 text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-1 items-baseline">
            <span className="font-medium text-zinc-400 tabular-nums animate-pulse">
              Scanning… {progress.filesCount.toLocaleString()} files ·{" "}
              {formatBytes(progress.bytesAccumulated)}
              {typeof progress.elapsedSecs === "number"
                ? ` · ${progress.elapsedSecs.toFixed(1)}s`
                : null}
            </span>
            <span className="truncate max-w-full">{progress.currentPath}</span>
          </div>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <main className="flex-1 p-5 flex flex-col gap-5 overflow-auto">
        {loading && !result ? (
          <div className="flex flex-1 items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Scanning…</span>
          </div>
        ) : null}

        {showIdleEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-4">
            <p className="text-zinc-400 max-w-md">
              No folder is open. Use the system dialog to choose a directory, or
              click below to browse again.
            </p>
            <button
              type="button"
              onClick={() => void pickFolder()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              <FolderOpen className="h-4 w-4" />
              Choose folder…
            </button>
          </div>
        ) : null}

        {showMainPanels ? (
          <>
            <div
              className={`grid gap-5 items-start ${
                showTreemap ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
              }`}
            >
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  Tree
                </h2>
                <TreeTable
                  key={activePath}
                  entries={childEntries}
                  onOpenFolder={onOpenFolder}
                  onExpandLazy={expandLazy}
                  onTrash={(e) =>
                    setConfirmTrashItems([
                      {
                        name: e.name,
                        path: e.path,
                        size: e.size,
                      },
                    ])
                  }
                />
              </div>
              {showTreemap ? (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Treemap
                  </h2>
                  <TreemapChart
                    entries={childEntries}
                    onOpenFolder={onOpenFolder}
                  />
                </div>
              ) : null}
            </div>
            {result.topFiles.length > 0 ? (
              <TopFiles
                files={result.topFiles}
                onRequestTrash={setConfirmTrashItems}
                onReveal={onReveal}
              />
            ) : null}
          </>
        ) : null}
      </main>

      <ConfirmDialog
        open={confirmTrashItems.length > 0}
        title="Move to Trash?"
        items={confirmTrashItems.map(({ name, size }) => ({ name, size }))}
        onCancel={() => setConfirmTrashItems([])}
        onConfirm={onTrashConfirmed}
      />
    </div>
  );
}
