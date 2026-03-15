# Module 6: File System Operations and OS Integration

This module covers how Tauri 2.x applications interact with the host file system and operating system. You will learn to read and write files, prompt users with native dialogs, handle drag-and-drop, resolve platform-specific paths, watch for file changes, access the clipboard, open URLs and files in external applications, and query OS information.

---

## Table of Contents

1. [Tauri File System Plugin](#1-tauri-file-system-plugin)
2. [Reading Files](#2-reading-files)
3. [Writing Files](#3-writing-files)
4. [File Dialogs](#4-file-dialogs)
5. [Drag and Drop](#5-drag-and-drop)
6. [Path Resolution](#6-path-resolution)
7. [File Watching](#7-file-watching)
8. [Clipboard](#8-clipboard)
9. [Shell Integration](#9-shell-integration)
10. [OS Information](#10-os-information)
11. [Coding Challenges](#coding-challenges)

---

## 1. Tauri File System Plugin

The `tauri-plugin-fs` plugin provides file system access from the frontend JavaScript layer. On the Rust side you can use standard libraries (`std::fs`, `tokio::fs`) directly, but the plugin gives your React frontend controlled, permission-gated access to files and directories.

### Installation

**Rust (Cargo.toml):**

```toml
[dependencies]
tauri-plugin-fs = "2"
```

**JavaScript:**

```bash
npm add @tauri-apps/plugin-fs
```

### Registering the Plugin

```rust
// src-tauri/src/lib.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Permissions and Capabilities

Tauri 2 uses a capability system to control what each window is allowed to do. Capabilities are defined as JSON files in `src-tauri/capabilities/`. Every capability file in that directory is automatically enabled.

**`src-tauri/capabilities/default.json`:**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "fs:allow-rename",
    "fs:allow-exists",
    "fs:allow-read-dir",
    "fs:allow-copy-file",
    "fs:allow-stat",
    "fs:allow-watch"
  ]
}
```

### Scoped Access

By default, the `fs:default` permission grants read access to application-specific directories only (`AppConfig`, `AppData`, `AppLocalData`, `AppCache`, `AppLog`). You can define scoped access to restrict or broaden file system reach using allow/deny arrays. Deny scopes take precedence over allow scopes.

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "$APPDATA/**" },
        { "path": "$DOCUMENT/**" }
      ]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [
        { "path": "$APPDATA/**" }
      ],
      "deny": [
        { "path": "$APPDATA/secrets/**" }
      ]
    }
  ]
}
```

Available scope variables include: `$APPCONFIG`, `$APPDATA`, `$APPLOCALDATA`, `$APPCACHE`, `$APPLOG`, `$AUDIO`, `$CACHE`, `$CONFIG`, `$DATA`, `$DESKTOP`, `$DOCUMENT`, `$DOWNLOAD`, `$HOME`, `$PICTURE`, `$PUBLIC`, `$VIDEO`, `$RESOURCE`, `$TEMP`.

### Security Notes

- Path traversal is blocked: paths like `../secret` or `/usr/path/to/../file` are rejected.
- All paths must be relative to a `BaseDirectory` or created with the path API.
- The default config denies access to the `$APPLOCALDATA/EBWebView` folder on Windows (WebView data).

---

## 2. Reading Files

### Reading Text Files (Frontend)

```tsx
// src/components/FileReader.tsx
import { useState } from "react";
import { readTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";

function FileReader() {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadConfig() {
    try {
      const text = await readTextFile("settings.json", {
        baseDir: BaseDirectory.AppConfig,
      });
      setContent(text);
      setError(null);
    } catch (err) {
      setError(`Failed to read file: ${err}`);
    }
  }

  return (
    <div>
      <button onClick={loadConfig}>Load Config</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <pre>{content}</pre>
    </div>
  );
}
```

### Reading Binary Files (Frontend)

```tsx
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";

async function loadImage() {
  // readFile returns a Uint8Array
  const bytes = await readFile("avatar.png", {
    baseDir: BaseDirectory.AppData,
  });

  // Convert to a displayable URL
  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  return url;
}
```

### Reading Lines with Async Iteration (Frontend)

```tsx
import { readTextFileLines, BaseDirectory } from "@tauri-apps/plugin-fs";

async function processLogFile() {
  const lines = await readTextFileLines("app.log", {
    baseDir: BaseDirectory.AppLog,
  });

  for await (const line of lines) {
    console.log("Log line:", line);
  }
}
```

### Reading Files with a FileHandle (Streaming)

For large files, you can open a file handle and read in chunks:

```tsx
import { open, BaseDirectory } from "@tauri-apps/plugin-fs";

async function readInChunks() {
  const file = await open("large-data.bin", {
    read: true,
    baseDir: BaseDirectory.AppData,
  });

  const buffer = new Uint8Array(1024);
  let bytesRead: number | null;

  while (true) {
    bytesRead = await file.read(buffer);
    if (bytesRead === null) break; // EOF
    console.log(`Read ${bytesRead} bytes`);
    // Process buffer.slice(0, bytesRead)
  }

  await file.close();
}
```

### Reading Files from Rust

On the Rust side, you can use standard file I/O without the plugin:

```rust
use std::fs;
use tauri::command;

#[command]
fn read_config(app_handle: tauri::AppHandle) -> Result<String, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    let config_path = config_dir.join("settings.json");

    fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))
}

#[command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}
```

---

## 3. Writing Files

### Writing Text Files (Frontend)

```tsx
import { useState } from "react";
import {
  writeTextFile,
  mkdir,
  exists,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

function NoteEditor() {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");

  async function saveNote() {
    try {
      // Ensure the directory exists first
      const dirExists = await exists("notes", {
        baseDir: BaseDirectory.AppData,
      });
      if (!dirExists) {
        await mkdir("notes", {
          baseDir: BaseDirectory.AppData,
          recursive: true,
        });
      }

      await writeTextFile("notes/my-note.txt", note, {
        baseDir: BaseDirectory.AppData,
      });
      setStatus("Saved successfully!");
    } catch (err) {
      setStatus(`Save failed: ${err}`);
    }
  }

  return (
    <div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={10}
        cols={50}
      />
      <br />
      <button onClick={saveNote}>Save Note</button>
      <p>{status}</p>
    </div>
  );
}
```

### Writing Binary Files (Frontend)

```tsx
import { writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";

async function saveImageData(imageBytes: Uint8Array) {
  await writeFile("output/image.png", imageBytes, {
    baseDir: BaseDirectory.AppData,
  });
}
```

### Appending to Files with FileHandle

```tsx
import { open, BaseDirectory } from "@tauri-apps/plugin-fs";

async function appendToLog(message: string) {
  const file = await open("app.log", {
    write: true,
    append: true,
    create: true,
    baseDir: BaseDirectory.AppLog,
  });

  const encoder = new TextEncoder();
  const timestamp = new Date().toISOString();
  await file.write(encoder.encode(`[${timestamp}] ${message}\n`));
  await file.close();
}
```

### Creating Directories

```tsx
import { mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";

// Create a single directory
await mkdir("data", { baseDir: BaseDirectory.AppData });

// Create nested directories recursively
await mkdir("data/exports/2025/january", {
  baseDir: BaseDirectory.AppData,
  recursive: true,
});
```

### Removing and Renaming

```tsx
import { remove, rename, BaseDirectory } from "@tauri-apps/plugin-fs";

// Remove a file
await remove("old-data.json", { baseDir: BaseDirectory.AppData });

// Remove a directory and its contents
await remove("temp-cache", {
  baseDir: BaseDirectory.AppData,
  recursive: true,
});

// Rename / move a file
await rename("draft.txt", "final.txt", {
  oldPathBaseDir: BaseDirectory.AppData,
  newPathBaseDir: BaseDirectory.AppData,
});
```

### Writing Files from Rust

```rust
use std::fs;
use tauri::command;

#[command]
fn save_data(app_handle: tauri::AppHandle, filename: String, content: String) -> Result<(), String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    // Ensure directory exists
    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let file_path = data_dir.join(&filename);
    fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write {}: {}", file_path.display(), e))
}

#[command]
fn append_to_file(app_handle: tauri::AppHandle, filename: String, line: String) -> Result<(), String> {
    use std::io::Write;

    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let file_path = data_dir.join(&filename);
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("Failed to open {}: {}", file_path.display(), e))?;

    writeln!(file, "{}", line)
        .map_err(|e| format!("Failed to write: {}", e))
}
```

---

## 4. File Dialogs

The `tauri-plugin-dialog` plugin provides native open/save file dialogs.

### Installation

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-dialog = "2"
```

```bash
npm add @tauri-apps/plugin-dialog
```

### Setup

```rust
// src-tauri/src/lib.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Permissions

```json
{
  "permissions": [
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "dialog:allow-ask",
    "dialog:allow-confirm"
  ]
}
```

### Open File Picker (Frontend)

```tsx
import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

function FileManager() {
  const [content, setContent] = useState("");
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  // Open a single file
  async function openFile() {
    const selected = await open({
      title: "Open Document",
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Text Files",
          extensions: ["txt", "md", "json"],
        },
        {
          name: "All Files",
          extensions: ["*"],
        },
      ],
    });

    if (selected) {
      // selected is a string (file path) when multiple is false
      const text = await readTextFile(selected);
      setContent(text);
      setCurrentFile(selected);
    }
  }

  // Open multiple files
  async function openMultipleFiles() {
    const selected = await open({
      title: "Select Files",
      multiple: true,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp"],
        },
      ],
    });

    if (selected) {
      // selected is string[] when multiple is true
      console.log("Selected files:", selected);
    }
  }

  // Open folder picker
  async function openFolder() {
    const selected = await open({
      title: "Select Project Folder",
      directory: true,
    });

    if (selected) {
      console.log("Selected folder:", selected);
    }
  }

  // Save dialog
  async function saveFile() {
    const filePath = await save({
      title: "Save Document",
      defaultPath: currentFile ?? "untitled.txt",
      filters: [
        {
          name: "Text Files",
          extensions: ["txt"],
        },
        {
          name: "Markdown",
          extensions: ["md"],
        },
      ],
    });

    if (filePath) {
      await writeTextFile(filePath, content);
      setCurrentFile(filePath);
    }
  }

  return (
    <div>
      <div>
        <button onClick={openFile}>Open File</button>
        <button onClick={openMultipleFiles}>Open Multiple</button>
        <button onClick={openFolder}>Open Folder</button>
        <button onClick={saveFile}>Save As</button>
      </div>
      <p>Current file: {currentFile ?? "None"}</p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={20}
        cols={60}
      />
    </div>
  );
}
```

### Dialogs from Rust

```rust
use tauri_plugin_dialog::DialogExt;

#[command]
async fn pick_file_from_rust(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Text", &["txt", "md"])
        .add_filter("All", &["*"])
        .set_title("Pick a file")
        .blocking_pick_file();

    Ok(file_path.map(|p| p.to_string()))
}
```

### Message Dialogs

```tsx
import { message, ask, confirm } from "@tauri-apps/plugin-dialog";

// Simple message
await message("File saved successfully!", {
  title: "Success",
  kind: "info",
});

// Yes/No question
const answer = await ask("Do you want to save changes?", {
  title: "Unsaved Changes",
  kind: "warning",
});
if (answer) {
  // Save changes
}

// OK/Cancel confirmation
const confirmed = await confirm("Are you sure you want to delete this file?", {
  title: "Confirm Delete",
  kind: "warning",
});
```

---

## 5. Drag and Drop

Tauri 2 provides built-in drag-and-drop support through the window/webview API. No additional plugin is needed.

### Listening for Drag-and-Drop Events (React)

```tsx
import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readTextFile } from "@tauri-apps/plugin-fs";

