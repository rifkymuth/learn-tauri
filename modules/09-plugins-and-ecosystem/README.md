# Module 9: Plugins and the Tauri Ecosystem

## Overview

Tauri 2.x embraces a plugin-first architecture. Many features that were built into the Tauri core in v1 have been moved into official plugins, making the core leaner and allowing developers to include only the capabilities they need. This module covers how the plugin system works, the full catalog of official plugins, how to install and use them, how to create your own plugins, and how the capability/permission system ties everything together.

---

## Table of Contents

1. [Plugin Architecture](#1-plugin-architecture)
2. [Official Plugins Overview](#2-official-plugins-overview)
3. [Installing and Configuring Plugins](#3-installing-and-configuring-plugins)
4. [Using Plugins - Detailed Examples](#4-using-plugins---detailed-examples)
5. [Creating Your Own Plugin](#5-creating-your-own-plugin)
6. [Community Plugins](#6-community-plugins)
7. [Capability and Permission System](#7-capability-and-permission-system)
8. [Coding Challenges](#8-coding-challenges)

---

## 1. Plugin Architecture

### How Tauri Plugins Work

A Tauri plugin is a self-contained module that extends your application's capabilities. Every plugin has two sides:

- **Rust side (backend):** A Cargo crate that hooks into the Tauri runtime, registers commands, manages state, and accesses system APIs.
- **JavaScript side (frontend):** An optional NPM package that provides type-safe bindings to invoke the plugin's backend commands from your web frontend.

Additionally, plugins can include platform-specific native code:
- **Android:** A Kotlin (or Java) library project
- **iOS:** A Swift package

### Plugin Lifecycle

When Tauri boots your application, each registered plugin goes through a defined lifecycle:

```
App starts
  |
  v
Plugin::setup()        -- Called when the plugin is initialized
  |                       (access to App handle, register state, etc.)
  v
Plugin::on_navigation() -- Called on each webview navigation
  |
  v
Plugin::on_webview_ready() -- Called when a webview is ready
  |
  v
[App is running - commands are available]
  |
  v
Plugin::on_drop()      -- Called when the app is shutting down
```

### Rust Side: `tauri::plugin::Builder`

On the Rust side, a plugin is constructed using `tauri::plugin::Builder`. This builder is similar to `tauri::Builder` for the main app:

```rust
use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("my-plugin")
        // Register invokable commands
        .invoke_handler(tauri::generate_handler![my_command])
        // Run setup logic when plugin initializes
        .setup(|app, _api| {
            // Initialize plugin state, resources, etc.
            Ok(())
        })
        // Hook into webview lifecycle
        .on_navigation(|_webview, url| {
            // Return true to allow navigation, false to block
            println!("Navigating to: {}", url);
            true
        })
        .on_drop(|_app| {
            // Cleanup when the plugin is dropped
            println!("Plugin shutting down");
        })
        .build()
}

#[tauri::command]
fn my_command() -> String {
    "Hello from plugin!".into()
}
```

### JavaScript Side: Guest Bindings

The JS side provides ergonomic wrappers around `invoke()` calls:

```typescript
// Inside the plugin's NPM package (e.g., @tauri-apps/plugin-notification)
import { invoke } from '@tauri-apps/api/core';

export async function sendNotification(options: NotificationOptions): Promise<void> {
  await invoke('plugin:notification|notify', options);
}
```

The invoke command format for plugins is `plugin:{plugin-name}|{command-name}`.

### Plugin Registration

Plugins are registered in your application's entry point:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 2. Official Plugins Overview

All official plugins live in the [tauri-apps/plugins-workspace](https://github.com/tauri-apps/plugins-workspace) repository. They follow Tauri's major version numbering (2.x plugins for Tauri 2.x apps).

| Plugin | Crate Name | NPM Package | Description |
|--------|-----------|-------------|-------------|
| **Filesystem** | `tauri-plugin-fs` | `@tauri-apps/plugin-fs` | Read, write, create, delete, and watch files and directories |
| **Dialog** | `tauri-plugin-dialog` | `@tauri-apps/plugin-dialog` | Native system dialogs for open/save files and message boxes |
| **Shell** | `tauri-plugin-shell` | `@tauri-apps/plugin-shell` | Execute shell commands, open URLs/paths with default apps |
| **OS** | `tauri-plugin-os` | `@tauri-apps/plugin-os` | Query OS information (platform, arch, version, hostname, locale) |
| **Clipboard** | `tauri-plugin-clipboard-manager` | `@tauri-apps/plugin-clipboard-manager` | Read from and write to the system clipboard |
| **Notification** | `tauri-plugin-notification` | `@tauri-apps/plugin-notification` | Send native desktop/mobile notifications |
| **Global Shortcut** | `tauri-plugin-global-shortcut` | `@tauri-apps/plugin-global-shortcut` | Register system-wide keyboard shortcuts |
| **HTTP** | `tauri-plugin-http` | `@tauri-apps/plugin-http` | Make HTTP requests via a Rust-backed fetch API |
| **Process** | `tauri-plugin-process` | `@tauri-apps/plugin-process` | Query and manage the current process (exit, restart) |
| **Updater** | `tauri-plugin-updater` | `@tauri-apps/plugin-updater` | In-app self-updating with signature verification |
| **Log** | `tauri-plugin-log` | `@tauri-apps/plugin-log` | Structured logging to stdout, files, and webview console |
| **SQL** | `tauri-plugin-sql` | `@tauri-apps/plugin-sql` | Interface with SQLite, MySQL, and PostgreSQL databases |
| **Store** | `tauri-plugin-store` | `@tauri-apps/plugin-store` | Persistent key-value storage (JSON-backed) |
| **Window State** | `tauri-plugin-window-state` | `@tauri-apps/plugin-window-state` | Save and restore window size, position, and maximized state |
| **Deep Link** | `tauri-plugin-deep-link` | `@tauri-apps/plugin-deep-link` | Register your app as a handler for custom URL protocols |
| **Autostart** | `tauri-plugin-autostart` | `@tauri-apps/plugin-autostart` | Launch your app automatically at system login |
| **Barcode Scanner** | `tauri-plugin-barcode-scanner` | `@tauri-apps/plugin-barcode-scanner` | Scan QR codes and barcodes using the camera (mobile) |
| **Biometric** | `tauri-plugin-biometric` | `@tauri-apps/plugin-biometric` | Fingerprint/face authentication prompts (mobile) |
| **Opener** | `tauri-plugin-opener` | `@tauri-apps/plugin-opener` | Open files and URLs with their default application |

### Additional Official Plugins

| Plugin | Crate Name | Description |
|--------|-----------|-------------|
| **CLI** | `tauri-plugin-cli` | Parse CLI arguments passed to your app |
| **Single Instance** | `tauri-plugin-single-instance` | Ensure only one instance of your app runs at a time |
| **Stronghold** | `tauri-plugin-stronghold` | Encrypted, secure database (IOTA Stronghold) |
| **Upload** | `tauri-plugin-upload` | File uploads via HTTP with progress tracking |
| **WebSocket** | `tauri-plugin-websocket` | WebSocket client backed by a Rust implementation |
| **Localhost** | `tauri-plugin-localhost` | Serve your frontend from a localhost server |
| **Geolocation** | `tauri-plugin-geolocation` | Get and track device position (mobile + desktop) |
| **Haptics** | `tauri-plugin-haptics` | Haptic feedback and vibrations (mobile) |
| **NFC** | `tauri-plugin-nfc` | Read and write NFC tags (mobile) |

---

## 3. Installing and Configuring Plugins

Every plugin follows the same installation pattern with four steps.

### Step 1: Add the Rust Dependency

In your `src-tauri/` directory, add the plugin crate:

```bash
cd src-tauri
cargo add tauri-plugin-notification
```

Or manually edit `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-notification = "2"
tauri-plugin-log = "2"
tauri-plugin-http = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-store = "2"
```

Some plugins are desktop-only and should use a target filter:

```toml
[target.'cfg(any(target_os = "macos", windows, target_os = "linux"))'.dependencies]
tauri-plugin-global-shortcut = "2"
tauri-plugin-autostart = "2"
```

### Step 2: Register the Plugin in Rust

In `src-tauri/src/lib.rs` (or `main.rs`), register each plugin with `tauri::Builder`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Simple plugins use ::init()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        // Some plugins have a builder with configuration
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        // Desktop-only plugins should be gated
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_autostart::init(
                    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                    None,
                ))?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Step 3: Configure Capability Permissions

Create or edit a capability file in `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "notification:default",
    "notification:allow-is-permission-granted",
    "notification:allow-request-permission",
    "notification:allow-notify",
    "http:default",
    "http:allow-fetch",
    "log:default",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "store:default",
    "opener:default"
  ]
}
```

For HTTP requests, you must also define a scope specifying which URLs are allowed:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "http-scope",
  "description": "HTTP fetch permissions",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://api.example.com/*" },
        { "url": "https://jsonplaceholder.typicode.com/*" }
      ]
    }
  ]
}
```

### Step 4: Install the JavaScript Package

In your frontend project root:

```bash
npm install @tauri-apps/plugin-notification
npm install @tauri-apps/plugin-http
npm install @tauri-apps/plugin-log
npm install @tauri-apps/plugin-global-shortcut
npm install @tauri-apps/plugin-store
```

Now you can import and use the plugin functions in your frontend code.

---

## 4. Using Plugins - Detailed Examples

### 4.1 Notification Plugin

Send native desktop notifications with permission handling.

**Rust registration (`lib.rs`):**

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    // ...
```

**Capability permissions (`capabilities/default.json`):**

```json
{
  "permissions": [
    "notification:default",
    "notification:allow-is-permission-granted",
    "notification:allow-request-permission",
    "notification:allow-notify"
  ]
}
```

**Frontend usage (React component):**

```tsx
import { useState } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

function NotificationDemo() {
  const [status, setStatus] = useState("");

  async function notify() {
    // Check current permission state
    let granted = await isPermissionGranted();

    // Request permission if not already granted
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }

    if (granted) {
      // Send a simple notification
      sendNotification({
        title: "Download Complete",
        body: "Your file has been downloaded successfully.",
      });
      setStatus("Notification sent!");
    } else {
      setStatus("Permission denied.");
    }
  }

  async function notifyWithOptions() {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }

    if (granted) {
      sendNotification({
        title: "New Message",
        body: "You have 3 unread messages from Alice.",
        icon: "icons/message.png",
        sound: "default",
      });
    }
  }

  return (
    <div>
      <h2>Notification Plugin</h2>
      <button onClick={notify}>Send Basic Notification</button>
      <button onClick={notifyWithOptions}>Send Rich Notification</button>
      <p>{status}</p>
    </div>
  );
}

export default NotificationDemo;
```

**Sending notifications from Rust:**

```rust
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
fn send_rust_notification(app: tauri::AppHandle) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Background Task Complete")
        .body("The data sync has finished successfully.")
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

---

### 4.2 Global Shortcut Plugin

Register system-wide keyboard shortcuts that work even when your app is not focused.

**Rust registration with handler (`lib.rs`):**

```rust
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn main() {
    let ctrl_shift_s = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyS);

    tauri::Builder::default()
        .setup(move |app| {
            #[cfg(desktop)]
            {
                // Register shortcuts via the Rust builder
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_shortcuts(["ctrl+shift+d", "alt+space"])?
                        .with_handler(move |app, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                println!("Shortcut pressed: {:?}", shortcut);

                                if shortcut == &ctrl_shift_s {
                                    println!("Quick save triggered!");
                                    // Emit an event to the frontend
                                    let _ = app.emit("shortcut-triggered", "quick-save");
                                }
                            }
                        })
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Capability permissions:**

```json
{
  "permissions": [
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered"
  ]
}
```

**Frontend usage (register/unregister from JS):**

```tsx
import { useEffect, useState } from "react";
import {
  register,
  unregister,
  isRegistered,
} from "@tauri-apps/plugin-global-shortcut";

function GlobalShortcutDemo() {
  const [registered, setRegistered] = useState(false);
  const [lastShortcut, setLastShortcut] = useState("");

  async function registerShortcuts() {
    // Register a single shortcut
    await register("CommandOrControl+Shift+K", (event) => {
      if (event.state === "Pressed") {
        setLastShortcut(`${event.shortcut} pressed at ${new Date().toLocaleTimeString()}`);
        console.log("Shortcut triggered:", event.shortcut);
      }
    });

    setRegistered(true);
  }

  async function unregisterShortcuts() {
    await unregister("CommandOrControl+Shift+K");
    setRegistered(false);
    setLastShortcut("");
  }

  async function checkRegistration() {
    const result = await isRegistered("CommandOrControl+Shift+K");
    console.log("Is registered:", result);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unregister("CommandOrControl+Shift+K").catch(console.error);
    };
  }, []);

  return (
    <div>
      <h2>Global Shortcut Plugin</h2>
      <button onClick={registerShortcuts} disabled={registered}>
        Register Ctrl+Shift+K
      </button>
      <button onClick={unregisterShortcuts} disabled={!registered}>
        Unregister
      </button>
      <button onClick={checkRegistration}>Check Registration</button>
      <p>Status: {registered ? "Active" : "Inactive"}</p>
      {lastShortcut && <p>Last triggered: {lastShortcut}</p>}
    </div>
  );
}

export default GlobalShortcutDemo;
```

---

### 4.3 HTTP Plugin

Make HTTP requests from your app using a Rust-backed fetch API that bypasses CORS restrictions.

**Rust registration:**

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    // ...
```

**Capability permissions with URL scope:**

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "http:default",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://jsonplaceholder.typicode.com/*" },
        { "url": "https://api.github.com/*" }
      ]
    }
  ]
}
```

**Frontend usage:**

```tsx
import { useState } from "react";
import { fetch } from "@tauri-apps/plugin-http";

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

interface GithubRepo {
  name: string;
  description: string;
  stargazers_count: number;
}

function HttpDemo() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // GET request
  async function fetchPosts() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=5", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: Post[] = await response.json();
      setPosts(data);
    } catch (err) {
      setError(`Failed to fetch: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  // POST request
  async function createPost() {
    setLoading(true);
    try {
      const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Post from Tauri",
          body: "This post was created using the Tauri HTTP plugin.",
          userId: 1,
        }),
      });

      const newPost: Post = await response.json();
      console.log("Created post:", newPost);
      setPosts((prev) => [newPost, ...prev]);
    } catch (err) {
      setError(`Failed to create post: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  // GET with custom headers
  async function fetchGithubRepo() {
    try {
      const response = await fetch("https://api.github.com/repos/tauri-apps/tauri", {
        method: "GET",
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Tauri-App",
        },
      });

      const repo: GithubRepo = await response.json();
      console.log(`${repo.name}: ${repo.stargazers_count} stars`);
    } catch (err) {
      setError(`GitHub API error: ${err}`);
    }
  }

  return (
    <div>
      <h2>HTTP Plugin</h2>
      <button onClick={fetchPosts} disabled={loading}>Fetch Posts</button>
      <button onClick={createPost} disabled={loading}>Create Post</button>
      <button onClick={fetchGithubRepo} disabled={loading}>Fetch Tauri Repo Info</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading...</p>}
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <strong>{post.title}</strong>
            <p>{post.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HttpDemo;
```

---

### 4.4 Log Plugin

Set up structured logging across both Rust and JavaScript with configurable targets.

**Rust registration with full configuration (`lib.rs`):**

```rust
use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                // Set the minimum log level
                .level(log::LevelFilter::Debug)
                // Override level for noisy crates
                .level_for("hyper", log::LevelFilter::Warn)
                .level_for("reqwest", log::LevelFilter::Warn)
                // Configure where logs go
                .targets([
                    // Log to stdout (visible in terminal during development)
                    Target::new(TargetKind::Stdout),
                    // Log to a file in the app's log directory
                    Target::new(TargetKind::LogDir { file_name: None }),
                    // Forward logs to the webview console
                    Target::new(TargetKind::Webview),
                ])
                // Set the max file size before rotation (in bytes)
                .max_file_size(50_000 /* bytes */)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![do_something])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn do_something() -> String {
    // Use the standard `log` crate macros in Rust
    log::info!("do_something command was called");
    log::debug!("Processing request with debug details");
    log::warn!("This is a warning from Rust");
    "Done!".into()
}
```

**Add `log` crate to `Cargo.toml`:**

```toml
[dependencies]
log = "0.4"
tauri-plugin-log = "2"
```

**Capability permissions:**

```json
{
  "permissions": [
    "log:default"
  ]
}
```

**Frontend usage:**

```tsx
import { useEffect } from "react";
import {
  trace,
  debug,
  info,
  warn,
  error,
  attachConsole,
  attachLogger,
} from "@tauri-apps/plugin-log";

function LogDemo() {
  useEffect(() => {
    // Attach the webview console so Rust logs appear in browser DevTools
    let detachConsole: (() => void) | undefined;

    async function setupLogging() {
      // This forwards Rust-side logs to the browser console
      detachConsole = await attachConsole();

      // You can also attach a custom logger callback
      const detachLogger = await attachLogger(({ level, message }) => {
        console.log(`[Custom Logger] [${level}] ${message}`);
      });

      info("Logging system initialized from JavaScript");
    }

    setupLogging();

    return () => {
      detachConsole?.();
    };
  }, []);

  async function generateLogs() {
    trace("This is a trace message (most verbose)");
    debug("Debugging variable: x = 42");
    info("User clicked the generate logs button");
    warn("Memory usage is above 80%");
    error("Failed to connect to database");
  }

  return (
    <div>
      <h2>Log Plugin</h2>
      <button onClick={generateLogs}>Generate Log Messages</button>
      <p>Open your browser DevTools console to see the logs.</p>
      <p>Check the terminal and log directory for file output.</p>
    </div>
  );
}

export default LogDemo;
```

---

### 4.5 Window State Plugin

Automatically save and restore window position, size, and maximized/fullscreen state across app restarts.

**Rust registration (`lib.rs`):**

```rust
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // The plugin automatically saves/restores window state
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // Optionally, manually save state for all windows
            // app.save_window_state(StateFlags::all())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![save_state_manually])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn save_state_manually(app: tauri::AppHandle) -> Result<(), String> {
    // Save state for all windows immediately
    app.save_window_state(StateFlags::all())
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

**Capability permissions:**

```json
{
  "permissions": [
    "window-state:default"
  ]
}
```

**How it works:**

The window-state plugin works largely automatically. Once registered, it:

1. **On app start:** Reads the saved state from a JSON file in the app's config directory and restores window position, size, and maximized/fullscreen flags.
2. **On app close:** Saves the current window state to disk.

You can control which aspects of state are tracked using `StateFlags`:

```rust
use tauri_plugin_window_state::StateFlags;

// Only save position and size, not maximized/fullscreen state
tauri_plugin_window_state::Builder::default()
    .with_state_flags(StateFlags::POSITION | StateFlags::SIZE)
    .build()
```

**Frontend usage (manual save):**

```tsx
import { invoke } from "@tauri-apps/api/core";

function WindowStateDemo() {
  async function saveNow() {
    await invoke("save_state_manually");
    console.log("Window state saved!");
  }

  return (
    <div>
      <h2>Window State Plugin</h2>
      <p>
        Resize or move this window, then close and reopen the app.
        The window will appear exactly where you left it.
      </p>
      <button onClick={saveNow}>Force Save State Now</button>
    </div>
  );
}

export default WindowStateDemo;
```

---

## 5. Creating Your Own Plugin

### Scaffolding a New Plugin

Use the Tauri CLI to generate a plugin project:

```bash
# With npm
npm run tauri plugin init -- --name awesome --api

# With cargo
cargo tauri plugin init --name awesome --api
```

The `--api` flag generates the JavaScript/TypeScript bindings package alongside the Rust crate.

This creates the following structure:

```
tauri-plugin-awesome/
  |-- Cargo.toml                  # Rust crate manifest
  |-- build.rs                    # Build script (auto-generates permissions)
  |-- src/
  |   |-- lib.rs                  # Plugin entry point
  |   |-- commands.rs             # Tauri commands
  |   |-- desktop.rs              # Desktop-specific implementation
  |   |-- mobile.rs               # Mobile-specific implementation
  |   |-- models.rs               # Shared data types
  |   |-- error.rs                # Error types
  |-- permissions/                # Permission definitions
  |   |-- default.toml            # Default permission set
  |   |-- autogenerated/          # Auto-generated per-command permissions
  |-- guest-js/                   # JavaScript bindings source
  |   |-- index.ts                # Main JS API file
  |-- package.json                # NPM package for the JS bindings
  |-- android/                    # Android (Kotlin) library project (if enabled)
  |-- ios/                        # iOS (Swift) package (if enabled)
```

### Plugin Entry Point (`src/lib.rs`)

```rust
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod commands;
mod error;

pub use error::Error;
type Result<T> = std::result::Result<T, Error>;

/// Extension trait to access the plugin's API from the AppHandle.
pub trait AwesomeExt<R: Runtime> {
    fn awesome(&self) -> &Awesome<R>;
}

impl<R: Runtime, T: Manager<R>> AwesomeExt<R> for T {
    fn awesome(&self) -> &Awesome<R> {
        self.state::<Awesome<R>>().inner()
    }
}

/// The plugin's API, accessible as managed state.
pub struct Awesome<R: Runtime> {
    app: tauri::AppHandle<R>,
    config: AwesomeConfig,
}

#[derive(Default, serde::Deserialize)]
pub struct AwesomeConfig {
    pub greeting: Option<String>,
}

impl<R: Runtime> Awesome<R> {
    pub fn greet(&self, name: &str) -> String {
        let greeting = self.config.greeting.as_deref().unwrap_or("Hello");
        format!("{}, {}!", greeting, name)
    }
}

/// Initialize the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R, AwesomeConfig> {
    Builder::<R, AwesomeConfig>::new("awesome")
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_count,
            commands::increment,
        ])
        .setup(|app, api| {
            let config = api.config().clone();

            app.manage(Awesome {
                app: app.clone(),
                config,
            });

            // Initialize any state
            app.manage(commands::Counter::default());

            Ok(())
        })
        .build()
}
```

### Adding Commands (`src/commands.rs`)

```rust
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{command, AppHandle, Runtime};

use crate::AwesomeExt;

pub struct Counter {
    pub count: AtomicU32,
}

impl Default for Counter {
    fn default() -> Self {
        Self {
            count: AtomicU32::new(0),
        }
    }
}

#[command]
pub fn greet<R: Runtime>(app: AppHandle<R>, name: String) -> String {
    app.awesome().greet(&name)
}

#[command]
pub fn get_count(counter: tauri::State<'_, Counter>) -> u32 {
    counter.count.load(Ordering::Relaxed)
}

#[command]
pub fn increment(counter: tauri::State<'_, Counter>) -> u32 {
    counter.count.fetch_add(1, Ordering::Relaxed) + 1
}
```

### Error Handling (`src/error.rs`)

```rust
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Plugin error: {0}")]
    Plugin(String),
}

