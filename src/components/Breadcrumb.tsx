type Crumb = { label: string; path: string };

type BreadcrumbProps = {
  rootPath: string;
  currentPath: string;
  homeLabel?: string;
  onNavigate: (path: string) => void;
};

function splitPath(rootPath: string, currentPath: string): Crumb[] {
  const root = rootPath.replace(/\/$/, "");
  const cur = currentPath.replace(/\/$/, "");
  if (!cur.startsWith(root)) {
    return [{ label: currentPath.split("/").pop() || cur, path: cur }];
  }
  const rest = cur.slice(root.length).replace(/^\//, "");
  if (!rest) return [{ label: "~", path: root }];
  const parts = rest.split("/").filter(Boolean);
  const out: Crumb[] = [{ label: "~", path: root }];
  let acc = root;
  for (const p of parts) {
    acc = `${acc}/${p}`;
    out.push({ label: p, path: acc });
  }
  return out;
}

export function Breadcrumb({
  rootPath,
  currentPath,
  homeLabel = "~",
  onNavigate,
}: BreadcrumbProps) {
  const crumbs = splitPath(rootPath, currentPath);
  if (crumbs.length && crumbs[0].label === "~") {
    crumbs[0] = { ...crumbs[0], label: homeLabel };
  }
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
      {crumbs.map((c, i) => (
        <span key={c.path} className="flex items-center gap-1">
          {i > 0 ? (
            <span className="text-zinc-400 dark:text-zinc-600">/</span>
          ) : null}
          <button
            type="button"
            className={`hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors ${
              i === crumbs.length - 1
                ? "text-zinc-900 font-medium dark:text-zinc-100"
                : ""
            }`}
            onClick={() => onNavigate(c.path)}
          >
            {c.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