function DropZone() {
  const [droppedFiles, setDroppedFiles] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileContent, setFileContent] = useState("");

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setupDragDrop() {
      unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type === "enter") {
          // Files entered the window area
          setIsDragging(true);
          console.log("Files entering:", event.payload.paths);
        } else if (event.payload.type === "over") {
          // Files hovering over the window
          // event.payload.position gives { x, y } coordinates
        } else if (event.payload.type === "drop") {
          // Files were dropped
          setIsDragging(false);
          setDroppedFiles(event.payload.paths);

          // Read the first dropped file
          if (event.payload.paths.length > 0) {
            try {
              const text = await readTextFile(event.payload.paths[0]);
              setFileContent(text);
            } catch (err) {
              console.error("Could not read file:", err);
            }
          }
        } else if (event.payload.type === "leave") {
          // Drag cancelled or left window
          setIsDragging(false);
        }
      });
    }

    setupDragDrop();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <div
      style={{
        border: isDragging ? "3px dashed #4a9eff" : "3px dashed #ccc",
        backgroundColor: isDragging ? "#f0f8ff" : "transparent",
        padding: "2rem",
        borderRadius: "8px",
        textAlign: "center",
        transition: "all 0.2s ease",
      }}
    >
      {isDragging ? (
        <p>Drop files here!</p>
      ) : (
        <p>Drag and drop files onto this window</p>
      )}

      {droppedFiles.length > 0 && (
        <div>
          <h3>Dropped Files:</h3>
          <ul style={{ textAlign: "left" }}>
            {droppedFiles.map((file, i) => (
              <li key={i}>{file}</li>
            ))}
          </ul>
        </div>
      )}

      {fileContent && (
        <div>
          <h3>File Content:</h3>
          <pre style={{ textAlign: "left", maxHeight: "200px", overflow: "auto" }}>
            {fileContent}
          </pre>
        </div>
      )}
    </div>
  );
}
```

### Handling Drag-and-Drop on the Rust Side

You can also listen for drag-and-drop events in Rust during window setup:

```rust
use tauri::{DragDropEvent, Listener};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let webview = app.get_webview_window("main").unwrap();

            webview.on_drag_drop_event(move |event| {
                match event {
                    DragDropEvent::Enter { paths, position } => {
                        println!("Drag entered at {:?} with {} files", position, paths.len());
                    }
                    DragDropEvent::Over { position } => {
                        // Continuously fired while hovering
                    }
                    DragDropEvent::Drop { paths, position } => {
                        println!("Dropped {} files at {:?}", paths.len(), position);
                        for path in &paths {
                            println!("  - {}", path.display());
                        }
                    }
                    DragDropEvent::Leave => {
                        println!("Drag cancelled");
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

> **Note:** When the browser DevTools panel is open and docked, drag-and-drop position coordinates may be inaccurate.

---

## 6. Path Resolution

Tauri provides a path API through `@tauri-apps/api/path` (part of the core API, no extra plugin needed) for resolving platform-specific directories.

### Common Directory Functions

```tsx
import {
  appDataDir,
  appConfigDir,
  appLocalDataDir,
  appCacheDir,
  appLogDir,
  desktopDir,
  documentDir,
  downloadDir,
  homeDir,
  tempDir,
  resourceDir,
  resolve,
  join,
  basename,
  dirname,
  extname,
} from "@tauri-apps/api/path";

async function showPaths() {
  console.log("App Data:", await appDataDir());
  // macOS: /Users/{user}/Library/Application Support/{bundle-id}
  // Linux: $HOME/.local/share/{bundle-id}
  // Windows: {FOLDERID_LocalAppData}/{bundle-id}

  console.log("App Config:", await appConfigDir());
  // macOS: /Users/{user}/Library/Application Support/{bundle-id}
  // Linux: $HOME/.config/{bundle-id}
  // Windows: {FOLDERID_RoamingAppData}/{bundle-id}

  console.log("App Cache:", await appCacheDir());
  console.log("App Log:", await appLogDir());
  console.log("Desktop:", await desktopDir());
  console.log("Documents:", await documentDir());
  console.log("Downloads:", await downloadDir());
  console.log("Home:", await homeDir());
  console.log("Temp:", await tempDir());
  console.log("Resources:", await resourceDir());
}
```

### Building Paths

```tsx
import { join, resolve, basename, dirname, extname } from "@tauri-apps/api/path";

async function pathOperations() {
  // Join path segments
  const configFile = await join("config", "app", "settings.json");

  // Resolve to absolute path
  const absolute = await resolve("/home", "user", "documents", "file.txt");

  // Extract components
  const name = await basename("/path/to/document.pdf");   // "document.pdf"
  const dir = await dirname("/path/to/document.pdf");      // "/path/to"
  const ext = await extname("/path/to/document.pdf");      // "pdf"
}
```

### Using BaseDirectory Enum

The `BaseDirectory` enum maps to the same directories and is used with the fs plugin:

```tsx
import { BaseDirectory } from "@tauri-apps/plugin-fs";

// Available values:
// BaseDirectory.Audio
// BaseDirectory.Cache
// BaseDirectory.Config
// BaseDirectory.Data
// BaseDirectory.Desktop
// BaseDirectory.Document
// BaseDirectory.Download
// BaseDirectory.Executable
// BaseDirectory.Font
// BaseDirectory.Home
// BaseDirectory.LocalData
// BaseDirectory.Picture
// BaseDirectory.Public
// BaseDirectory.Runtime
// BaseDirectory.Temp
// BaseDirectory.Template
// BaseDirectory.Video
// BaseDirectory.AppConfig
// BaseDirectory.AppData
// BaseDirectory.AppLocalData
// BaseDirectory.AppCache
// BaseDirectory.AppLog
// BaseDirectory.Resource
```

### Path Resolution in Rust

```rust
use tauri::Manager;

#[command]
fn get_app_paths(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let paths = app_handle.path();

    Ok(serde_json::json!({
        "app_data": paths.app_data_dir().map(|p| p.to_string_lossy().to_string()).ok(),
        "app_config": paths.app_config_dir().map(|p| p.to_string_lossy().to_string()).ok(),
        "app_cache": paths.app_cache_dir().map(|p| p.to_string_lossy().to_string()).ok(),
        "app_log": paths.app_log_dir().map(|p| p.to_string_lossy().to_string()).ok(),
        "desktop": paths.desktop_dir().map(|p| p.to_string_lossy().to_string()).ok(),
        "document": paths.document_dir().map(|p| p.to_string_lossy().to_string()).ok(),
        "download": paths.download_dir().map(|p| p.to_string_lossy().to_string()).ok(),
        "home": paths.home_dir().map(|p| p.to_string_lossy().to_string()).ok(),
        "temp": paths.temp_dir().map(|p| p.to_string_lossy().to_string()).ok(),
    }))
}
```

---

## 7. File Watching

Tauri 2's fs plugin includes built-in file watching (previously a separate plugin). You can also implement custom watchers in Rust using the `notify` crate.

### Watching Files from the Frontend

```tsx
import { watch, watchImmediate, BaseDirectory } from "@tauri-apps/plugin-fs";
import { useEffect, useState } from "react";

function FileWatcher() {
  const [changes, setChanges] = useState<string[]>([]);

  useEffect(() => {
    let stopWatching: (() => void) | undefined;

    async function startWatching() {
      // watch() fires on changes after setup
      stopWatching = await watch(
        "data",
        (event) => {
          console.log("File changed:", event);
          setChanges((prev) => [
            ...prev,
            `${new Date().toLocaleTimeString()}: ${JSON.stringify(event)}`,
          ]);
        },
        {
          baseDir: BaseDirectory.AppData,
          recursive: true,
        }
      );
    }

    startWatching();

    return () => {
      if (stopWatching) stopWatching();
    };
  }, []);

  return (
    <div>
      <h3>File Changes:</h3>
      <ul>
        {changes.map((change, i) => (
          <li key={i}>{change}</li>
        ))}
      </ul>
    </div>
  );
}
```

**Required permission:**

```json
{
  "permissions": ["fs:allow-watch"]
}
```

### Custom File Watcher in Rust with `notify`

For more control, implement a file watcher in Rust using the `notify` crate and send updates to the frontend via the event system.

**Cargo.toml:**

```toml
[dependencies]
notify = "7"
notify-debouncer-mini = "0.5"
```

**Rust implementation:**

```rust
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc;
use tauri::{command, AppHandle, Emitter, Manager};
use serde::Serialize;

#[derive(Clone, Serialize)]
struct FileChangeEvent {
    paths: Vec<String>,
    kind: String,
}

#[command]
fn start_watching(app: AppHandle, directory: String) -> Result<(), String> {
    let handle = app.clone();

    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel();

        let mut watcher = RecommendedWatcher::new(tx, Config::default())
            .expect("Failed to create watcher");

        watcher
            .watch(directory.as_ref(), RecursiveMode::Recursive)
            .expect("Failed to watch directory");

        // Keep watcher alive and process events
        loop {
            match rx.recv() {
                Ok(Ok(event)) => {
                    let change = FileChangeEvent {
                        paths: event
                            .paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect(),
                        kind: format!("{:?}", event.kind),
                    };

                    if let Err(e) = handle.emit("file-changed", change) {
                        eprintln!("Failed to emit event: {}", e);
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("Watch error: {}", e);
                }
                Err(e) => {
                    eprintln!("Channel error: {}", e);
                    break;
                }
            }
        }
    });

    Ok(())
}
```

### Debounced Watcher

To avoid rapid-fire events, use `notify-debouncer-mini`:

```rust
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::time::Duration;

#[command]
fn start_debounced_watching(app: AppHandle, directory: String) -> Result<(), String> {
    let handle = app.clone();

    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel();

        let mut debouncer = new_debouncer(Duration::from_millis(500), tx)
            .expect("Failed to create debouncer");

        debouncer
            .watcher()
            .watch(directory.as_ref(), RecursiveMode::Recursive)
            .expect("Failed to watch directory");

        loop {
            match rx.recv() {
                Ok(Ok(events)) => {
                    let paths: Vec<String> = events
                        .iter()
                        .map(|e| e.path.to_string_lossy().to_string())
                        .collect();

                    let _ = handle.emit("file-changed", serde_json::json!({
                        "paths": paths,
                        "debounced": true,
                    }));
                }
                Ok(Err(e)) => eprintln!("Watch error: {:?}", e),
                Err(_) => break,
            }
        }
    });

    Ok(())
}
```

### Listening for File Change Events (Frontend)

```tsx
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface FileChangeEvent {
  paths: string[];
  kind: string;
}

function RustFileWatcher() {
  const [changes, setChanges] = useState<FileChangeEvent[]>([]);

  useEffect(() => {
    // Start the Rust-side watcher
    invoke("start_watching", { directory: "/path/to/watch" });

    // Listen for events from Rust
    const unlistenPromise = listen<FileChangeEvent>("file-changed", (event) => {
      setChanges((prev) => [...prev, event.payload]);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <div>
      <h3>Watched Changes:</h3>
      {changes.map((change, i) => (
        <div key={i}>
          <strong>{change.kind}</strong>: {change.paths.join(", ")}
        </div>
      ))}
    </div>
  );
}
```

---

## 8. Clipboard

The `tauri-plugin-clipboard-manager` plugin provides read/write access to the system clipboard.

### Installation

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-clipboard-manager = "2"
```

```bash
npm add @tauri-apps/plugin-clipboard-manager
```

### Setup

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Permissions

Clipboard access is disabled by default. You must explicitly grant it:

```json
{
  "permissions": [
    "clipboard-manager:allow-read-text",
    "clipboard-manager:allow-write-text",
    "clipboard-manager:allow-read-image",
    "clipboard-manager:allow-write-image",
    "clipboard-manager:allow-write-html",
    "clipboard-manager:allow-clear"
  ]
}
```

### Reading and Writing Text (Frontend)

```tsx
import { useState } from "react";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

function ClipboardDemo() {
  const [clipboardContent, setClipboardContent] = useState("");
  const [inputText, setInputText] = useState("");

  async function copyToClipboard() {
    await writeText(inputText);
    console.log("Copied to clipboard!");
  }

  async function pasteFromClipboard() {
    const text = await readText();
    setClipboardContent(text);
  }

  return (
    <div>
      <h3>Clipboard Manager</h3>
      <div>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Text to copy"
        />
        <button onClick={copyToClipboard}>Copy</button>
      </div>
      <div>
        <button onClick={pasteFromClipboard}>Paste from Clipboard</button>
        <p>Clipboard content: {clipboardContent}</p>
      </div>
    </div>
  );
}
```

### Clipboard from Rust

```rust
use tauri_plugin_clipboard_manager::ClipboardExt;

#[command]
fn copy_to_clipboard(app: tauri::AppHandle, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(text)
        .map_err(|e| format!("Clipboard error: {}", e))
}

#[command]
fn read_clipboard(app: tauri::AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|e| format!("Clipboard error: {}", e))
}
```

---

## 9. Shell Integration

Tauri 2 provides two plugins for shell integration: `tauri-plugin-shell` for executing commands, and `tauri-plugin-opener` for opening URLs and files in default applications (the recommended replacement for the deprecated `shell.open()`).

### Opening URLs and Files with `tauri-plugin-opener`

**Installation:**

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-opener = "2"
```

```bash
npm add @tauri-apps/plugin-opener
```

**Setup:**

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Permissions:**

```json
{
  "permissions": [
    "opener:default",
    {
      "identifier": "opener:allow-open-url",
      "allow": [
        { "url": "https://**" },
        { "url": "mailto:**" }
      ]
    },
    {
      "identifier": "opener:allow-open-path",
      "allow": [
        { "path": "$DOCUMENT/**" },
        { "path": "$DOWNLOAD/**" }
      ]
    },
    "opener:allow-reveal-item-in-dir"
  ]
}
```

**Frontend usage:**

```tsx
import { openUrl, openPath, revealItemInDir } from "@tauri-apps/plugin-opener";

// Open URL in the default browser
await openUrl("https://v2.tauri.app");

// Open URL in a specific browser
await openUrl("https://v2.tauri.app", "firefox");

// Open a file with the default application
await openPath("/home/user/Documents/report.pdf");

// Reveal a file in the system file explorer
await revealItemInDir("/home/user/Documents/report.pdf");
```

**Rust usage:**

```rust
use tauri_plugin_opener::OpenerExt;

#[command]
fn open_in_browser(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| format!("Failed to open URL: {}", e))
}

#[command]
fn reveal_in_explorer(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .reveal_item_in_dir(&path)
        .map_err(|e| format!("Failed to reveal: {}", e))
}
```

### Running Shell Commands with `tauri-plugin-shell`

> **Security Warning:** Running shell commands from a desktop application is a significant attack surface. Tauri requires you to pre-define which commands and arguments are allowed via scoped permissions. Never allow arbitrary command execution from the frontend.

**Installation:**

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-shell = "2"
```

```bash
npm add @tauri-apps/plugin-shell
```

**Setup:**

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Permissions with Scoped Commands:**

You must explicitly define which commands can be executed and what arguments they accept:

```json
{
  "permissions": [
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "list-files",
          "cmd": "ls",
          "args": [
            "-la",
            { "validator": "\\S+" }
          ]
        },
        {
          "name": "git-status",
          "cmd": "git",
          "args": ["status"]
        }
      ]
    },
    {
      "identifier": "shell:allow-spawn",
      "allow": [
        {
          "name": "long-running-task",
          "cmd": "python3",
          "args": ["script.py"]
        }
      ]
    }
  ]
}
```

**Executing Commands (Frontend):**

```tsx
import { Command } from "@tauri-apps/plugin-shell";

