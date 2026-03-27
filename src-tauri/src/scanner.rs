use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use jwalk::WalkDir;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub files_count: u64,
    pub bytes_accumulated: u64,
    pub current_path: String,
    pub elapsed_secs: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
    pub item_count: u32,
    #[serde(default)]
    pub lazy_unloaded: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopFileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub root: FileEntry,
    pub top_files: Vec<TopFileEntry>,
}

#[derive(Clone)]
pub(crate) struct ChildRecord {
    pub name: String,
    pub path: PathBuf,
    pub is_dir: bool,
    pub file_size: u64,
}

struct ScanAggregate {
    dir_bytes: HashMap<PathBuf, u64>,
    children: HashMap<PathBuf, Vec<ChildRecord>>,
    heap: BinaryHeap<Reverse<(u64, PathBuf)>>,
    files_scanned: u64,
    bytes_total: u64,
    last_emit: Instant,
}

pub(crate) fn expand_home(path: &str) -> Result<PathBuf, String> {
    if path == "~" {
        return home_dir_path();
    }
    if let Some(rest) = path.strip_prefix("~/") {
        return Ok(home_dir_path()?.join(rest));
    }
    Ok(PathBuf::from(path))
}

fn home_dir_path() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .map_err(|_| "Could not resolve home directory".to_string())
}

fn is_lazy_dir_name(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | "target"
            | ".git"
            | "dist"
            | "build"
            | ".next"
            | ".cache"
            | "__pycache__"
            | ".venv"
            | "vendor"
            | ".npm"
            | "Pods"
            | "DerivedData"
            | ".gradle"
    ) || name.ends_with(".xcworkspace")
        || name.ends_with(".xcodeproj")
}

fn should_skip_walk_entry(path: &Path) -> bool {
    let s = path.to_string_lossy();
    if s.contains("/.Trashes")
        || s.contains("/Library/Application Support/com.apple.TCC")
        || s.contains("/Library/Caches")
    {
        return true;
    }
    for c in path.components() {
        if let Component::Normal(name) = c {
            let n = name.to_string_lossy();
            if matches!(
                n.as_ref(),
                ".Spotlight-V100"
                    | ".fseventsd"
                    | ".DocumentRevisions-V100"
                    | ".TemporaryItems"
                    | ".VolumeIcon.icns"
            ) {
                return true;
            }
        }
    }
    false
}

fn root_device_id(root: &Path) -> Option<u64> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        fs::metadata(root).ok().map(|m| m.dev())
    }
    #[cfg(not(unix))]
    {
        let _ = root;
        None
    }
}

fn propagate_file_size(dir_bytes: &mut HashMap<PathBuf, u64>, root: &Path, path: PathBuf, size: u64) {
    let mut p = path.parent().map(Path::to_path_buf);
    while let Some(ref parent) = p {
        if !parent.starts_with(root) {
            break;
        }
        *dir_bytes.entry(parent.clone()).or_insert(0) += size;
        p = parent.parent().map(Path::to_path_buf);
    }
}

fn record_child(children: &mut HashMap<PathBuf, Vec<ChildRecord>>, parent: &Path, rec: ChildRecord) {
    children.entry(parent.to_path_buf()).or_default().push(rec);
}

