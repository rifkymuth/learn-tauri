# Module 02: Tauri Basics

## Table of Contents

1. [What is Tauri?](#1-what-is-tauri)
2. [System Requirements](#2-system-requirements)
3. [Project Setup](#3-project-setup)
4. [Understanding tauri.conf.json](#4-understanding-tauriconfjson)
5. [The Tauri Application Lifecycle](#5-the-tauri-application-lifecycle)
6. [Running the App](#6-running-the-app)
7. [Tauri CLI](#7-tauri-cli)
8. [Understanding the Build Process](#8-understanding-the-build-process)
9. [Tauri 2.x vs 1.x](#9-tauri-2x-vs-1x)
10. [Coding Challenges](#10-coding-challenges)

---

## 1. What is Tauri?

Tauri is a framework for building lightweight, secure desktop (and mobile) applications using web technologies for the frontend and Rust for the backend. Unlike traditional web-based desktop frameworks, Tauri does not ship a bundled browser engine. Instead, it leverages the operating system's native webview, resulting in dramatically smaller binaries and lower memory usage.

### Architecture Overview

A Tauri application has two main layers:

```
┌─────────────────────────────────────────────┐
│              Your Application               │
│                                             │
│  ┌───────────────────┐  ┌────────────────┐  │
│  │  Frontend (UI)    │  │  Backend       │  │
│  │                   │  │  (Rust Core)   │  │
│  │  HTML / CSS / JS  │◄─►  Commands     │  │
│  │  React, Vue,      │  │  Plugins       │  │
│  │  Svelte, etc.     │  │  System Access │  │
│  │                   │  │                │  │
│  └───────┬───────────┘  └───────┬────────┘  │
│          │                      │           │
│  ┌───────▼──────────────────────▼────────┐  │
│  │          Tauri Runtime                │  │
│  │  ┌─────────────┐  ┌───────────────┐   │  │
│  │  │  WRY        │  │  TAO          │   │  │
│  │  │  (Webview)   │  │  (Windowing)  │   │  │
│  │  └─────────────┘  └───────────────┘   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Operating System Webview             │  │
│  │  Linux: WebKitGTK                     │  │
│  │  Windows: WebView2 (Edge/Chromium)    │  │
│  │  macOS: WKWebView (Safari/WebKit)     │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Rust Backend** — The backend is written in Rust and handles everything the frontend cannot do on its own: filesystem access, database connections, system tray management, native menus, OS-level APIs, and more. You expose Rust functions to the frontend through a mechanism called "commands."

**Webview Frontend** — The frontend is a standard web application rendered inside the OS-native webview. You can use any framework you like (React, Vue, Svelte, SolidJS, vanilla HTML/JS) or even load a remote URL.

### Key Libraries Under the Hood

**WRY (Web Rendering librarY)** is Tauri's cross-platform webview rendering library. It provides a unified API that abstracts over platform-specific webview implementations:

- On Linux, WRY uses **WebKitGTK**.
- On Windows, WRY uses **WebView2** (the Chromium-based engine that ships with modern Windows).
- On macOS, WRY uses **WKWebView** (the WebKit engine behind Safari).

**TAO** is Tauri's cross-platform windowing library (a fork of the `winit` crate). It handles window creation, event loops, menus, system tray icons, keyboard shortcuts, and other windowing concerns. TAO gives you control over window size, position, decorations, transparency, and more.

### Comparison with Electron

| Feature | Tauri | Electron |
|---|---|---|
| **Binary size** | ~2-10 MB | ~150-300 MB |
| **Memory usage** | ~20-80 MB | ~100-300+ MB |
| **Backend language** | Rust | Node.js |
| **Browser engine** | OS native webview | Bundled Chromium |
| **Security model** | Allowlist / permissions | Full Node.js access |
| **Auto-updater** | Built-in | Built-in |
| **Cross-platform** | Windows, macOS, Linux, iOS, Android | Windows, macOS, Linux |
| **Startup time** | Fast | Slower |

The key tradeoff: Electron guarantees the exact same rendering engine on every platform (Chromium), so you get pixel-perfect consistency. Tauri uses the OS webview, which means there can be minor rendering differences between platforms, but you gain massive reductions in app size and resource usage.

---

## 2. System Requirements

### All Platforms

- **Rust** — Install via [rustup](https://rustup.rs):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, verify:

```bash
rustc --version
cargo --version
```

- **Node.js** (v16 or later) and a package manager (npm, yarn, or pnpm).

### Linux

Linux requires several system libraries for WebKitGTK and the GTK development environment.

**Debian / Ubuntu:**

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Fedora:**

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

**Arch Linux:**

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  libappindicator-gtk3 \
  librsvg
```

### Windows

- **WebView2** — Ships pre-installed on Windows 10 (version 1803+) and Windows 11. For older systems, it can be downloaded from Microsoft. Tauri can also bundle the WebView2 bootstrapper with your app.
- **Microsoft Visual Studio C++ Build Tools** — Install the "Desktop development with C++" workload from the [Visual Studio Build Tools installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
- **Rust** — Install via `rustup-init.exe` from [rustup.rs](https://rustup.rs).

### macOS

- **Xcode Command Line Tools:**

```bash
xcode-select --install
```

- **Rust** — Install via rustup (same command as Linux).

macOS uses WKWebView, which is included as part of the operating system, so no additional webview installation is needed.

---

## 3. Project Setup

### Creating a New Tauri Project

The fastest way to scaffold a new Tauri project:

```bash
npm create tauri-app@latest
```

The interactive wizard will ask you:

1. **Project name** — The name of your application.
2. **Package manager** — npm, yarn, pnpm, or cargo (for a pure Rust frontend).
3. **Frontend framework** — Vanilla, React, Vue, Svelte, SolidJS, Angular, etc.
4. **Language** — JavaScript or TypeScript.

Example session:

```
$ npm create tauri-app@latest

✔ Project name · my-tauri-app
✔ Identifier · com.my-tauri-app.app
✔ Choose which language to use for your frontend · TypeScript / JavaScript
✔ Choose your package manager · npm
✔ Choose your UI template · React
✔ Choose your UI flavor · TypeScript

Template created!

To get started run:
  cd my-tauri-app
  npm install
  npm run tauri dev
```

### Project Structure Walkthrough

After scaffolding, the project looks like this:

```
my-tauri-app/
├── node_modules/
├── public/                     # Static assets for the frontend
├── src/                        # Frontend source code
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   └── ...
├── src-tauri/                  # Rust backend (Tauri core)
│   ├── Cargo.toml              # Rust dependencies and project metadata
│   ├── tauri.conf.json         # Tauri configuration file
│   ├── build.rs                # Rust build script (required by Tauri)
│   ├── icons/                  # Application icons (all sizes)
│   │   ├── icon.ico
│   │   ├── icon.png
│   │   └── ...
│   ├── capabilities/           # Permission capabilities (Tauri 2.x)
│   │   └── default.json
│   └── src/
│       ├── main.rs             # Application entry point
│       └── lib.rs              # Library root (commands, setup, etc.)
├── package.json                # Node.js project config
├── tsconfig.json               # TypeScript config
├── vite.config.ts              # Vite config (if using Vite)
└── index.html                  # Frontend entry HTML
```

Let's examine the most important files.

### `src-tauri/Cargo.toml`

This is the Rust project manifest, similar to `package.json` for Node.js.

```toml
[package]
name = "my-tauri-app"
version = "0.1.0"
description = "A Tauri App"
authors = ["Your Name"]
edition = "2021"

[lib]
name = "my_tauri_app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Key things to note:
- `tauri-build` is a build dependency used during compilation.
- `tauri` is the main framework dependency.
- `serde` and `serde_json` handle serialization between Rust and the frontend.
- The `[lib]` section with `crate-type` is important for mobile support in Tauri 2.x.

### `src-tauri/build.rs`

This is a standard Rust build script that Tauri requires:

```rust
fn main() {
    tauri_build::build()
}
```

It runs before your main code compiles and sets up the necessary Tauri build hooks.

### `src-tauri/src/main.rs`

The application entry point:

```rust
// Prevents an additional console window on Windows in release builds.
// Remove this line if you want to see console output in release mode.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Call the run function defined in lib.rs.
    my_tauri_app_lib::run()
}
```

Line-by-line breakdown:

- `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` — This is a conditional compilation attribute. In release builds (`not(debug_assertions)`), it tells Windows to run the app as a GUI application (no console window). In debug builds, the console window stays open so you can see `println!` output.
- `fn main()` — The standard Rust entry point.
- `my_tauri_app_lib::run()` — Calls the `run()` function from `lib.rs`, which is where the Tauri application is actually configured and launched.

### `src-tauri/src/lib.rs`

This is where the Tauri application is built and configured:

```rust
// A Tauri command that can be called from the frontend.
// The #[tauri::command] attribute macro transforms this function
// so it can be invoked from JavaScript.
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// The main entry point for the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Register the opener plugin (for opening URLs/files with the OS default app).
        .plugin(tauri_plugin_opener::init())
        // Register Rust functions as commands the frontend can call.
        .invoke_handler(tauri::generate_handler![greet])
        // Build and run the application.
        .run(tauri::generate_context!())
        // If the app fails to start, print the error and panic.
        .expect("error while running tauri application");
}
```

Line-by-line breakdown:

- `#[tauri::command]` — A procedural macro that wraps the function so the frontend can invoke it via `invoke("greet", { name: "World" })`.
- `#[cfg_attr(mobile, tauri::mobile_entry_point)]` — On mobile platforms, this attribute marks the function as the entry point. On desktop it has no effect.
- `tauri::Builder::default()` — Creates a new Tauri application builder with default settings. This is the start of the builder pattern.
- `.plugin(...)` — Registers a Tauri plugin. Here, `tauri_plugin_opener` provides cross-platform "open URL in browser" functionality.
- `.invoke_handler(tauri::generate_handler![greet])` — Registers the `greet` command so the frontend can call it. You list all your commands inside the macro.
- `.run(tauri::generate_context!())` — Builds and starts the application. `generate_context!()` reads `tauri.conf.json` at compile time and embeds the configuration.
- `.expect(...)` — If `.run()` returns an error, this crashes the application with the given message.

### Calling Commands from the Frontend

On the frontend side, you call Rust commands using the `@tauri-apps/api` package:

```typescript
import { invoke } from "@tauri-apps/api/core";

// Call the Rust "greet" command and get the result.
const greeting = await invoke<string>("greet", { name: "World" });
console.log(greeting); // "Hello, World! You've been greeted from Rust!"
```

The `invoke` function sends a message to the Rust backend, which executes the matching command function and returns the result. Arguments are serialized as JSON, and return values are deserialized automatically.

---

## 4. Understanding tauri.conf.json

The `tauri.conf.json` file is the central configuration file for your Tauri application. It controls everything from window appearance to security settings to build output.

Here is a comprehensive example with explanations:

```jsonc
{
  // The name used to identify your app in the Tauri build process.
  "productName": "My Tauri App",

  // The version of your application.
  "version": "0.1.0",

  // A reverse-domain-style unique identifier for your app.
  // This is used for the bundle ID on macOS/iOS and the application ID on Linux/Android.
  "identifier": "com.example.my-tauri-app",

  // Build configuration — tells Tauri how to build the frontend.
  "build": {
    // The command to run to build your frontend for production.
    "beforeBuildCommand": "npm run build",

    // The command to run to start your frontend dev server.
    "beforeDevCommand": "npm run dev",

    // Where the built frontend files live (relative to src-tauri/).
    // This is the directory Tauri embeds into the final binary.
    "frontendDist": "../dist",

    // The URL of the dev server. Tauri loads this URL in development
    // instead of serving files from frontendDist.
    "devUrl": "http://localhost:1420"
  },

  // Application-level configuration.
  "app": {
    // Window configuration — defines the main application window.
    "windows": [
      {
        // The window title shown in the title bar.
        "title": "My Tauri App",

        // Initial width and height of the window in logical pixels.
        "width": 1024,
        "height": 768,

        // Minimum window size — prevents the user from resizing below this.
        "minWidth": 400,
        "minHeight": 300,

        // Whether the window can be resized by the user.
        "resizable": true,

        // Whether the window starts in fullscreen mode.
        "fullscreen": false,

        // Whether the window is centered on screen at launch.
        "center": true,

        // Whether the window has native decorations (title bar, borders).
        // Set to false for a frameless/custom title bar look.
        "decorations": true,

        // Whether the window is always on top of other windows.
        "alwaysOnTop": false,

        // Whether the window is visible at launch.
        // Set to false to show it later (e.g., after loading is done).
        "visible": true,

        // A label to identify this window in Rust code.
        "label": "main"
      }
    ],

    // Security settings.
    "security": {
      // Content Security Policy — controls what resources the webview can load.
      "csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost; connect-src ipc: http://ipc.localhost"
    }
  },

  // Bundle configuration — controls how the final distributable is packaged.
  "bundle": {
    // Whether to create distributable bundles when running `tauri build`.
    "active": true,

    // Which bundle formats to produce.
    // Options: "deb", "rpm", "appimage", "msi", "nsis", "dmg", "app", "updater"
    "targets": "all",

    // Path to the application icon (relative to src-tauri/).
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],

    // Linux-specific bundle configuration.
    "linux": {
      "deb": {
        "depends": []
      }
    },

    // macOS-specific bundle configuration.
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.13"
    },

    // Windows-specific bundle configuration.
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    }
  }
}
```

### Important Notes on Configuration

- **`identifier`** must be unique. It follows the reverse-domain format (e.g., `com.mycompany.myapp`). On macOS it becomes the Bundle Identifier, and on Linux it determines the app's `.desktop` file name.
- **`build.frontendDist`** is the path to the compiled frontend output. For Vite projects, this is typically `../dist`. Tauri embeds these files directly into the final binary.
- **`build.devUrl`** is only used during development. Tauri loads this URL instead of the embedded files so you get hot module replacement (HMR).
- **`app.security.csp`** is your Content Security Policy. It restricts which origins can load scripts, styles, images, and other resources. This is a key part of Tauri's security model.

---

## 5. The Tauri Application Lifecycle

Understanding how a Tauri app starts, runs, and shuts down is essential. The lifecycle is managed through the `Builder` pattern, which provides hooks at every stage.

### The Builder Pattern

The `tauri::Builder` is the central API for configuring your application. You chain method calls to register plugins, commands, event handlers, and setup logic before finally calling `.run()`.

```rust
use tauri::Manager; // Provides methods like get_webview_window, emit, etc.

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // --- SETUP PHASE ---
        // Runs once after the app is initialized but before windows are created.
        // Use this for one-time initialization: database connections,
        // global state, spawning background tasks, etc.
        .setup(|app| {
            println!("App is starting up!");

            // Access the main window using the Manager trait.
            let window = app.get_webview_window("main")
                .expect("no main window found");

            // Example: set the window title programmatically.
            window.set_title("My Custom Title")?;

            // You can also resolve app paths.
            let app_data_dir = app.path().app_data_dir()?;
            println!("App data directory: {:?}", app_data_dir);

            Ok(())
        })

        // --- PLUGINS ---
        // Register plugins before the app runs.
        .plugin(tauri_plugin_opener::init())

        // --- COMMANDS ---
        // Register Rust commands that the frontend can invoke.
        .invoke_handler(tauri::generate_handler![greet])

        // --- BUILD AND RUN ---
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Lifecycle Phases in Detail

#### 1. Build Phase — `tauri::Builder::default()`

This creates the builder and prepares the internal configuration. No windows exist yet, no event loop is running. You are just declaring what the application should look like.

#### 2. Setup Phase — `.setup(|app| { ... })`

The setup closure runs **once** after the Tauri runtime is initialized. The `app` parameter (of type `&mut App`) gives you access to:

- Window management (`app.get_webview_window(...)`)
- Path resolution (`app.path()`)
- App handle for cloning and passing to other threads (`app.handle().clone()`)
- Global state

This is where you perform one-time initialization: open database connections, read config files, spawn background tasks, set up system tray icons, etc.

```rust
.setup(|app| {
    // Spawn a background task.
    let handle = app.handle().clone();
    std::thread::spawn(move || {
        // Do background work here.
        // Use `handle` to interact with the app from this thread.
        println!("Background task running...");
    });

    Ok(())
})
```

#### 3. Run Phase — `.run(tauri::generate_context!())`

This call does several things:
1. Reads the compiled configuration from `tauri.conf.json` (embedded at compile time by `generate_context!()`).
2. Creates the application windows as defined in the config.
3. Starts the native event loop.
4. Begins processing window events, IPC messages, and user input.

The `.run()` call **blocks** until the application exits.

#### 4. RunEvent Handler

You can attach a handler for run events by using `.build()` and `.run()` separately:

```rust
use tauri::RunEvent;

pub fn run() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        match event {
            // Called when all windows are closed.
            RunEvent::ExitRequested { api, .. } => {
                // Prevent the app from exiting (e.g., to keep a system tray running).
                // api.prevent_exit();
            }

            // Called just before the app exits.
            RunEvent::Exit => {
                println!("Application is exiting. Cleaning up...");
            }

            _ => {}
        }
    });
}
```

#### 5. Window Events

You can listen for events on specific windows inside the `setup` hook:

```rust
.setup(|app| {
    let window = app.get_webview_window("main").unwrap();

    // Listen for the close request event.
    window.on_window_event(|event| {
        match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                println!("User tried to close the window!");
                // You could show a confirmation dialog here.
                // Call api.prevent_close() to cancel the close.
            }
            tauri::WindowEvent::Focused(focused) => {
                println!("Window focused: {}", focused);
            }
            tauri::WindowEvent::Resized(size) => {
                println!("Window resized to: {:?}", size);
            }
            tauri::WindowEvent::Moved(position) => {
                println!("Window moved to: {:?}", position);
            }
            _ => {}
        }
    });

    Ok(())
})
```

### Summary of Lifecycle Order

```
1. Builder::default()        → Create the builder
2. .plugin(...)              → Register plugins
3. .invoke_handler(...)      → Register commands
4. .setup(|app| { ... })     → One-time initialization
5. .build(context)           → Compile config, create app instance
6. .run(|handle, event|)     → Start event loop, process events
7. RunEvent::Exit            → Application shutdown
```

---

## 6. Running the App

### Development Mode

To run your Tauri app in development mode:

```bash
# From the project root:
npm run tauri dev

# Or equivalently, using the Tauri CLI directly:
cargo tauri dev
```

What happens during `tauri dev`:

1. **Frontend dev server starts** — Tauri runs the `beforeDevCommand` from `tauri.conf.json` (e.g., `npm run dev`), which starts Vite (or your chosen build tool) with hot module replacement.
2. **Rust backend compiles** — Cargo compiles your Rust code in debug mode.
3. **Application launches** — The native window opens and loads the frontend from the dev server URL (`devUrl`).
4. **Hot reload** — When you change frontend code, the webview reloads automatically via HMR. When you change Rust code, Tauri recompiles and restarts the application.

### Opening DevTools

In development mode, you can open the webview developer tools to inspect the DOM, view console logs, debug JavaScript, and monitor network requests:

- **Right-click** anywhere in the window and select "Inspect Element" (if context menus are enabled).
- **Keyboard shortcut**: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS).
- **Programmatically** in Rust:

```rust
.setup(|app| {
    #[cfg(debug_assertions)]
    {
        let window = app.get_webview_window("main").unwrap();
        window.open_devtools();
    }
    Ok(())
})
```

The `#[cfg(debug_assertions)]` block ensures DevTools only open in debug builds, never in production.

### Production Build

To build a distributable binary:

```bash
npm run tauri build

# Or directly:
cargo tauri build
```

What happens during `tauri build`:

1. **Frontend is built** — Runs `beforeBuildCommand` (e.g., `npm run build`) to produce optimized static files.
2. **Rust is compiled in release mode** — `cargo build --release` with Tauri-specific optimizations.
3. **Assets are embedded** — The built frontend files are embedded directly into the Rust binary.
4. **Bundles are created** — Platform-specific installers are generated (`.deb`, `.AppImage` on Linux; `.msi`, `.exe` on Windows; `.dmg`, `.app` on macOS).

### Key Differences: `dev` vs `build`

| Aspect | `tauri dev` | `tauri build` |
|---|---|---|
| **Rust compilation** | Debug mode (fast compile, slow runtime) | Release mode (slow compile, fast runtime) |
| **Frontend** | Loaded from dev server (HMR) | Embedded in the binary |
| **Binary size** | Larger (debug symbols included) | Smaller (optimized, stripped) |
| **DevTools** | Available | Not available (unless explicitly enabled) |
| **Console window** | Visible on Windows | Hidden on Windows |
| **Output** | Runs the app directly | Produces installers and bundles |

### Specifying a Target Bundle

You can build only specific bundle types:

```bash
# Build only a .deb package on Linux:
cargo tauri build --bundles deb

# Build only an AppImage:
cargo tauri build --bundles appimage

# Build only an MSI installer on Windows:
cargo tauri build --bundles msi
```

---

## 7. Tauri CLI

The Tauri CLI (`@tauri-apps/cli`) provides essential commands for development, building, and project management.

### `tauri dev`

Starts the application in development mode.

```bash
cargo tauri dev

# With specific features enabled:
cargo tauri dev --features custom-protocol

# Target a specific runner (useful for mobile):
cargo tauri dev --target aarch64-apple-ios
```

### `tauri build`

Builds the application for production and creates distributable bundles.

```bash
cargo tauri build

# Build with a specific target triple:
cargo tauri build --target x86_64-unknown-linux-gnu

# Build specific bundle formats only:
cargo tauri build --bundles deb,appimage

# Skip bundling entirely (just compile the binary):
cargo tauri build --no-bundle

# Build in debug mode (faster compilation, debug symbols):
cargo tauri build --debug
```

### `tauri info`

Prints diagnostic information about your development environment. This is extremely useful when troubleshooting build issues.

```bash
cargo tauri info
```

Example output:

```
Environment
  › OS: Ubuntu 22.04 X64
  › Webview2: N/A
  › Node.js: v20.11.0
  › npm: 10.2.0
  › rustup: 1.27.0
  › rustc: 1.76.0
  › cargo: 1.76.0
  › Rust toolchain: stable-x86_64-unknown-linux-gnu

Packages
  › @tauri-apps/cli: 2.0.0
  › @tauri-apps/api: 2.0.0
  › tauri: 2.0.0

App
  › build.frontendDist: ../dist
  › build.devUrl: http://localhost:1420
  › bundle.identifier: com.example.my-tauri-app
```

### `tauri init`

Initializes a new Tauri project in an existing frontend project. This adds the `src-tauri/` directory with all the necessary Rust boilerplate.

```bash
cargo tauri init
```

It will prompt you for:
- Your application name
- The window title
- The path to your frontend dist files
- The dev server URL

Use this when you have an existing web application and want to wrap it in Tauri.

### `tauri icon`

Generates all the icon sizes your app needs from a single source image.

```bash
# Generate icons from a single source PNG (should be at least 1024x1024):
cargo tauri icon path/to/icon.png

# Specify an output directory:
cargo tauri icon --output src-tauri/icons path/to/icon.png
```

This produces `.ico`, `.icns`, and multiple `.png` files in all the sizes needed for various platforms.

### `tauri completions`

Generates shell completion scripts:

```bash
# Generate completions for bash:
cargo tauri completions --shell bash

# For zsh:
cargo tauri completions --shell zsh

# For fish:
cargo tauri completions --shell fish
```

### `tauri plugin`

Manage Tauri plugins:

```bash
# Add a plugin to your project:
cargo tauri plugin add store

# This automatically:
#   1. Adds the Rust crate to Cargo.toml
#   2. Adds the npm package to package.json
#   3. Sets up default permissions in capabilities
```

---

## 8. Understanding the Build Process

When you run `cargo tauri build`, a multi-stage process takes place. Understanding each stage helps you debug build failures and optimize your application.

### Stage 1: Frontend Build

Tauri runs the command specified in `build.beforeBuildCommand` (e.g., `npm run build`).

```
beforeBuildCommand: "npm run build"
         │
         ▼
┌──────────────────────────┐
│  Vite / Webpack / etc.   │
│                          │
│  TypeScript → JavaScript │
│  SCSS → CSS              │
│  Images optimized        │
│  Code split / minified   │
└────────────┬─────────────┘
             │
             ▼
      dist/ directory
      ├── index.html
      ├── assets/
      │   ├── index-abc123.js
      │   └── index-def456.css
      └── ...
```

### Stage 2: Rust Compilation

The Tauri build script (`build.rs`) runs first, then Cargo compiles your Rust source code in release mode.

```
build.rs runs
    │
    ├── Processes tauri.conf.json
    ├── Generates Rust code for configuration
    └── Embeds frontend assets into the binary
         │
         ▼
cargo build --release
    │
    ├── Compiles all dependencies (first time takes a while)
    ├── Compiles your Rust source code
    ├── Links everything together
    └── Produces a single native binary
```

Key optimization flags that Tauri sets in release mode:
- LTO (Link Time Optimization) — reduces binary size
- Code stripping — removes debug symbols
- Optimization level 3 — maximum runtime performance

You can customize these in your `Cargo.toml`:

```toml
[profile.release]
panic = "abort"     # Smaller binary, no stack unwinding
codegen-units = 1   # Better optimization, slower compilation
lto = true          # Link Time Optimization
opt-level = "s"     # Optimize for size instead of speed
strip = true        # Strip debug symbols
```

### Stage 3: Bundling

After the binary is compiled, Tauri packages it into platform-specific distributable formats.

```
Release binary
    │
    ├─── Linux ──────────────────┐
    │    ├── .deb package        │
    │    ├── .rpm package        │
    │    └── .AppImage           │
    │                            │
    ├─── Windows ────────────────┤
    │    ├── .msi installer      │
    │    └── .exe (NSIS)         │
    │                            │
    └─── macOS ──────────────────┤
         ├── .app bundle         │
         └── .dmg disk image     │
```

The bundled output is placed in:

```
src-tauri/target/release/bundle/
├── deb/
│   └── my-tauri-app_0.1.0_amd64.deb
├── appimage/
│   └── my-tauri-app_0.1.0_amd64.AppImage
└── ...
```

### Build Artifacts Location

```
src-tauri/target/
├── debug/                    # Debug builds (tauri dev)
│   └── my-tauri-app          # Debug binary
├── release/                  # Release builds (tauri build)
│   ├── my-tauri-app          # Release binary
│   └── bundle/               # Platform-specific installers
└── ...
```

### Speeding Up Builds

Rust compilation can be slow, especially for the first build. Here are some tips:

1. **Use `sccache`** — A shared compilation cache:

```bash
cargo install sccache
export RUSTC_WRAPPER=sccache
```

2. **Use the `lld` or `mold` linker** — Much faster than the default linker. Add to `.cargo/config.toml`:

```toml
[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=lld"]
```

3. **Only build the binary during development** (no bundling):

```bash
cargo tauri build --no-bundle
```

---

## 9. Tauri 2.x vs 1.x

Tauri 2.0 was a major release that introduced significant changes. If you are starting fresh, use Tauri 2.x. If you are maintaining a Tauri 1.x project, here is what changed.

### Key Differences

| Feature | Tauri 1.x | Tauri 2.x |
|---|---|---|
| **Mobile support** | Not available | iOS and Android |
| **Plugin system** | Basic, tightly coupled | New plugin architecture with permissions |
| **Security model** | Allowlist in `tauri.conf.json` | Capabilities and permissions system |
| **IPC** | Single webview | Multi-webview support |
| **JS API package** | `@tauri-apps/api` (monolithic) | `@tauri-apps/api` + per-plugin packages |
| **Config file** | `tauri.conf.json` (flat) | `tauri.conf.json` (restructured) |
| **Entry point** | `main.rs` only | `main.rs` + `lib.rs` (for mobile compatibility) |

### New Plugin System

In Tauri 1.x, many features were built into the core and toggled via an allowlist:

```json
// Tauri 1.x — allowlist in tauri.conf.json
{
  "tauri": {
    "allowlist": {
      "fs": {
        "readFile": true,
        "writeFile": true,
        "scope": ["$APP/*"]
      },
      "dialog": {
        "open": true,
        "save": true
      }
    }
  }
}
```

In Tauri 2.x, these features are extracted into separate plugins. You install only what you need:

```bash
# Adding the filesystem plugin in Tauri 2.x:
cargo tauri plugin add fs

# This adds:
#   Rust:  tauri-plugin-fs to Cargo.toml
#   JS:    @tauri-apps/plugin-fs to package.json
#   Perms: fs permissions to capabilities/default.json
```

Then register it in Rust:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

And use it in the frontend:

```typescript
// Tauri 2.x — import from the plugin package
import { readTextFile } from "@tauri-apps/plugin-fs";

const contents = await readTextFile("path/to/file.txt");
```

### Capabilities and Permissions

The allowlist system from 1.x is replaced by a more granular **capabilities** system. Capabilities are defined in JSON files inside `src-tauri/capabilities/`.

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "description": "Default capabilities for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    {
      "identifier": "fs:scope",
      "allow": [
        "$APPDATA/**",
        "$RESOURCE/**"
      ]
    },
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

Key concepts:
- **Capabilities** group permissions and assign them to specific windows.
- **Permissions** are fine-grained access controls defined by each plugin.
- **Scopes** restrict file system and other path-based permissions to specific directories.

This system provides better security because each window can have different permissions, and you can see at a glance exactly what your application is allowed to do.

### Mobile Support

Tauri 2.x supports building for iOS and Android. The `lib.rs` entry point and the `#[cfg_attr(mobile, tauri::mobile_entry_point)]` attribute exist specifically for this.

```bash
# Initialize mobile support:
cargo tauri android init
cargo tauri ios init

# Run on mobile devices/simulators:
cargo tauri android dev
cargo tauri ios dev

# Build for mobile:
cargo tauri android build
cargo tauri ios build
```

The project structure gains additional directories:

```
my-tauri-app/
├── src-tauri/
│   ├── gen/
│   │   ├── android/    # Generated Android project (Kotlin/Gradle)
│   │   └── apple/      # Generated Xcode project (Swift)
│   └── ...
└── ...
```

### Configuration Structure Changes

The config file was restructured in 2.x. Here is a side-by-side comparison:

```jsonc
// Tauri 1.x
{
  "tauri": {
    "windows": [{ "title": "My App", "width": 800 }],
    "security": { "csp": "..." },
    "bundle": { "identifier": "com.example.app" }
  },
  "build": {
    "distDir": "../dist",
    "devPath": "http://localhost:1420"
  }
}

// Tauri 2.x
{
  "identifier": "com.example.app",
  "app": {
    "windows": [{ "title": "My App", "width": 800 }],
    "security": { "csp": "..." }
  },
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420"
  },
  "bundle": { ... }
}
```

Notable renames:
- `build.distDir` became `build.frontendDist`
- `build.devPath` became `build.devUrl`
- `tauri.bundle.identifier` moved to top-level `identifier`
- The nested `tauri` key is replaced by `app`

---

## 10. Coding Challenges

### Challenge 1: Custom Window Configuration

**Description:** Create a new Tauri project and customize the main window to have specific dimensions, a custom title, and no decorations (frameless window). Then add a draggable region using HTML/CSS so the user can still move the window.

**Requirements:**
- Set the window size to 600x400 pixels.
- Disable window decorations (frameless).
- Set a minimum size of 400x300.
- Center the window on launch.
- Add a custom "title bar" div at the top of your HTML that acts as a drag region using the Tauri `data-tauri-drag-region` attribute.
- Include a close button in your custom title bar that calls `getCurrentWindow().close()`.

**Hints:**
- Set `"decorations": false` in the window config inside `tauri.conf.json`.
- Use the `data-tauri-drag-region` HTML attribute on a div to make it draggable.
- Import `getCurrentWindow` from `@tauri-apps/api/window` to control the window from JavaScript.
- Style your custom title bar with `position: fixed; top: 0; width: 100%;` and give it a height and background color.

---

### Challenge 2: Multi-Command Calculator

**Description:** Build a Tauri app that works as a simple calculator. Implement all four arithmetic operations as separate Tauri commands in Rust, and call them from a web-based UI.

**Requirements:**
- Create four Tauri commands: `add`, `subtract`, `multiply`, `divide`.
- Each command takes two `f64` parameters and returns an `f64` (or a `Result` for division).
- The `divide` command should return an error message if the divisor is zero.
- Build a simple HTML/CSS frontend with two input fields, four operation buttons, and a result display.
- Register all commands in the invoke handler.

**Hints:**
- For error handling in the `divide` command, return a `Result<f64, String>`:
  ```rust
  #[tauri::command]
  fn divide(a: f64, b: f64) -> Result<f64, String> {
      if b == 0.0 {
          Err("Cannot divide by zero".to_string())
      } else {
          Ok(a / b)
      }
  }
  ```
- Register all commands together: `tauri::generate_handler![add, subtract, multiply, divide]`.
- On the frontend, use `invoke("add", { a: 5, b: 3 })` and handle the result with `.then()` or `await`.

---

### Challenge 3: System Information Dashboard

**Description:** Create a Tauri app that displays system information. Use Rust to gather data about the system (OS name, architecture, hostname) and display it in a styled dashboard on the frontend.

**Requirements:**
- Create a `get_system_info` command that returns a struct with at least: OS name, architecture, hostname, and the number of logical CPU cores.
- Use `serde::Serialize` to make the struct serializable so it can be returned to the frontend.
- Display the information in a visually organized dashboard using HTML and CSS.
- Add a "Refresh" button that re-invokes the command and updates the display.
- Show the Tauri app version (from `tauri.conf.json`) somewhere on the page.

**Hints:**
- Use the `std::env::consts` module for OS and architecture:
  ```rust
  use serde::Serialize;

  #[derive(Serialize)]
  struct SystemInfo {
      os: String,
      arch: String,
      hostname: String,
      cpu_cores: usize,
  }
  ```
- For hostname, consider using the `hostname` crate or `std::process::Command` to run `hostname`.
- For CPU core count, use `std::thread::available_parallelism()`.
- On the frontend, parse the returned object: `const info = await invoke<SystemInfo>("get_system_info");`.
- To get the app version on the frontend, use `import { getVersion } from "@tauri-apps/api/app";`.

---

### Challenge 4: Window Event Logger

**Description:** Build a Tauri app that logs window events to the UI in real time. Every time the window is moved, resized, focused, or unfocused, display a new entry in a scrollable log panel in the webview.

**Requirements:**
- In the Rust `setup` hook, listen for window events: `Moved`, `Resized`, `Focused`, and `CloseRequested`.
- When each event occurs, emit a Tauri event to the frontend with the event details.
- On the frontend, listen for these custom events and append a timestamped log entry to a visible log panel.
- For `CloseRequested`, show a confirmation dialog (using JavaScript `confirm()`) before allowing the window to close.
- Style the log panel so it auto-scrolls to the latest entry.

**Hints:**
- Use `window.emit("event-name", payload)` from the Rust side to send events to the frontend.
- On the frontend, use `listen("event-name", callback)` from `@tauri-apps/api/event`.
- For the close confirmation, use `api.prevent_close()` in Rust and emit an event so the frontend can show a dialog, then call `getCurrentWindow().close()` from JS if the user confirms.
- Example emit from Rust:
  ```rust
  window.emit("window-moved", serde_json::json!({ "x": position.x, "y": position.y }))?;
  ```

---

### Challenge 5: Themed Application with State Persistence

**Description:** Build a Tauri application that supports light and dark themes. The theme preference should persist across app restarts using the Tauri `store` plugin (or by reading/writing a JSON file from Rust).

**Requirements:**
- Create a toggle button that switches between light and dark themes.
- The theme should change the background color, text color, and button styles across the entire application.
- Save the user's theme preference so it persists after the app is closed and reopened.
- Create a Tauri command `save_preference` that writes the theme choice to a JSON file in the app data directory.
- Create a Tauri command `load_preference` that reads the saved preference on startup.
- If no saved preference exists, default to light theme.

**Hints:**
- Use `app.path().app_data_dir()` to get a safe, OS-appropriate directory for storing data.
- Use `std::fs::write` and `std::fs::read_to_string` for file I/O in Rust.
- Structure your preferences file as JSON: `{ "theme": "dark" }`.
- Use `serde_json` for parsing and serializing the preferences.
- On the frontend, call `load_preference` during initialization and apply the CSS class before the page renders to prevent a flash of the wrong theme.
- Alternatively, install the `tauri-plugin-store` plugin which provides a key-value store out of the box:
  ```bash
  cargo tauri plugin add store
  ```