// Execute a pre-defined command and wait for output
async function runGitStatus() {
  // The first argument must match a "name" in your scoped permissions
  const command = Command.create("git-status");
  const output = await command.execute();

  console.log("Exit code:", output.code);
  console.log("Stdout:", output.stdout);
  console.log("Stderr:", output.stderr);
}

// Spawn a long-running process and stream output
async function runLongTask() {
  const command = Command.create("long-running-task");

  command.stdout.on("data", (line) => {
    console.log("stdout:", line);
  });

  command.stderr.on("data", (line) => {
    console.error("stderr:", line);
  });

  command.on("close", (data) => {
    console.log("Process exited with code:", data.code);
  });

  command.on("error", (error) => {
    console.error("Process error:", error);
  });

  const child = await command.spawn();

  // Write to stdin if needed
  await child.write("input data\n");

  // Kill the process if needed
  // await child.kill();
}
```

**Running Commands from Rust (No Plugin Needed):**

For backend-only command execution, use `std::process::Command` directly:

```rust
use std::process::Command as StdCommand;

#[command]
fn run_system_command(cmd: String, args: Vec<String>) -> Result<String, String> {
    let output = StdCommand::new(&cmd)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 output: {}", e))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Command failed: {}", stderr))
    }
}
```

---

## 10. OS Information

The `tauri-plugin-os` plugin provides information about the host operating system.

### Installation

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-os = "2"
```