// Serialize the error so it can be returned from commands
impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
```

### Build Script for Permission Generation (`build.rs`)

```rust
const COMMANDS: &[&str] = &["greet", "get_count", "increment"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .global_api_script_path("./api-iife.js")
        .build();
}
```

This auto-generates `allow-greet`, `deny-greet`, `allow-get-count`, `deny-get-count`, etc. permission identifiers.

### Default Permissions (`permissions/default.toml`)

```toml
[default]
description = "Default permissions for the awesome plugin"
permissions = ["allow-greet", "allow-get-count", "allow-increment"]
```

### JavaScript Bindings (`guest-js/index.ts`)

```typescript
import { invoke } from "@tauri-apps/api/core";

/**
 * Greet someone using the plugin's greeting configuration.
 */
export async function greet(name: string): Promise<string> {
  return await invoke<string>("plugin:awesome|greet", { name });
}

/**
 * Get the current counter value.
 */
export async function getCount(): Promise<number> {
  return await invoke<number>("plugin:awesome|get_count");
}

/**
 * Increment the counter and return the new value.
 */
export async function increment(): Promise<number> {
  return await invoke<number>("plugin:awesome|increment");
}
```

### Using Your Plugin in an App

**`Cargo.toml` of the consuming app:**

```toml
[dependencies]
tauri-plugin-awesome = { path = "../tauri-plugin-awesome" }
# Or from crates.io after publishing:
# tauri-plugin-awesome = "0.1"
```

**Register it:**

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_awesome::init())
    .run(tauri::generate_context!())
    .expect("error");
```

