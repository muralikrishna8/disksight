import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

export type FileEntry = {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  children?: FileEntry[] | null;
  itemCount: number;
  lazyUnloaded?: boolean;
};

export type TopFileEntry = {
  name: string;
  path: string;
  size: number;
};

export type ScanResult = {
  root: FileEntry;
  topFiles: TopFileEntry[];
};

export type ScanProgress = {
  filesCount: number;
  bytesAccumulated: number;
  currentPath: string;
  elapsedSecs: number;
};

export function useScanner(initialPath = "", topCount = 20) {
  const [scanPath, setScanPath] = useState(initialPath);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const unlisten = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    let active = true;
    void listen<ScanProgress>("scan-progress", (e) => {
      if (active) setProgress(e.payload);
    }).then((u) => {
      unlisten.current = u;
    });
    return () => {
      active = false;
      unlisten.current?.();
    };
  }, []);

  const scan = useCallback(
    async (path?: string) => {
      const raw = path ?? scanPath;
      const p = typeof raw === "string" ? raw.trim() : "";
      if (!p) return;

      setLoading(true);
      setError(null);
      setProgress(null);
      try {
        const r = await invoke<ScanResult>("scan_directory_cmd", {
          path: p,
          topCount,
        });
        setResult(r);
        setScanPath(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setResult(null);
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [scanPath, topCount],
  );

  const mergeExpanded = useCallback(
    (targetPath: string, expanded: FileEntry) => {
      const patch = (node: FileEntry): FileEntry => {
        if (node.path === targetPath) {
          return {
            ...expanded,
            lazyUnloaded: false,
          };
        }
        if (!node.children?.length) return node;
        return {
          ...node,
          children: node.children.map((c) => patch(c)),
        };
      };
      setResult((prev) => (prev ? { ...prev, root: patch(prev.root) } : prev));
    },
    [],
  );

  const expandLazy = useCallback(
    async (path: string) => {
      try {
        const entry = await invoke<FileEntry>("expand_directory_cmd", { path });
        mergeExpanded(path, entry);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [mergeExpanded],
  );

  const cancelScan = useCallback(() => {
    void invoke("cancel_scan_cmd");
  }, []);

  return {
    scanPath,
    setScanPath,
    result,
    loading,
    error,
    progress,
    scan,
    expandLazy,
    mergeExpanded,
    cancelScan,
  };
}