```bash
npm add @tauri-apps/plugin-os
```

### Setup

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Permissions

```json
{
  "permissions": ["os:default"]
}
```

### Getting OS Information (Frontend)

```tsx
import { useEffect, useState } from "react";
import {
  platform,
  arch,
  version,
  family,
  locale,
  hostname,
  eol,
  exeExtension,
} from "@tauri-apps/plugin-os";

interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  family: string;
  locale: string | null;
  hostname: string | null;
  eol: string;
  exeExtension: string;
}

function SystemInfoDisplay() {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    async function loadInfo() {
      setInfo({
        platform: platform(),         // "linux", "macos", "windows", "ios", "android"
        arch: arch(),                  // "x86_64", "aarch64", "arm", etc.
        version: version(),            // OS version string
        family: family(),              // "unix" or "windows"
        locale: await locale(),        // BCP-47 tag like "en-US" or null
        hostname: await hostname(),    // Machine hostname or null
        eol: eol(),                    // "\n" on Unix, "\r\n" on Windows
        exeExtension: exeExtension(),  // "exe" on Windows, "" elsewhere
      });
    }
    loadInfo();
  }, []);

  if (!info) return <p>Loading system info...</p>;

  return (
    <div>
      <h3>System Information</h3>
      <table>
        <tbody>
          <tr><td>Platform</td><td>{info.platform}</td></tr>
          <tr><td>Architecture</td><td>{info.arch}</td></tr>
          <tr><td>OS Version</td><td>{info.version}</td></tr>
          <tr><td>OS Family</td><td>{info.family}</td></tr>
          <tr><td>Locale</td><td>{info.locale ?? "Unknown"}</td></tr>
          <tr><td>Hostname</td><td>{info.hostname ?? "Unknown"}</td></tr>
          <tr>
            <td>Line Ending</td>
            <td>{info.eol === "\n" ? "LF (Unix)" : "CRLF (Windows)"}</td>
          </tr>
          <tr><td>Exe Extension</td><td>{info.exeExtension || "(none)"}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
```

