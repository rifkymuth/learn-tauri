# Module 08: IPC and Events

## Overview

Inter-Process Communication (IPC) is the backbone of every Tauri application. Your app runs as two separate processes: a **Rust backend** (the "core" process) and a **webview frontend** (the "frontend" process). These two processes cannot share memory directly -- they communicate exclusively through Tauri's IPC bridge. This module explores that bridge in depth: commands, events, channels, binary data transfer, and the patterns that make complex Tauri apps manageable.

**Prerequisites**: Modules 01-04 (especially 04: Commands & State)

**Estimated Time**: 3-4 hours

---

## Table of Contents

1. [IPC Architecture](#1-ipc-architecture)
2. [Commands vs Events](#2-commands-vs-events)
3. [Event System Basics](#3-event-system-basics)
4. [Frontend to Backend Events](#4-frontend-to-backend-events)
5. [Event Scoping](#5-event-scoping)
6. [Channels](#6-channels)
7. [Long-Running Tasks](#7-long-running-tasks)
8. [Event-Driven Architecture](#8-event-driven-architecture)
9. [Binary Data Transfer](#9-binary-data-transfer)
10. [Debouncing and Throttling](#10-debouncing-and-throttling)
11. [Coding Challenges](#11-coding-challenges)

---

## 1. IPC Architecture

### How the Bridge Works

When your Tauri app starts, two processes come to life:

```
┌──────────────────────────────┐     IPC Bridge     ┌──────────────────────────────┐
│       Rust Backend           │◄──────────────────►│       Webview Frontend       │
│                              │   (JSON over OS    │                              │
│  - System access             │    message pipe)   │  - React components          │
│  - File I/O                  │                    │  - UI rendering              │
│  - Database queries          │                    │  - User interaction          │
│  - Background processing     │                    │  - DOM manipulation          │
│  - Native OS APIs            │                    │                              │
└──────────────────────────────┘                    └──────────────────────────────┘
```

The IPC bridge is not a network socket or HTTP server. Tauri uses platform-specific mechanisms to pass messages between the core process and the webview. On all platforms, this boils down to evaluating JavaScript in the webview and intercepting custom protocol requests.

Every message crossing the bridge is **serialized to JSON** (with some exceptions for binary data, which we cover in section 9). This means:

- All data sent between frontend and backend must be serializable.
- Rust structs need `#[derive(Serialize, Deserialize)]` from `serde`.
- Complex types (like file handles, database connections, raw pointers) cannot cross the bridge -- you manage those on the Rust side and pass handles or identifiers to the frontend.

### The Serialization Boundary

Think of the IPC bridge as a border crossing between two countries. Anything that goes through must fit into a standard shipping container (JSON). You cannot send a live animal (a raw pointer) or a running engine (a thread handle) -- only packaged goods (serializable data).

```rust
use serde::{Deserialize, Serialize};

// This CAN cross the IPC bridge
#[derive(Serialize, Deserialize)]
struct UserProfile {
    id: u64,
    name: String,
    email: String,
    preferences: Vec<String>,
}

// This CANNOT cross the IPC bridge (not serializable, holds OS resources)
struct DatabaseConnection {
    pool: sqlx::SqlitePool,  // OS resource -- manage on the Rust side
}
```

### IPC Message Flow

When the frontend calls a Tauri command, here is what happens step by step:

1. Frontend calls `invoke("command_name", { args })`.
2. The `@tauri-apps/api` library serializes arguments to JSON.
3. The JSON message is posted through the webview's IPC mechanism.
4. Tauri's core process receives the message, deserializes arguments, and routes to the correct `#[tauri::command]` function.
5. The command runs, produces a result (or error).
6. The result is serialized back to JSON.
7. The webview receives the response and resolves the `Promise`.

```
Frontend                          Backend
   │                                 │
   │  invoke("greet", {name:"Ed"})   │
   │────────────────────────────────►│
   │        JSON: {"name":"Ed"}      │
   │                                 │  fn greet(name: String) -> String
   │                                 │  ──► "Hello, Ed!"
   │◄────────────────────────────────│
   │     JSON: "Hello, Ed!"         │
   │                                 │
   │  Promise resolves               │
```

---

## 2. Commands vs Events

Tauri gives you two main IPC mechanisms. Choosing the right one matters.

### Commands: Request / Response

Commands are like function calls across the process boundary. The frontend asks a question; the backend answers.

| Characteristic | Commands |
|---|---|
| Pattern | Request/Response |
| Initiator | Always the frontend |
| Direction | Frontend -> Backend -> Frontend |
| Return value | Yes (via Promise) |
| Error handling | Built-in (Result type maps to rejected Promise) |
| Use when | You need a specific answer to a specific question |

```typescript
// Frontend asks, backend answers
const result = await invoke<string>("get_user_name", { userId: 42 });
```

### Events: Publish / Subscribe

Events are fire-and-forget messages. Either side can emit them. Zero, one, or many listeners can receive them.

| Characteristic | Events |
|---|---|
| Pattern | Pub/Sub |
| Initiator | Either frontend or backend |
| Direction | Any direction, including backend -> frontend |
| Return value | No |
| Error handling | No built-in error propagation |
| Use when | Something happened that others might care about |

```typescript
// Backend notifies, frontend listens (no request needed)
await listen("file-changed", (event) => {
  console.log("File changed:", event.payload);
});
```

### Decision Guide

Use this table to pick the right mechanism:

| Scenario | Use |
|---|---|
| Fetching data from the backend | Command |
| Submitting a form | Command |
| CRUD operations | Command |
| Backend notifying frontend of changes | Event |
| Progress updates during a long operation | Channel (or Event) |
| Real-time log streaming | Channel |
| Frontend notifying backend of UI state | Event |
| Broadcasting to multiple windows | Event |
| Streaming binary data | Channel |

**Rule of thumb**: If the frontend needs a response, use a command. If something happened and the other side should know, use an event. If you need a stream of values from the backend, use a channel.

---

## 3. Event System Basics

### Emitting Events from Rust

The backend can emit events at any time -- not just inside command handlers. You might emit events from background threads, file watchers, or timer callbacks.

```rust
use tauri::{AppHandle, Emitter};

// Emit a simple event with a string payload
fn notify_frontend(app: &AppHandle) {
    app.emit("status-update", "Processing complete").unwrap();
}

// Emit an event with a structured payload
#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    url: String,
    bytes_downloaded: u64,
    total_bytes: u64,
    percent: f64,
}

fn report_progress(app: &AppHandle, progress: DownloadProgress) {
    app.emit("download-progress", progress).unwrap();
}
```

You can also emit events from within command handlers:

```rust
#[tauri::command]
async fn start_scan(app: tauri::AppHandle) -> Result<String, String> {
    let files = vec!["file1.txt", "file2.txt", "file3.txt"];

    for (i, file) in files.iter().enumerate() {
        // Simulate work
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // Emit progress event
        app.emit("scan-progress", serde_json::json!({
            "current": i + 1,
            "total": files.len(),
            "file": file,
        })).unwrap();
    }

    Ok("Scan complete".to_string())
}
```

### Listening in the Frontend

```typescript
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Basic listener
const unlisten = await listen<string>("status-update", (event) => {
  console.log("Status:", event.payload);
});

// Typed payload
interface DownloadProgress {
  url: string;
  bytes_downloaded: number;
  total_bytes: number;
  percent: number;
}

const unlisten2 = await listen<DownloadProgress>("download-progress", (event) => {
  console.log(`Download: ${event.payload.percent.toFixed(1)}%`);
});
```

### React Integration with Cleanup

Proper cleanup is critical. If you forget to unlisten, you create memory leaks and ghost handlers that fire after components unmount.

```tsx
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

interface ScanProgress {
  current: number;
  total: number;
  file: string;
}

function ScanMonitor() {
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  useEffect(() => {
    // listen() returns a Promise<UnlistenFn>, so we need to handle it properly
    const unlistenPromise = listen<ScanProgress>("scan-progress", (event) => {
      setProgress(event.payload);
    });

    // Cleanup: call the unlisten function when the component unmounts
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  if (!progress) return <p>Waiting for scan to start...</p>;

  return (
    <div>
      <p>Scanning: {progress.file}</p>
      <progress value={progress.current} max={progress.total} />
      <span>{progress.current} / {progress.total}</span>
    </div>
  );
}
```

### A Reusable Hook for Event Listening

Because this pattern repeats constantly, create a custom hook:

```typescript
// hooks/useTauriEvent.ts
import { useEffect } from "react";
import { listen, type Event } from "@tauri-apps/api/event";

export function useTauriEvent<T>(
  eventName: string,
  handler: (event: Event<T>) => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const unlistenPromise = listen<T>(eventName, handler);
    return () => {
      unlistenPromise.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, ...deps]);
}
```

Usage:

```tsx
function LogViewer() {
  const [logs, setLogs] = useState<string[]>([]);

  useTauriEvent<string>("log-entry", (event) => {
    setLogs((prev) => [...prev, event.payload]);
  });

  return (
    <ul>
      {logs.map((log, i) => (
        <li key={i}>{log}</li>
      ))}
    </ul>
  );
}
```

### Event Payload Types

Events carry a `payload` field. The payload must be serializable. Common patterns:

```rust
// Simple string
app.emit("notification", "Hello!").unwrap();

// Number
app.emit("counter", 42u32).unwrap();

// Struct (must derive Serialize + Clone)
#[derive(Clone, serde::Serialize)]
struct FileEvent {
    path: String,
    event_type: String, // "created", "modified", "deleted"
    timestamp: u64,
}

app.emit("file-event", FileEvent {
    path: "/tmp/data.txt".into(),
    event_type: "modified".into(),
    timestamp: 1700000000,
}).unwrap();

// Using serde_json::Value for ad-hoc payloads
app.emit("debug", serde_json::json!({
    "level": "info",
    "message": "Server started",
    "port": 8080,
})).unwrap();
```

---

## 4. Frontend to Backend Events

Communication is not one-way. The frontend can emit events that Rust listens for.

### Emitting from the Frontend

```typescript
import { emit } from "@tauri-apps/api/event";

// Fire-and-forget: notify the backend that the user changed a setting
await emit("settings-changed", {
  theme: "dark",
  fontSize: 14,
  language: "en",
});

// Notify the backend that the UI is ready
await emit("frontend-ready", null);
```

### Listening in Rust

```rust
use tauri::{Listener};

pub fn setup_event_listeners(app: &tauri::App) {
    // Listen for settings changes from the frontend
    app.listen("settings-changed", |event| {
        // event.payload() returns a &str of the JSON payload
        if let Some(payload) = event.payload().as_deref() {
            println!("Settings changed: {}", payload);

            // Parse the payload if needed
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(payload) {
                if let Some(theme) = value.get("theme").and_then(|v| v.as_str()) {
                    println!("Theme set to: {}", theme);
                }
            }
        }
    });

    // Listen for frontend ready signal
    app.listen("frontend-ready", |_event| {
        println!("Frontend is ready, starting background services...");
    });
}
```

Register these listeners during app setup:

```rust
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            setup_event_listeners(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Bidirectional Communication Example

A practical pattern: the frontend requests that the backend start monitoring a directory, and the backend reports file changes back via events.

**Rust side:**

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Listener, Manager};

#[derive(Clone, serde::Serialize)]
struct FileChange {
    path: String,
    kind: String,
}

pub fn setup_file_watcher(app: &tauri::App) {
    let app_handle = app.handle().clone();
    let is_watching = Arc::new(AtomicBool::new(false));
    let is_watching_clone = is_watching.clone();

    // Listen for "start-watching" from frontend
    app.listen("start-watching", move |event| {
        if is_watching_clone.load(Ordering::SeqCst) {
            return; // Already watching
        }
        is_watching_clone.store(true, Ordering::SeqCst);

        let handle = app_handle.clone();
        let watching = is_watching_clone.clone();

        // Spawn a background thread to simulate file watching
        std::thread::spawn(move || {
            while watching.load(Ordering::SeqCst) {
                // In a real app, you'd use `notify` crate here
                std::thread::sleep(std::time::Duration::from_secs(2));
                handle.emit("file-change", FileChange {
                    path: "/watched/dir/example.txt".into(),
                    kind: "modified".into(),
                }).unwrap();
            }
        });
    });

    let is_watching_stop = is_watching.clone();
    app.listen("stop-watching", move |_event| {
        is_watching_stop.store(false, Ordering::SeqCst);
    });
}
```

**React side:**

```tsx
import { useEffect, useState, useCallback } from "react";
import { emit, listen } from "@tauri-apps/api/event";

interface FileChange {
  path: string;
  kind: string;
}

function FileWatcher() {
  const [watching, setWatching] = useState(false);
  const [changes, setChanges] = useState<FileChange[]>([]);

  useEffect(() => {
    const unlistenPromise = listen<FileChange>("file-change", (event) => {
      setChanges((prev) => [...prev.slice(-99), event.payload]); // Keep last 100
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  const toggleWatching = useCallback(async () => {
    if (watching) {
      await emit("stop-watching", null);
    } else {
      await emit("start-watching", { path: "/watched/dir" });
    }
    setWatching(!watching);
  }, [watching]);

  return (
    <div>
      <button onClick={toggleWatching}>
        {watching ? "Stop Watching" : "Start Watching"}
      </button>
      <ul>
        {changes.map((change, i) => (
          <li key={i}>
            [{change.kind}] {change.path}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 5. Event Scoping

### Global Events

By default, events are **global** -- every listener for that event name receives the event, regardless of which window they belong to.

```rust
use tauri::Emitter;

// This event reaches ALL windows
app.emit("global-notification", "System update available").unwrap();
```

```typescript
// Any window can listen
await listen("global-notification", (event) => {
  console.log(event.payload);
});
```

### Window-Specific Events

Sometimes you want to send an event to a specific window only. Tauri 2.x provides `emit_to` for this.

```rust
use tauri::{Emitter, Manager};

// Emit to a specific window by its label
app.emit_to("settings", "config-updated", new_config).unwrap();

// Emit to the focused window
if let Some(window) = app.get_webview_window("main") {
    window.emit("window-specific-event", payload).unwrap();
}
```

### Targeting Specific Windows from the Frontend

```typescript
import { emit, emitTo } from "@tauri-apps/api/event";

// Emit to all windows (global)
await emit("theme-changed", { theme: "dark" });

// Emit to a specific window by label
await emitTo("editor", "open-file", { path: "/tmp/file.txt" });
```

### Listening for Window-Specific Events

In Tauri 2.x, you can also scope listeners. The frontend `listen` function listens for events emitted to the current window or globally:

```typescript
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

// Listens for global events and events targeted at this window
const unlisten = await listen("config-updated", (event) => {
  console.log("Config updated:", event.payload);
});

// You can also listen on the window object
const currentWindow = getCurrentWebviewWindow();
const unlisten2 = await currentWindow.listen("window-specific-event", (event) => {
  console.log("This window only:", event.payload);
});
```

### Practical Example: Multi-Window Chat

```rust
use tauri::{Emitter, Manager};

#[derive(Clone, serde::Serialize)]
struct ChatMessage {
    from: String,
    text: String,
    timestamp: u64,
}

#[tauri::command]
fn send_message(app: tauri::AppHandle, to_window: String, message: ChatMessage) {
    // Send to a specific chat window
    app.emit_to(&to_window, "new-message", &message).unwrap();

    // Also notify the sender's window for confirmation
    app.emit_to(&message.from, "message-sent", &message).unwrap();
}
```

---

## 6. Channels

### The Channel API

Tauri 2.x introduced the **Channel API** -- a dedicated mechanism for streaming data from the Rust backend to the frontend. While events work for occasional notifications, channels are optimized for high-throughput, ordered delivery of messages within a single command invocation.

Think of the difference this way:
- **Events** are like a public announcement system -- anyone can listen, messages are broadcast.
- **Channels** are like a dedicated phone line -- created for a specific call, messages flow in order, the line is closed when done.

### Basic Channel Usage

**Rust side:**

```rust
use tauri::ipc::Channel;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum ProgressEvent {
    #[serde(rename_all = "camelCase")]
    Started { total_items: u32 },
    #[serde(rename_all = "camelCase")]
    Progress { current: u32, total: u32, message: String },
    Finished { summary: String },
}

#[tauri::command]
async fn process_files(
    paths: Vec<String>,
    on_progress: Channel<ProgressEvent>,
) -> Result<(), String> {
    let total = paths.len() as u32;

    on_progress.send(ProgressEvent::Started { total_items: total })
        .map_err(|e| e.to_string())?;

    for (i, path) in paths.iter().enumerate() {
        // Simulate processing
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        on_progress.send(ProgressEvent::Progress {
            current: i as u32 + 1,
            total,
            message: format!("Processing {}", path),
        }).map_err(|e| e.to_string())?;
    }

    on_progress.send(ProgressEvent::Finished {
        summary: format!("Processed {} files", total),
    }).map_err(|e| e.to_string())?;

    Ok(())
}
```

**React side:**

```tsx
import { invoke, Channel } from "@tauri-apps/api/core";
import { useState } from "react";

type ProgressEvent =
  | { event: "Started"; data: { totalItems: number } }
  | { event: "Progress"; data: { current: number; total: number; message: string } }
  | { event: "Finished"; data: { summary: string } };

function FileProcessor() {
  const [status, setStatus] = useState<string>("Idle");
  const [progress, setProgress] = useState<number>(0);

  async function handleProcess() {
    const channel = new Channel<ProgressEvent>();

    channel.onmessage = (message) => {
      switch (message.event) {
        case "Started":
          setStatus(`Starting... ${message.data.totalItems} items`);
          setProgress(0);
          break;
        case "Progress":
          setStatus(message.data.message);
          setProgress((message.data.current / message.data.total) * 100);
          break;
        case "Finished":
          setStatus(message.data.summary);
          setProgress(100);
          break;
      }
    };

    const files = ["image1.png", "image2.png", "image3.png", "image4.png"];
    await invoke("process_files", { paths: files, onProgress: channel });
  }

  return (
    <div>
      <button onClick={handleProcess}>Process Files</button>
      <p>{status}</p>
      <progress value={progress} max={100} />
    </div>
  );
}
```

### Why Channels Over Events for Streaming

| Feature | Events | Channels |
|---|---|---|
| Ordering guarantee | No | Yes |
| Scoped to a command | No | Yes |
| Automatic cleanup | No (manual unlisten) | Yes (dropped when command finishes) |
| Multiple listeners | Yes | No (one consumer) |
| Direction | Both ways | Rust to frontend only |
| Performance overhead | Higher (global routing) | Lower (direct pipe) |

### File Download with Channel Progress

A complete example of downloading a file and reporting progress:

**Rust side:**

```rust
use tauri::ipc::Channel;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum DownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        url: String,
        total_bytes: u64,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        bytes_downloaded: u64,
        total_bytes: u64,
        speed_bps: u64,
    },
    #[serde(rename_all = "camelCase")]
    Complete {
        path: String,
        total_bytes: u64,
        elapsed_ms: u64,
    },
    Error {
        message: String,
    },
}

#[tauri::command]
async fn download_file(
    url: String,
    destination: String,
    on_progress: Channel<DownloadEvent>,
) -> Result<String, String> {
    // In a real app, use reqwest with streaming
    let total_bytes: u64 = 10_000_000; // Simulated file size
    let chunk_size: u64 = 500_000;
    let start = std::time::Instant::now();

    on_progress.send(DownloadEvent::Started {
        url: url.clone(),
        total_bytes,
    }).map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;
    while downloaded < total_bytes {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        downloaded = (downloaded + chunk_size).min(total_bytes);

        let elapsed = start.elapsed().as_millis().max(1) as u64;
        let speed = (downloaded * 1000) / elapsed;

        on_progress.send(DownloadEvent::Progress {
            bytes_downloaded: downloaded,
            total_bytes,
            speed_bps: speed,
        }).map_err(|e| e.to_string())?;
    }

    let elapsed_ms = start.elapsed().as_millis() as u64;
    on_progress.send(DownloadEvent::Complete {
        path: destination.clone(),
        total_bytes,
        elapsed_ms,
    }).map_err(|e| e.to_string())?;

    Ok(destination)
}
```

**React side:**

```tsx
import { invoke, Channel } from "@tauri-apps/api/core";
import { useState } from "react";

type DownloadEvent =
  | { event: "Started"; data: { url: string; totalBytes: number } }
  | { event: "Progress"; data: { bytesDownloaded: number; totalBytes: number; speedBps: number } }
  | { event: "Complete"; data: { path: string; totalBytes: number; elapsedMs: number } }
  | { event: "Error"; data: { message: string } };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DownloadManager() {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState("");
  const [status, setStatus] = useState("Ready");

  async function startDownload() {
    setDownloading(true);
    const channel = new Channel<DownloadEvent>();

    channel.onmessage = (message) => {
      switch (message.event) {
        case "Started":
          setStatus(`Downloading ${formatBytes(message.data.totalBytes)}...`);
          break;
        case "Progress":
          const pct = (message.data.bytesDownloaded / message.data.totalBytes) * 100;
          setProgress(pct);
          setSpeed(`${formatBytes(message.data.speedBps)}/s`);
          break;
        case "Complete":
          setStatus(`Done! Saved to ${message.data.path} in ${message.data.elapsedMs}ms`);
          setDownloading(false);
          break;
        case "Error":
          setStatus(`Error: ${message.data.message}`);
          setDownloading(false);
          break;
      }
    };

    try {
      await invoke("download_file", {
        url: "https://example.com/large-file.zip",
        destination: "/tmp/large-file.zip",
        onProgress: channel,
      });
    } catch (err) {
      setStatus(`Failed: ${err}`);
      setDownloading(false);
    }
  }

  return (
    <div>
      <button onClick={startDownload} disabled={downloading}>
        {downloading ? "Downloading..." : "Start Download"}
      </button>
      <progress value={progress} max={100} />
      <p>{progress.toFixed(1)}% - {speed}</p>
      <p>{status}</p>
    </div>
  );
}
```

---

## 7. Long-Running Tasks

### The Problem

Tauri commands run on an async runtime. If a command takes a long time (processing files, network requests, heavy computation), you need to:

1. Keep the UI responsive (do not block the main thread).
2. Report progress to the user.
3. Allow the user to cancel the operation.

### Background Tasks with Progress Reporting

**Rust side:**

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;
use tokio::sync::Mutex;

// Store cancellation tokens in Tauri state
pub struct TaskManager {
    cancel_flags: Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>,
}

impl TaskManager {
    pub fn new() -> Self {
        Self {
            cancel_flags: Mutex::new(std::collections::HashMap::new()),
        }
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum TaskEvent {
    #[serde(rename_all = "camelCase")]
    Progress { task_id: String, percent: f64, message: String },
    #[serde(rename_all = "camelCase")]
    Complete { task_id: String, result: String },
    #[serde(rename_all = "camelCase")]
    Cancelled { task_id: String },
    #[serde(rename_all = "camelCase")]
    Error { task_id: String, message: String },
}

#[tauri::command]
async fn start_task(
    task_id: String,
    items: Vec<String>,
    on_event: Channel<TaskEvent>,
    task_manager: State<'_, TaskManager>,
) -> Result<(), String> {
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut flags = task_manager.cancel_flags.lock().await;
        flags.insert(task_id.clone(), cancel_flag.clone());
    }

    let total = items.len();
    for (i, item) in items.iter().enumerate() {
        // Check for cancellation
        if cancel_flag.load(Ordering::SeqCst) {
            on_event.send(TaskEvent::Cancelled {
                task_id: task_id.clone(),
            }).map_err(|e| e.to_string())?;

            // Clean up
            let mut flags = task_manager.cancel_flags.lock().await;
            flags.remove(&task_id);
            return Ok(());
        }

        // Simulate work
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;

        let percent = ((i + 1) as f64 / total as f64) * 100.0;
        on_event.send(TaskEvent::Progress {
            task_id: task_id.clone(),
            percent,
            message: format!("Processing: {}", item),
        }).map_err(|e| e.to_string())?;
    }

    on_event.send(TaskEvent::Complete {
        task_id: task_id.clone(),
        result: format!("Processed {} items successfully", total),
    }).map_err(|e| e.to_string())?;

    // Clean up
    let mut flags = task_manager.cancel_flags.lock().await;
    flags.remove(&task_id);

    Ok(())
}

#[tauri::command]
async fn cancel_task(
    task_id: String,
    task_manager: State<'_, TaskManager>,
) -> Result<(), String> {
    let flags = task_manager.cancel_flags.lock().await;
    if let Some(flag) = flags.get(&task_id) {
        flag.store(true, Ordering::SeqCst);
        Ok(())
    } else {
        Err(format!("Task {} not found", task_id))
    }
}
```

Register the state:

```rust
fn main() {
    tauri::Builder::default()
        .manage(TaskManager::new())
        .invoke_handler(tauri::generate_handler![start_task, cancel_task])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**React side:**

```tsx
import { invoke, Channel } from "@tauri-apps/api/core";
import { useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

type TaskEvent =
  | { event: "Progress"; data: { taskId: string; percent: number; message: string } }
  | { event: "Complete"; data: { taskId: string; result: string } }
  | { event: "Cancelled"; data: { taskId: string } }
  | { event: "Error"; data: { taskId: string; message: string } };

function TaskRunner() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Idle");
  const taskIdRef = useRef<string | null>(null);

  async function handleStart() {
    const taskId = uuidv4();
    taskIdRef.current = taskId;
    setRunning(true);
    setProgress(0);

    const channel = new Channel<TaskEvent>();
    channel.onmessage = (msg) => {
      switch (msg.event) {
        case "Progress":
          setProgress(msg.data.percent);
          setMessage(msg.data.message);
          break;
        case "Complete":
          setMessage(msg.data.result);
          setRunning(false);
          break;
        case "Cancelled":
          setMessage("Task cancelled by user");
          setRunning(false);
          break;
        case "Error":
          setMessage(`Error: ${msg.data.message}`);
          setRunning(false);
          break;
      }
    };

    const items = Array.from({ length: 20 }, (_, i) => `item-${i + 1}`);
    try {
      await invoke("start_task", { taskId, items, onEvent: channel });
    } catch (err) {
      setMessage(`Failed: ${err}`);
      setRunning(false);
    }
  }

  async function handleCancel() {
    if (taskIdRef.current) {
      await invoke("cancel_task", { taskId: taskIdRef.current });
    }
  }

  return (
    <div>
      <button onClick={handleStart} disabled={running}>Start Task</button>
      <button onClick={handleCancel} disabled={!running}>Cancel</button>
      <progress value={progress} max={100} />
      <p>{progress.toFixed(0)}% - {message}</p>
    </div>
  );
}
```

### Spawning Independent Background Work

Sometimes you want a task to outlive the command that started it. Use `tauri::async_runtime::spawn` or `std::thread::spawn`:

```rust
use tauri::{AppHandle, Emitter};

#[tauri::command]
fn start_background_service(app: AppHandle) {
    // This task continues after the command returns
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;

            // Do periodic work (health checks, syncing, etc.)
            let status = check_server_health().await;
            app.emit("health-check", status).unwrap();
        }
    });
}

async fn check_server_health() -> String {
    // In a real app, make an HTTP request
    "healthy".to_string()
}
```

---

## 8. Event-Driven Architecture

### Designing Around Events

In a complex Tauri application, events can serve as the glue between loosely coupled components. Rather than having every part of your backend know about every other part, components emit events when things happen, and other components react.

### The Event Bus Pattern

```rust
use tauri::{AppHandle, Emitter, Listener, Manager};

// Define all your application events in one place
mod app_events {
    pub const USER_LOGGED_IN: &str = "user:logged-in";
    pub const USER_LOGGED_OUT: &str = "user:logged-out";
    pub const DATA_SYNCED: &str = "data:synced";
    pub const DATA_SYNC_ERROR: &str = "data:sync-error";
    pub const SETTINGS_CHANGED: &str = "settings:changed";
    pub const FILE_IMPORTED: &str = "file:imported";
}

// Each module sets up its own listeners
pub fn setup_sync_service(app: &tauri::App) {
    let handle = app.handle().clone();

    // When the user logs in, start syncing
    app.listen(app_events::USER_LOGGED_IN, move |event| {
        let handle = handle.clone();
        tauri::async_runtime::spawn(async move {
            match sync_data(&handle).await {
                Ok(_) => handle.emit(app_events::DATA_SYNCED, "Sync complete").unwrap(),
                Err(e) => handle.emit(app_events::DATA_SYNC_ERROR, e.to_string()).unwrap(),
            }
        });
    });
}

pub fn setup_analytics(app: &tauri::App) {
    // Track user events for analytics
    app.listen(app_events::USER_LOGGED_IN, |_event| {
        println!("[Analytics] User logged in");
    });

    app.listen(app_events::FILE_IMPORTED, |_event| {
        println!("[Analytics] File imported");
    });
}

pub fn setup_notification_service(app: &tauri::App) {
    let handle = app.handle().clone();

    app.listen(app_events::DATA_SYNC_ERROR, move |event| {
        // Show a notification to the user
        handle.emit("show-notification", serde_json::json!({
            "type": "error",
            "title": "Sync Failed",
            "message": event.payload(),
        })).unwrap();
    });
}

async fn sync_data(app: &AppHandle) -> Result<(), String> {
    // Real sync logic here
    Ok(())
}
```

Wire everything together in `main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            setup_sync_service(app);
            setup_analytics(app);
            setup_notification_service(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Frontend Event Bus

On the React side, you can mirror this pattern with a centralized event handler:

```tsx
// services/eventBus.ts
import { listen, emit } from "@tauri-apps/api/event";

type EventHandler = (payload: unknown) => void;

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private unlisteners: Array<() => void> = [];

  async subscribe(eventName: string, handler: EventHandler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());

      // Set up Tauri listener for this event name
      const unlisten = await listen(eventName, (event) => {
        const handlers = this.handlers.get(eventName);
        if (handlers) {
          for (const h of handlers) {
            h(event.payload);
          }
        }
      });
      this.unlisteners.push(unlisten);
    }

    this.handlers.get(eventName)!.add(handler);
    return () => {
      this.handlers.get(eventName)?.delete(handler);
    };
  }

  async publish(eventName: string, payload: unknown) {
    await emit(eventName, payload);
  }

  destroy() {
    for (const unlisten of this.unlisteners) {
      unlisten();
    }
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
```

Usage in components:

```tsx
import { useEffect } from "react";
import { eventBus } from "../services/eventBus";

function NotificationToast() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribePromise = eventBus.subscribe("show-notification", (payload) => {
      const notif = payload as Notification;
      setNotifications((prev) => [...prev, notif]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n !== notif));
      }, 5000);
    });

    return () => {
      unsubscribePromise.then((unsub) => unsub());
    };
  }, []);

  return (
    <div className="toast-container">
      {notifications.map((n, i) => (
        <div key={i} className={`toast toast-${n.type}`}>
          <strong>{n.title}</strong>
          <p>{n.message}</p>
        </div>
      ))}
    </div>
  );
}
```

### Decoupling Benefits

The event-driven approach gives you:

1. **Loose coupling** -- the sync service does not import the notification service. They communicate only through events.
2. **Easy testing** -- test each service by emitting events and checking side effects.
3. **Extensibility** -- adding a new feature (like logging every event to a file) means adding one new listener, not modifying existing code.
4. **Clear data flow** -- event names document what happens in your application.

---

## 9. Binary Data Transfer

### The JSON Problem

JSON is text-based. Sending large binary data (images, audio, file contents) as JSON means Base64 encoding, which inflates size by ~33% and adds encoding/decoding overhead.

Tauri 2.x handles this with special treatment for `Vec<u8>` in commands and the `tauri::ipc::Response` type.

### Returning Binary Data from Commands

When a command returns `Vec<u8>`, Tauri automatically transfers it as raw binary (an `ArrayBuffer` on the frontend), bypassing JSON serialization:

```rust
#[tauri::command]
async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_thumbnail(path: String, max_size: u32) -> Result<Vec<u8>, String> {
    // Use an image processing library
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let thumbnail = img.thumbnail(max_size, max_size);

    let mut buffer = Vec::new();
    thumbnail
        .write_to(&mut std::io::Cursor::new(&mut buffer), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(buffer)
}
```

**Frontend:**

```typescript
import { invoke } from "@tauri-apps/api/core";

// The result is an ArrayBuffer (not a JSON array of numbers)
const bytes: ArrayBuffer = await invoke("read_file_bytes", {
  path: "/tmp/photo.jpg",
});

// Convert to Uint8Array for manipulation
const uint8 = new Uint8Array(bytes);
console.log(`File size: ${uint8.length} bytes`);

// Create a blob URL for display
const blob = new Blob([bytes], { type: "image/jpeg" });
const url = URL.createObjectURL(blob);
// Use `url` in an <img> tag
```

### Displaying Binary Images in React

```tsx
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";

function ThumbnailViewer({ filePath }: { filePath: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let blobUrl: string | null = null;

    async function loadThumbnail() {
      const bytes: ArrayBuffer = await invoke("generate_thumbnail", {
        path: filePath,
        maxSize: 200,
      });

      const blob = new Blob([bytes], { type: "image/png" });
      blobUrl = URL.createObjectURL(blob);
      setImageUrl(blobUrl);
    }

    loadThumbnail();

    // Clean up the blob URL when the component unmounts
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [filePath]);

  if (!imageUrl) return <p>Loading...</p>;

  return <img src={imageUrl} alt="Thumbnail" />;
}
```

### Sending Binary Data to the Backend

To send binary data from the frontend to the backend, pass a `Uint8Array` or `number[]`, which Tauri deserializes as `Vec<u8>` on the Rust side:

```typescript
// Read from a file input or canvas
const fileInput = document.querySelector<HTMLInputElement>("#file-input");
const file = fileInput?.files?.[0];
if (file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = Array.from(new Uint8Array(arrayBuffer));

  await invoke("save_file", {
    path: "/tmp/upload.bin",
    data: bytes,
  });
}
```

```rust
#[tauri::command]
async fn save_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| e.to_string())
}
```

### Custom Response Type for Large Data

For maximum control over the response, use `tauri::ipc::Response`:

```rust
use tauri::ipc::Response;

#[tauri::command]
fn read_large_file(path: String) -> Result<Response, String> {
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(Response::new(data))
}
```

This gives you the same raw binary transfer but with more flexibility for headers and metadata in advanced scenarios.

---

## 10. Debouncing and Throttling

### The Problem with High-Frequency Events

Some operations produce events at very high rates:
- Mouse movement tracking: 60+ events per second.
- File system watchers: bursts of events when saving a file.
- Log streaming: hundreds of lines per second.
- Sensor data: continuous readings.

If you push every event to the frontend and re-render on each one, performance will suffer.

### Throttling on the Rust Side

Limit how often events are emitted:

```rust
use std::time::{Duration, Instant};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

struct Throttle {
    last_emit: Mutex<Instant>,
    interval: Duration,
}

impl Throttle {
    fn new(interval: Duration) -> Self {
        Self {
            last_emit: Mutex::new(Instant::now() - interval), // Allow immediate first emit
            interval,
        }
    }

    fn should_emit(&self) -> bool {
        let mut last = self.last_emit.lock().unwrap();
        let now = Instant::now();
        if now.duration_since(*last) >= self.interval {
            *last = now;
            true
        } else {
            false
        }
    }
}

#[tauri::command]
async fn start_monitoring(app: AppHandle) {
    let throttle = Throttle::new(Duration::from_millis(100)); // Max 10 events/sec

    tauri::async_runtime::spawn(async move {
        loop {
            let cpu_usage = get_cpu_usage();

            if throttle.should_emit() {
                app.emit("cpu-usage", cpu_usage).unwrap();
            }

            tokio::time::sleep(Duration::from_millis(16)).await; // ~60Hz sampling
        }
    });
}

fn get_cpu_usage() -> f64 {
    // Real implementation would use sysinfo crate
    42.0
}
```

### Batching Updates

Instead of sending one event per item, batch items together:

```rust
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

struct LogBuffer {
    entries: Mutex<Vec<String>>,
}

impl LogBuffer {
    fn new() -> Self {
        Self {
            entries: Mutex::new(Vec::new()),
        }
    }

    fn push(&self, entry: String) {
        self.entries.lock().unwrap().push(entry);
    }

    fn drain(&self) -> Vec<String> {
        let mut entries = self.entries.lock().unwrap();
        std::mem::take(&mut *entries)
    }
}

#[tauri::command]
async fn start_log_stream(app: AppHandle) {
    let buffer = std::sync::Arc::new(LogBuffer::new());
    let buffer_writer = buffer.clone();
    let buffer_flusher = buffer.clone();

    // Producer: writes logs as fast as they come
    tauri::async_runtime::spawn(async move {
        loop {
            let log = generate_log_entry().await;
            buffer_writer.push(log);
        }
    });

    // Flusher: sends batches to the frontend at a fixed rate
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            let batch = buffer_flusher.drain();
            if !batch.is_empty() {
                app.emit("log-batch", batch).unwrap();
            }
        }
    });
}

async fn generate_log_entry() -> String {
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    format!("[{}] Log entry", chrono::Utc::now())
}
```

### Debouncing on the Frontend

For frontend-originated events (like search-as-you-type), debounce before calling the backend:

```tsx
import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function useDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  ) as T;
}

interface SearchResult {
  title: string;
  path: string;
}

function SearchBar() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const performSearch = useDebounce(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const hits = await invoke<SearchResult[]>("search_files", { query });
      setResults(hits);
    } finally {
      setSearching(false);
    }
  }, 300); // Wait 300ms after the user stops typing

  return (
    <div>
      <input
        type="text"
        placeholder="Search files..."
        onChange={(e) => performSearch(e.target.value)}
      />
      {searching && <p>Searching...</p>}
      <ul>
        {results.map((r) => (
          <li key={r.path}>{r.title} - {r.path}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Handling Batched Events in React

When the backend sends batched log entries, process them efficiently:

```tsx
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

function LogConsole() {
  const [logs, setLogs] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const MAX_LOGS = 1000;

  useEffect(() => {
    const unlistenPromise = listen<string[]>("log-batch", (event) => {
      setLogs((prev) => {
        const combined = [...prev, ...event.payload];
        // Keep only the last MAX_LOGS entries to prevent memory issues
        return combined.length > MAX_LOGS
          ? combined.slice(combined.length - MAX_LOGS)
          : combined;
      });
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      ref={containerRef}
      style={{ height: 400, overflow: "auto", fontFamily: "monospace", fontSize: 12 }}
    >
      {logs.map((log, i) => (
        <div key={i}>{log}</div>
      ))}
    </div>
  );
}
```

---

## 11. Coding Challenges

### Challenge 1: Real-Time System Monitor

**Description**: Build a system monitoring dashboard that displays CPU usage, memory usage, and disk activity in real time, with smooth updating charts.

**Requirements**:
- Create a Rust backend that collects system metrics every 500ms (you can use the `sysinfo` crate, or simulate the data).
- Stream metrics to the frontend using the Channel API.
- Display at least two metrics as live-updating progress bars or simple line charts.
- Implement throttling so that the UI updates at most 5 times per second, even if data arrives faster.
- Add a start/stop toggle button.
- When stopped, the backend must actually stop collecting data (not just stop sending it).

**Hints**:
- Use a tagged enum for the channel payload (e.g., `CpuUpdate`, `MemoryUpdate`, `DiskUpdate`).
- Store the cancellation flag in `tauri::State` so the stop command can access it.
- On the frontend, consider using `requestAnimationFrame` or a 200ms `setInterval` to batch React state updates rather than updating on every channel message.

---

### Challenge 2: Multi-Window Chat Application

**Description**: Create an application where each window represents a "chat room." Messages sent in one window should appear in specific other windows based on the room they belong to.

**Requirements**:
- Support creating new windows dynamically, each with a room name label.
- Messages typed in one window should be delivered only to windows in the same "room" (use event scoping with `emit_to`).
- Display a roster of active windows/rooms visible from any window (use global events).
- Implement a "broadcast" mode that sends a message to all rooms.
- Handle window close events gracefully -- update the roster when a window is closed.

**Hints**:
- Use `WebviewWindowBuilder` to create new windows at runtime. Give each a unique label that encodes the room name.
- Maintain a `HashMap<String, Vec<String>>` in Rust state mapping room names to window labels.
- Use `emit_to` for room-specific messages and `emit` for broadcasts.
- Listen for the `tauri://close-requested` event or use `on_window_event` to detect window closures.

---

### Challenge 3: File Upload with Resumable Progress

**Description**: Build a file "uploader" (simulated -- write chunks to a destination file) that reports progress via channels, supports pause/resume, and can survive the upload being cancelled and restarted.

**Requirements**:
- Accept a file path and a destination path.
- Read the file in chunks (e.g., 64KB) and write each chunk to the destination, reporting progress after each chunk via a Channel.
- Implement pause and resume: when paused, the background task should stop reading and wait. When resumed, it should continue from where it left off.
- Implement cancel: the partial destination file should be deleted.
- If the destination file already exists with partial content, detect how much was written and resume from that point (simulating a resumable upload).
- Show a progress bar, speed estimate, and ETA on the frontend.

**Hints**:
- Use `tokio::sync::watch` or `tokio::sync::Notify` for the pause/resume signal rather than a busy-wait loop.
- Track bytes written so far. On resume, seek to that position in both the source and destination files.
- Calculate speed as `bytes_since_last_update / time_since_last_update` and ETA as `remaining_bytes / speed`.
- Use the `Channel<ProgressEvent>` pattern from section 6, with variants for `Started`, `Progress`, `Paused`, `Resumed`, `Complete`, `Cancelled`, and `Error`.

---

### Challenge 4: Event-Sourced Todo List

**Description**: Build a todo list application where all state changes are modeled as events. The backend maintains an event log, and the frontend reconstructs its UI state by replaying events.

**Requirements**:
- Define event types: `TodoCreated`, `TodoCompleted`, `TodoUncompleted`, `TodoDeleted`, `TodoRenamed`.
- Every user action emits an event (via a command) that is appended to an in-memory event log on the Rust side.
- The frontend can request the full event log and replay it to build the current state.
- New events are pushed to the frontend in real time via the event system.
- Implement an "undo" feature that removes the last event from the log and re-broadcasts the full state.
- Bonus: persist the event log to a JSON file so state survives app restarts.

**Hints**:
- The Rust backend owns the "source of truth" -- the event log (`Vec<TodoEvent>`).
- Each event should have a unique ID and timestamp.
- On the frontend, write a pure function `replayEvents(events: TodoEvent[]): Todo[]` that reduces the event list into the current todo state.
- For undo, pop the last event, then emit the full rebuilt state to the frontend.

---

### Challenge 5: Binary Data Pipeline

**Description**: Build an image processing pipeline where the user selects images, sends them to the Rust backend for processing (resize, grayscale, blur), and receives the processed images back -- all using efficient binary transfer.

**Requirements**:
- Allow the user to select multiple image files using a file dialog.
- Send each image to the backend as binary data (not Base64).
- The backend applies a user-selected transformation (resize to 50%, convert to grayscale, or apply a blur).
- Return the processed image as binary data and display it in the UI alongside the original.
- Process images in parallel on the Rust side using `tokio::spawn` or `rayon`.
- Report per-image progress via a Channel (e.g., "Processing image 3 of 5").
- Measure and display the total processing time and the size reduction achieved.

**Hints**:
- Use the `image` crate in Rust for transformations.
- On the frontend, use `URL.createObjectURL(new Blob([arrayBuffer]))` to display the returned binary data as images.
- Remember to call `URL.revokeObjectURL()` when images are removed from the UI to prevent memory leaks.
- For parallel processing, collect futures with `futures::future::join_all` or use `rayon`'s parallel iterators for CPU-bound work.
- Return `Vec<u8>` from your command for automatic binary transfer.