pub(crate) fn scan_fs(
    root: &Path,
    app: &AppHandle,
    top_n: usize,
    cancel: Option<&AtomicBool>,
) -> Result<(HashMap<PathBuf, u64>, HashMap<PathBuf, Vec<ChildRecord>>, Vec<TopFileEntry>), String> {
    let root = root
        .canonicalize()
        .map_err(|e| format!("Invalid path: {e}"))?;

    let root_dev = root_device_id(&root);
    let scan_start = Instant::now();
    let shared = Arc::new(Mutex::new(ScanAggregate {
        dir_bytes: HashMap::new(),
        children: HashMap::new(),
        heap: BinaryHeap::new(),
        files_scanned: 0,
        bytes_total: 0,
        last_emit: Instant::now(),
    }));

    let walker = WalkDir::new(&root)
        .skip_hidden(false)
        .follow_links(false)
        .sort(false)
        .process_read_dir(move |_depth, _dir_path, _state, children| {
            children.retain(|e| match e {
                Ok(ent) => !should_skip_walk_entry(&ent.path()),
                Err(_) => true,
            });
            if let Some(rd) = root_dev {
                for ent in children.iter_mut().filter_map(|e| e.as_mut().ok()) {
                    if ent.file_type().is_dir() {
                        if let Ok(m) = ent.metadata() {
                            #[cfg(unix)]
                            {
                                use std::os::unix::fs::MetadataExt;
                                if m.dev() != rd {
                                    ent.read_children_path = None;
                                }
                            }
                        }
                    }
                }
            }
        });

    for walk_item in walker {
        if cancel.is_some_and(|f| f.load(Ordering::Relaxed)) {
            return Err("Scan cancelled".into());
        }

        let entry = match walk_item {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if path == root {
            continue;
        }

        let Some(parent) = path.parent().map(Path::to_path_buf) else {
            continue;
        };
        if !parent.starts_with(&root) {
            continue;
        }

        let name = entry
            .file_name()
            .to_string_lossy()
            .into_owned();

        if entry.file_type().is_symlink() {
            continue;
        }

        if entry.file_type().is_file() {
            let size = match entry.metadata() {
                Ok(m) => m.len(),
                Err(_) => continue,
            };

            let mut ag = shared.lock().map_err(|_| "Scan lock poisoned".to_string())?;
            ag.files_scanned += 1;
            ag.bytes_total += size;
            if ag.last_emit.elapsed().as_millis() > 120 {
                ag.last_emit = Instant::now();
                let elapsed = scan_start.elapsed().as_secs_f64();
                let _ = app.emit(
                    "scan-progress",
                    ScanProgress {
                        files_count: ag.files_scanned,
                        bytes_accumulated: ag.bytes_total,
                        current_path: path.display().to_string(),
                        elapsed_secs: elapsed,
                    },
                );
            }

            propagate_file_size(&mut ag.dir_bytes, &root, path.clone(), size);

            if top_n > 0 {
                if ag.heap.len() < top_n {
                    ag.heap.push(Reverse((size, path.clone())));
                } else if let Some(&Reverse((min_size, _))) = ag.heap.peek() {
                    if size > min_size {
                        ag.heap.pop();
                        ag.heap.push(Reverse((size, path.clone())));
                    }
                }
            }

            if ag.files_scanned % 1000 == 0 && cancel.is_some_and(|f| f.load(Ordering::Relaxed)) {
                return Err("Scan cancelled".into());
            }

            record_child(
                &mut ag.children,
                &parent,
                ChildRecord {
                    name,
                    path: path.clone(),
                    is_dir: false,
                    file_size: size,
                },
            );
        } else if entry.file_type().is_dir() {
            let mut ag = shared.lock().map_err(|_| "Scan lock poisoned".to_string())?;
            record_child(
                &mut ag.children,
                &parent,
                ChildRecord {
                    name,
                    path: path.clone(),
                    is_dir: true,
                    file_size: 0,
                },
            );
        }
    }

    let ag = Arc::try_unwrap(shared)
        .map_err(|_| "Scan still in use".to_string())?
        .into_inner()
        .map_err(|_| "Scan lock poisoned".to_string())?;

    let ScanAggregate {
        dir_bytes,
        mut children,
        heap,
        files_scanned,
        bytes_total,
        ..
    } = ag;

    // Deterministic child order (jwalk yields depth-first; parallel map order varies).
    for list in children.values_mut() {
        list.sort_by(|a, b| a.name.cmp(&b.name));
    }

    let mut top_files: Vec<TopFileEntry> = heap
        .into_sorted_vec()
        .into_iter()
        .map(|Reverse((size, p))| TopFileEntry {
            name: p
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
            path: p.display().to_string(),
            size,
        })
        .collect();
    top_files.sort_by(|a, b| b.size.cmp(&a.size));

    let elapsed = scan_start.elapsed().as_secs_f64();
    let _ = app.emit(
        "scan-progress",
        ScanProgress {
            files_count: files_scanned,
            bytes_accumulated: bytes_total,
            current_path: root.display().to_string(),
            elapsed_secs: elapsed,
        },
    );

    Ok((dir_bytes, children, top_files))
}

pub(crate) fn build_tree(
    path: &Path,
    dir_bytes: &HashMap<PathBuf, u64>,
    children_of: &HashMap<PathBuf, Vec<ChildRecord>>,
    current_depth: u32,
    max_depth: u32,
) -> Result<FileEntry, String> {
    let path = path
        .canonicalize()
        .map_err(|e| format!("Invalid path: {e}"))?;

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string());

    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    let is_dir = meta.is_dir();

    if !is_dir {
        return Ok(FileEntry {
            name,
            path: path.display().to_string(),
            size: meta.len(),
            is_dir: false,
            children: None,
            item_count: 0,
            lazy_unloaded: false,
        });
    }

    let size = *dir_bytes.get(&path).unwrap_or(&0);
    let records = children_of.get(&path).cloned().unwrap_or_default();
    let direct_count = records.len() as u32;

    let mut child_entries: Vec<FileEntry> = Vec::new();
    for rec in records {
        if rec.is_dir {
            if is_lazy_dir_name(&rec.name) || current_depth + 1 >= max_depth {
                let lazy_size = *dir_bytes.get(&rec.path).unwrap_or(&0);
                let items = children_of
                    .get(&rec.path)
                    .map(|v| v.len() as u32)
                    .unwrap_or(0);
                child_entries.push(FileEntry {
                    name: rec.name,
                    path: rec.path.display().to_string(),
                    size: lazy_size,
                    is_dir: true,
                    children: None,
                    item_count: items,
                    lazy_unloaded: true,
                });
            } else {
                child_entries.push(build_tree(
                    &rec.path,
                    dir_bytes,
                    children_of,
                    current_depth + 1,
                    max_depth,
                )?);
            }
        } else {
            child_entries.push(FileEntry {
                name: rec.name,
                path: rec.path.display().to_string(),
                size: rec.file_size,
                is_dir: false,
                children: None,
                item_count: 0,
                lazy_unloaded: false,
            });
        }
    }

    Ok(FileEntry {
        name,
        path: path.display().to_string(),
        size,
        is_dir: true,
        children: Some(child_entries),
        item_count: direct_count,
        lazy_unloaded: false,
    })
}

pub fn scan_directory(
    path_str: &str,
    app: &AppHandle,
    top_n: usize,
    cancel: Option<&AtomicBool>,
) -> Result<ScanResult, String> {
    let path = expand_home(path_str)?;
    if !path.exists() {
        return Err("Path does not exist".into());
    }
    let (dir_bytes, children_of, top_files) = scan_fs(&path, app, top_n, cancel)?;
    let root = build_tree(&path, &dir_bytes, &children_of, 0, 1)?;
    Ok(ScanResult { root, top_files })
}

pub fn expand_lazy_directory(
    path_str: &str,
    app: &AppHandle,
    cancel: Option<&AtomicBool>,
) -> Result<FileEntry, String> {
    let path = expand_home(path_str)?;
    let (dir_bytes, children_of, _) = scan_fs(&path, app, 0, cancel)?;
    let mut entry = build_tree(&path, &dir_bytes, &children_of, 0, 1)?;
    entry.lazy_unloaded = false;
    Ok(entry)
}