### Platform-Conditional Logic

```tsx
import { platform } from "@tauri-apps/plugin-os";

function getShortcutLabel(action: string): string {
  const isMac = platform() === "macos";
  const modifier = isMac ? "Cmd" : "Ctrl";

  switch (action) {
    case "save":
      return `${modifier}+S`;
    case "copy":
      return `${modifier}+C`;
    case "paste":
      return `${modifier}+V`;
    default:
      return "";
  }
}

function getPlatformConfigPath(): string {
  switch (platform()) {
    case "macos":
      return "~/Library/Application Support/MyApp";
    case "linux":
      return "~/.config/MyApp";
    case "windows":
      return "%APPDATA%\\MyApp";
    default:
      return "unknown";
  }
}
```

### OS Information from Rust

```rust
#[command]
fn get_system_info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
    })
}
```

---

## Complete Plugin Setup Example

Here is a full `main.rs` registering all the plugins covered in this module:

```rust
// src-tauri/src/lib.rs

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_config,
            commands::save_data,
            commands::start_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

And the combined capabilities file:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",

    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "fs:allow-rename",
    "fs:allow-exists",
    "fs:allow-read-dir",
    "fs:allow-copy-file",
    "fs:allow-watch",

    "dialog:default",

    "clipboard-manager:allow-read-text",
    "clipboard-manager:allow-write-text",

    "opener:default",
    {
      "identifier": "opener:allow-open-url",
      "allow": [{ "url": "https://**" }]
    },
    "opener:allow-reveal-item-in-dir",

    "shell:default",

    "os:default"
  ]
}
```