**Grant permissions in the app's `capabilities/default.json`:**

```json
{
  "permissions": [
    "awesome:default"
  ]
}
```

**Use from the frontend:**

```typescript
import { greet, increment, getCount } from "tauri-plugin-awesome-api";

const message = await greet("World");
const count = await increment();
```

### Publishing Your Plugin

1. Publish the Rust crate to [crates.io](https://crates.io):
   ```bash
   cd tauri-plugin-awesome
   cargo publish
   ```

2. Publish the JS bindings to npm:
   ```bash
   cd tauri-plugin-awesome
   npm publish
   ```

3. Follow the naming convention `tauri-plugin-{name}` for the crate and `@your-scope/plugin-{name}` or `tauri-plugin-{name}-api` for the npm package.

---

## 6. Community Plugins

Beyond the official plugins, the Tauri community has built a rich ecosystem of third-party plugins.

### Notable Community Plugins

| Plugin | Description |
|--------|-------------|
| **tauri-plugin-positioner** | Position your windows at well-known screen locations (center, tray, etc.) |
| **tauri-plugin-aptabase** | Privacy-first analytics for Tauri apps |
| **tauri-plugin-spotlight** | macOS Spotlight-like search window |
| **tauri-plugin-system-info** | Access detailed device/system information |
| **tauri-plugin-oauth** | OAuth authentication flow helpers |
| **tauri-plugin-iap** | In-app purchases for Android, iOS, macOS, Windows |

### Where to Find Community Plugins

- **[awesome-tauri](https://github.com/tauri-apps/awesome-tauri):** Curated list of Tauri apps, plugins, and resources
- **[crates.io](https://crates.io/search?q=tauri-plugin):** Search for `tauri-plugin` on the Rust package registry
- **[npmjs.com](https://www.npmjs.com/search?q=tauri-plugin):** Search for `tauri-plugin` on npm
- **[Tauri Plugin Listing](https://v2.tauri.app/plugin/):** Official features and recipes page with both official and community plugins

### Evaluating Community Plugins

When choosing a community plugin, consider:

- **Tauri version compatibility:** Does it support Tauri 2.x?
- **Maintenance:** When was it last updated? Are issues being addressed?
- **Platform support:** Does it work on your target platforms (desktop, mobile)?
- **Permission model:** Does it properly integrate with Tauri's capability system?
- **Documentation:** Are there clear usage examples?

---

## 7. Capability and Permission System

Tauri 2.x introduces a fine-grained capability and permission system that controls what each window or webview can access. This is a core security feature that applies to all plugins.

### Core Concepts

- **Permission:** A named rule that allows or denies access to a specific command or scope.
- **Permission Set:** A group of permissions bundled under a single identifier (e.g., `notification:default`).
- **Capability:** A configuration object that maps permissions to specific windows/webviews.

### How Permissions Are Structured

```
Permission Identifier Format:
  {plugin-name}:{permission-name}

Examples:
  notification:allow-notify        -- Allow the notify command
  notification:deny-notify         -- Deny the notify command
  notification:default             -- The plugin's default permission set
  fs:allow-read-file               -- Allow reading files
  http:default                     -- Default HTTP permissions
```

For commands defined directly in the app (not in a plugin), the format is just `{permission-name}`.

### Capability Files

Capability files are JSON or TOML files in `src-tauri/capabilities/`. All files in this directory are automatically enabled.

**Basic capability (`capabilities/default.json`):**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "notification:default",
    "log:default",
    "store:default"
  ]
}
```

**Window-targeted capability (`capabilities/admin.json`):**

```json
{
  "identifier": "admin-capability",
  "description": "Extended permissions for admin windows",
  "windows": ["admin-*"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-file",
    "fs:allow-write-file",
    "shell:allow-execute",
    "process:default"
  ]
}
```

**Platform-specific capability (`capabilities/mobile.json`):**

```json
{
  "identifier": "mobile-capability",
  "description": "Capabilities specific to mobile platforms",
  "platforms": ["android", "iOS"],
  "windows": ["main"],
  "permissions": [
    "core:default",
    "barcode-scanner:default",
    "biometric:default",
    "haptics:default",
    "geolocation:default"
  ]
}
```

### Scope-Based Permissions

Some plugins support scoped permissions that restrict access to specific resources:

**File system scopes:**

```json
{
  "identifier": "fs-restricted",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:allow-read-file",
      "allow": [
        { "path": "$APPDATA/*" },
        { "path": "$DOWNLOAD/*" }
      ]
    },
    {
      "identifier": "fs:deny-read-file",
      "deny": [
        { "path": "$HOME/.ssh/*" }
      ]
    }
  ]
}
```

**HTTP scopes:**

```json
{
  "permissions": [
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://api.myapp.com/*" },
        { "url": "https://cdn.myapp.com/*" }
      ],
      "deny": [
        { "url": "https://api.myapp.com/admin/*" }
      ]
    }
  ]
}
```

### Writing Custom Permissions for Your Plugin

When creating your own plugin, define permissions in `permissions/default.toml`:

```toml
# permissions/default.toml
[default]
description = "Default permissions for the awesome plugin"
permissions = [
  "allow-greet",
  "allow-get-count",
]

