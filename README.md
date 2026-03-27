# DiskSight

**DiskSight** is a desktop disk usage analyser. It combines a **Rust** backend and **React** UI inside **[Tauri 2](https://tauri.app/)**. The window title in builds is *Disk Analyser*.

You get a folder **tree** (names, sizes, item counts, share bars), a **treemap** for visual proportion of space, and a **largest files** list with shortcuts to reveal files in the file manager or move them to trash.

![DiskSight — tree, treemap, and largest files](public/disksight.png)

## Use cases

| Goal | What DiskSight helps with |
|------|---------------------------|
| **Audit disk usage** | Pick a folder (or work from a root) and see which directories use the most space. |
| **Explore huge trees** | Open branches as needed; lazy-loaded subtrees avoid scanning everything up front. |
| **See share of total** | Size and horizontal **Share** bars show how much each row contributes in the current view. |
| **Spot big blobs** | The **Treemap** makes dominant folders obvious; **Largest files** lists top paths and sizes. |
| **Follow up in the OS** | Open a file’s folder or delete via the app—deletions use the system trash where supported; always confirm important data first. |

## Prerequisites

- **[Node.js](https://nodejs.org/)** (includes `npm`)
- **[Rust](https://rustup.rs/)** — toolchain with **rustc 1.77+** (see `rust-version` in `src-tauri/Cargo.toml`)
- **OS packages for Tauri** — follow [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) (e.g. Xcode Command Line Tools on macOS)

## Setup

```bash
git clone <repository-url>
cd DiskSight
npm install
```

Dependencies install the web stack; the Tauri CLI compiles the Rust crate when you run dev or build.

## Run

**Desktop app (recommended)** — starts Vite on **http://localhost:1420** and opens the native window:

```bash
npm run tauri dev
```

**Web UI only** (no Tauri shell):

```bash
npm run dev
```

**Preview production build in the browser:**

```bash
npm run build
npm run preview
```

## Build

Create release installers for the current platform:

```bash
npm run tauri build
```

Output lives under `src-tauri/target/release/bundle/` (exact artifacts depend on OS and bundle settings in `src-tauri/tauri.conf.json`).