---

## Coding Challenges

### Challenge 1: Markdown Editor with File I/O

**Description:** Build a simple Markdown editor that can open, edit, and save `.md` files using native file dialogs, with a live preview pane.

**Requirements:**
- Use `tauri-plugin-dialog` to implement "Open" and "Save As" file dialogs filtered to `.md` files
- Use `tauri-plugin-fs` to read and write file contents
- Display the raw Markdown in a textarea and a rendered preview side by side
- Track whether the document has unsaved changes and prompt the user before discarding them (use `ask()` from the dialog plugin)
- Show the current file name in the window title

**Hints:**
- Use the `open()` function with a filter for `extensions: ["md"]` and `save()` with a default filename
- A library like `marked` or `react-markdown` handles Markdown-to-HTML rendering
- Store the "last saved content" in state to compare against the current textarea value for dirty tracking

---

### Challenge 2: Drag-and-Drop Image Gallery

**Description:** Create a drag-and-drop image gallery where users can drop image files onto the window and see thumbnails, file sizes, and dimensions.

**Requirements:**
- Listen for drag-and-drop events using `getCurrentWebview().onDragDropEvent()`
- Filter dropped files to accept only image formats (`.png`, `.jpg`, `.gif`, `.webp`)
- Read each dropped image as binary data and display it as a thumbnail
- Show metadata for each image: file name, file size (from `stat()`), and path
- Add a "Copy Path" button next to each image that copies the file path to the clipboard using `tauri-plugin-clipboard-manager`