# You can define custom permission sets
[[set]]
identifier = "allow-all"
description = "Grants access to all commands"
permissions = [
  "allow-greet",
  "allow-get-count",
  "allow-increment",
]

[[set]]
identifier = "read-only"
description = "Only allows read operations"
permissions = [
  "allow-greet",
  "allow-get-count",
]
```

You can also define scoped permissions manually:

```toml
# permissions/custom-scope.toml
[[permission]]
identifier = "allow-greet-restricted"
description = "Allow greet with scope restrictions"
commands.allow = ["greet"]

[[permission.scope.allow]]
name = "World"

[[permission.scope.allow]]
name = "Tauri"
```

### Remote Access

You can grant capabilities to remote URLs (use with caution):

```json
{
  "identifier": "remote-capability",
  "description": "Allow remote origin access to specific commands",
  "remote": {
    "urls": ["https://my-trusted-app.com/*"]
  },
  "permissions": [
    "notification:default"
  ]
}
```

### Security Best Practices

1. **Principle of Least Privilege:** Only grant the permissions each window actually needs.
2. **Separate capabilities by window:** Give admin windows more permissions than regular windows.
3. **Use scopes:** Restrict file system and HTTP access to specific paths and domains.
4. **Avoid wildcard windows:** Prefer specific window names over `"*"`.
5. **Review auto-generated permissions:** Understand what each `default` permission set includes before using it.
6. **Be cautious with remote access:** Only grant remote capabilities to trusted origins.

---

## 8. Coding Challenges

### Challenge 1: Multi-Source Notification Center

**Description:**
Build a notification management panel that can send different types of notifications and keeps a history of all sent notifications.

**Requirements:**
- Use `tauri-plugin-notification` to send desktop notifications with varying urgency levels (info, warning, critical).
- Use `tauri-plugin-store` to persist a log of all sent notifications with timestamps.
- Display the notification history in the frontend, loaded from the store on startup.
- Include a "Clear History" button that empties the store.
- Handle the permission flow gracefully, showing a status indicator of whether notifications are permitted.

**Hints:**
- Use `sendNotification({ title, body })` for each notification and simultaneously write an entry to the store.
- The store plugin's `Store.set()` and `Store.get()` methods work with any JSON-serializable data.
- Structure your store entries as an array of objects: `{ id, title, body, level, timestamp }`.

---

### Challenge 2: App-Wide Command Palette with Global Shortcuts

**Description:**
Create a command palette (similar to VS Code's Ctrl+Shift+P) that is triggered by a global shortcut and can execute various app actions.

**Requirements:**
- Use `tauri-plugin-global-shortcut` to register `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to toggle a command palette overlay.
- The palette should display a searchable list of at least 5 commands (e.g., "Toggle Dark Mode", "Open Settings", "Clear Cache", "Show About", "Quit App").
- Use `tauri-plugin-process` to implement the "Quit App" command.
- Implement fuzzy search filtering on the command list as the user types.
- The palette should close when pressing Escape or clicking outside it.