**Hints:**
- Use `readFile()` to get a `Uint8Array`, then create a blob URL with `URL.createObjectURL(new Blob([bytes]))`
- Use `stat()` from `@tauri-apps/plugin-fs` to get the file size
- Check the file extension from the path string to filter for images
- Remember to revoke blob URLs with `URL.revokeObjectURL()` when removing images from the gallery

---

### Challenge 3: System Info Dashboard

**Description:** Build a dashboard that displays comprehensive information about the user's system, including OS details, key directory paths, and clipboard contents.

**Requirements:**
- Display platform, architecture, OS version, locale, and hostname using `tauri-plugin-os`
- Show resolved paths for all application directories (AppData, AppConfig, Desktop, Documents, Home, Temp) using the path API
- Include a live clipboard viewer that polls or refreshes the clipboard content on demand
- Add an "Open" button next to each directory path that reveals the directory in the system file explorer using `tauri-plugin-opener`
- Adapt the UI based on the detected platform (e.g., show platform-appropriate keyboard shortcuts)

**Hints:**
- `platform()` and `arch()` are synchronous; `locale()` and `hostname()` are async
- Use `revealItemInDir()` from `@tauri-apps/plugin-opener` to open directories in the file manager
- Remember to configure all necessary permissions: `os:default`, `clipboard-manager:allow-read-text`, and `opener:allow-reveal-item-in-dir`