**Hints:**
- Use `CommandOrControl+Shift+P` as the shortcut string for cross-platform compatibility.
- Listen for the shortcut event and toggle a piece of React state that controls the palette overlay's visibility.
- Use `exit()` from `@tauri-apps/plugin-process` for the quit command.

---

### Challenge 3: REST API Dashboard with Logging

**Description:**
Build a REST API testing tool (like a mini Postman) that logs all requests and responses.

**Requirements:**
- Use `tauri-plugin-http` to make GET, POST, PUT, and DELETE requests to user-specified URLs.
- Let the user input a URL, select an HTTP method, and optionally provide a JSON request body and custom headers.
- Display the response status code, headers, and body.
- Use `tauri-plugin-log` to log every request and response (method, URL, status, duration) to both the console and a log file.
- Use `tauri-plugin-store` to save a list of "favorite" URLs that the user can quickly select.
- Configure the HTTP plugin's scope in capabilities to allow requests to any HTTPS URL.

**Hints:**
- The `fetch` function from `@tauri-apps/plugin-http` mirrors the standard Fetch API.
- Use `performance.now()` before and after the request to measure duration.
- Log entries with `info()` from `@tauri-apps/plugin-log` for successful requests and `error()` for failures.
- For the HTTP scope, use `{ "url": "https://**" }` to allow all HTTPS URLs.

---

### Challenge 4: Smart Window Manager

**Description:**
Build a multi-window application that remembers each window's state and provides keyboard shortcuts for window management.

**Requirements:**
- Use `tauri-plugin-window-state` to persist the position and size of all windows.
- Create at least two named windows (e.g., "main" and "settings") using the Tauri window APIs.
- Use `tauri-plugin-global-shortcut` to register shortcuts for window actions:
  - `Ctrl+1` to focus the main window
  - `Ctrl+2` to focus the settings window
  - `Ctrl+N` to create a new editor window
- Each new editor window should get a unique label (e.g., "editor-1", "editor-2").
- Use `tauri-plugin-notification` to notify the user when a new window is created.
- All window states should be restored on app restart.

**Hints:**
- Use `WebviewWindow.getByLabel()` to check if a window already exists before focusing it.
- Use `new WebviewWindow(label, options)` to create new windows dynamically.
- The window-state plugin tracks all windows automatically, including dynamically created ones.
- Keep a counter in a React ref or Rust state to generate unique window labels.

---

### Challenge 5: Build a Custom Plugin from Scratch

**Description:**
Create a custom Tauri plugin called `tauri-plugin-word-count` that provides text analysis capabilities.

**Requirements:**
- Scaffold the plugin using `cargo tauri plugin init --name word-count --api`.
- Implement the following Rust commands:
  - `count_words(text: String) -> u32` - Count words in a string.
  - `count_characters(text: String, include_spaces: bool) -> u32` - Count characters with optional space inclusion.
  - `analyze(text: String) -> TextAnalysis` - Return a struct with word count, character count, sentence count, paragraph count, and estimated reading time.
- Create JavaScript bindings in the `guest-js/` directory for all three commands.
- Define proper permissions in `permissions/default.toml` with two sets: `read-only` (only `count_words` and `count_characters`) and `allow-all` (all commands).
- Write a small demo app that uses the plugin: a textarea where the user types text and sees live analysis results.
- Bonus: add a `most_common_words(text: String, top_n: u32) -> Vec<(String, u32)>` command.

**Hints:**
- Use `text.split_whitespace().count()` for word counting in Rust.
- For sentence counting, count occurrences of `.`, `!`, and `?`.
- Estimated reading time: average reading speed is about 200-250 words per minute.
- The `TextAnalysis` struct must derive `serde::Serialize` to be returned from a command.
- Remember to list all command names in `build.rs` for permission auto-generation.