---

### Challenge 4: Config File Watcher

**Description:** Build an application that watches a JSON configuration file for external changes and automatically reloads and displays the updated configuration in the UI.

**Requirements:**
- On first launch, create a default `config.json` in the app data directory if it does not exist
- Display the parsed configuration as a formatted, editable form
- Use the fs plugin's `watch()` function to detect when the file is modified externally (e.g., by a text editor)
- When a change is detected, re-read the file and update the UI, showing a notification toast
- Allow the user to edit values in the form and save them back, avoiding a re-trigger of the watcher for self-edits

**Hints:**
- Use a boolean flag (e.g., `isSelfWriting`) to distinguish self-edits from external edits
- `watch()` returns a stop function -- call it during cleanup
- Use `mkdir` with `recursive: true` and `exists()` to ensure the data directory is available before writing
- Parse the JSON with `JSON.parse()` and re-serialize with `JSON.stringify(value, null, 2)` for readable formatting

---

### Challenge 5: Scoped Shell Command Runner

**Description:** Build a controlled terminal-like interface that allows the user to run a small set of pre-approved shell commands and view their output.

**Requirements:**
- Define at least three scoped commands in your capability configuration (e.g., `ls`, `date`, `whoami` on Unix or `dir`, `date /t`, `hostname` on Windows)
- Display a dropdown or button bar to select from the allowed commands
- Execute the selected command using `Command.create()` from `tauri-plugin-shell` and display stdout/stderr in a scrollable output panel
- Show the exit code and execution duration for each command
- Add a "Copy Output" button that copies the command output to the clipboard

**Hints:**
- Each command must have a `name` entry in your shell capability scope -- use `Command.create("the-name")` on the frontend, not the raw binary name
- Use `command.execute()` for short-lived commands (returns a promise with the full output) rather than `command.spawn()` which is for long-running processes
- Record `Date.now()` before and after execution to calculate duration
- Detect the platform with `tauri-plugin-os` to show the correct set of commands
