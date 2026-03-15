# Module 5: Window Management and System Tray in Tauri 2.x

## Table of Contents

1. [Window Configuration](#1-window-configuration)
2. [Window API from Frontend](#2-window-api-from-frontend)
3. [Creating Multiple Windows](#3-creating-multiple-windows)
4. [Window Events](#4-window-events)
5. [Custom Titlebar](#5-custom-titlebar)
6. [Splashscreen Pattern](#6-splashscreen-pattern)
7. [System Tray](#7-system-tray)
8. [Window Communication](#8-window-communication)
9. [Frameless and Transparent Windows](#9-frameless-and-transparent-windows)
10. [Coding Challenges](#10-coding-challenges)

---

## 1. Window Configuration

Tauri 2.x configures windows through the `app.windows` array in `tauri.conf.json`. Each entry defines a window that can be created at startup or later at runtime.

### Basic Window Configuration

```jsonc
// src-tauri/tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "My Tauri App",
        "width": 1024,
        "height": 768,
        "minWidth": 640,
        "minHeight": 480,
        "maxWidth": 1920,
        "maxHeight": 1080,
        "resizable": true,
        "fullscreen": false,
        "center": true
      }
    ]
  }
}
```

### Complete Window Configuration Reference

```jsonc
// src-tauri/tauri.conf.json
{
  "app": {
    "windows": [
      {
        // Identity
        "label": "main",           // Unique identifier (default: "main")
        "title": "My App",         // Window title bar text
        "url": "index.html",       // URL or path to load (default: "index.html")

        // Dimensions
        "width": 800,              // Initial width in logical pixels
        "height": 600,             // Initial height in logical pixels
        "minWidth": 400,           // Minimum width constraint
        "minHeight": 300,          // Minimum height constraint
        "maxWidth": 1920,          // Maximum width constraint
        "maxHeight": 1080,         // Maximum height constraint

        // Position
        "x": 100,                  // Initial x position (omit to let OS decide)
        "y": 100,                  // Initial y position (omit to let OS decide)
        "center": true,            // Center window on screen at startup

        // Appearance
        "decorations": true,       // Show native title bar and borders
        "transparent": false,      // Enable transparent background
        "shadow": true,            // Show window shadow
        "fullscreen": false,       // Start in fullscreen mode
        "maximized": false,        // Start maximized
        "visible": true,           // Show window at startup
        "titleBarStyle": "Visible",// macOS: "Visible", "Transparent", "Overlay"

        // Behavior
        "resizable": true,         // Allow resizing
        "closable": true,          // Show close button
        "minimizable": true,       // Show minimize button
        "maximizable": true,       // Show maximize button
        "alwaysOnTop": false,      // Float above other windows
        "alwaysOnBottom": false,   // Stay behind other windows
        "contentProtected": false, // Prevent screen capture
        "skipTaskbar": false,      // Hide from taskbar
        "focused": true,           // Focus window at creation
        "dragDropEnabled": true,   // Enable file drag and drop

        // Startup
        "create": true             // Create at app startup (false = manual creation)
      }
    ]
  }
}
```

### Platform-Specific Configuration

Tauri supports platform-specific overrides through separate config files that are merged with the main config:

- `tauri.linux.conf.json`
- `tauri.windows.conf.json`
- `tauri.macos.conf.json`

```jsonc
// src-tauri/tauri.macos.conf.json
{
  "app": {
    "windows": [
      {
        "titleBarStyle": "Overlay",
        "hiddenTitle": true
      }
    ]
  }
}
```

---

## 2. Window API from Frontend

The `@tauri-apps/api/window` module provides full control over the current window from your frontend code.

### Required Permissions

Before using window APIs, you must grant permissions in your capabilities file:

```jsonc
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-unmaximize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-set-fullscreen",
    "core:window:allow-set-focus",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-set-title",
    "core:window:allow-center",
    "core:window:allow-is-maximized",
    "core:window:allow-is-minimized",
    "core:window:allow-is-fullscreen",
    "core:window:allow-start-dragging",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-decorations",
    "core:window:allow-set-resizable",
    "core:window:allow-destroy"
  ]
}
```

### Getting the Current Window

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

// Get a reference to the current window
const appWindow = getCurrentWindow();

// The window label (unique identifier)
console.log('Window label:', appWindow.label);
```

### Basic Window Operations

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

// --- Minimize / Maximize / Close ---
await appWindow.minimize();
await appWindow.maximize();
await appWindow.unmaximize();
await appWindow.toggleMaximize(); // toggle between maximized and restored
await appWindow.close();          // emits close-requested event
await appWindow.destroy();        // force close, no event emitted

// --- Query State ---
const isMaximized = await appWindow.isMaximized();
const isMinimized = await appWindow.isMinimized();
const isFullscreen = await appWindow.isFullscreen();
const isVisible = await appWindow.isVisible();
const isFocused = await appWindow.isFocused();

// --- Fullscreen ---
await appWindow.setFullscreen(true);
await appWindow.setFullscreen(false);

// --- Always on Top ---
await appWindow.setAlwaysOnTop(true);

// --- Window Title ---
await appWindow.setTitle('New Title');

// --- Size and Position ---
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi';

await appWindow.setSize(new LogicalSize(1024, 768));
await appWindow.setPosition(new LogicalPosition(200, 100));
await appWindow.center();

// --- Min/Max Size Constraints ---
await appWindow.setMinSize(new LogicalSize(400, 300));
await appWindow.setMaxSize(new LogicalSize(1920, 1080));

// --- Visibility ---
await appWindow.show();
await appWindow.hide();

// --- Focus ---
await appWindow.setFocus();

// --- Decorations ---
await appWindow.setDecorations(false); // remove native title bar at runtime

// --- Resizable ---
await appWindow.setResizable(false);
```

### React Component: Window Controls

```tsx
// src/components/WindowControls.tsx
import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function WindowControls() {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

  useEffect(() => {
    // Query initial states
    const checkState = async () => {
      setIsMaximized(await appWindow.isMaximized());
      setIsFullscreen(await appWindow.isFullscreen());
    };
    checkState();
  }, []);

  const handleMinimize = () => appWindow.minimize();

  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };

  const handleClose = () => appWindow.close();

  const handleFullscreen = async () => {
    const newState = !isFullscreen;
    await appWindow.setFullscreen(newState);
    setIsFullscreen(newState);
  };

  const handleAlwaysOnTop = async () => {
    const newState = !isAlwaysOnTop;
    await appWindow.setAlwaysOnTop(newState);
    setIsAlwaysOnTop(newState);
  };

  return (
    <div className="window-controls">
      <button onClick={handleMinimize} title="Minimize">
        &#x2014;
      </button>
      <button onClick={handleMaximize} title="Maximize">
        {isMaximized ? '\u29C9' : '\u25A1'}
      </button>
      <button onClick={handleClose} title="Close">
        &#x2715;
      </button>
      <button onClick={handleFullscreen} title="Toggle Fullscreen">
        {isFullscreen ? 'Exit FS' : 'Fullscreen'}
      </button>
      <button onClick={handleAlwaysOnTop} title="Toggle Always on Top">
        {isAlwaysOnTop ? 'Unpin' : 'Pin'}
      </button>
    </div>
  );
}
```

---

## 3. Creating Multiple Windows

Tauri 2.x supports multiple windows, each identified by a unique label. You can create windows statically through configuration or dynamically from both Rust and the frontend.

### Static Configuration (Multiple Windows)

```jsonc
// src-tauri/tauri.conf.json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Main Window",
        "width": 1024,
        "height": 768,
        "url": "index.html"
      },
      {
        "label": "settings",
        "title": "Settings",
        "width": 600,
        "height": 400,
        "url": "/settings",
        "center": true,
        "resizable": false,
        "create": false
      }
    ]
  }
}
```

Setting `"create": false` means the window will not be created at startup. You can create it later using `WebviewWindowBuilder::from_config` in Rust or `new WebviewWindow()` from the frontend.

### Creating Windows from Rust

```rust
// src-tauri/src/lib.rs
use tauri::{
    webview::{WebviewWindowBuilder, WebviewUrl},
    Manager,
};

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    // Check if the window already exists
    if let Some(window) = app.get_webview_window("settings") {
        // Focus existing window instead of creating a new one
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create a new window
    WebviewWindowBuilder::new(
        &app,
        "settings",                        // unique label
        WebviewUrl::App("/settings".into()) // URL to load
    )
    .title("Settings")
    .inner_size(600.0, 400.0)
    .center()
    .resizable(false)
    .minimizable(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn open_about_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("about") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "about",
        WebviewUrl::App("/about".into()),
    )
    .title("About")
    .inner_size(400.0, 300.0)
    .center()
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .decorations(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

// Register commands
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_settings_window,
            open_about_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

> **Important:** On Windows, `WebviewWindowBuilder::new(...).build()` deadlocks when used in a synchronous command. Always use `async` commands or spawn a separate thread when creating windows.

### Creating Windows from Rust Using Config

If you defined a window in `tauri.conf.json` with `"create": false`, you can recreate it from its config:

```rust
use tauri::{webview::WebviewWindowBuilder, Manager};

#[tauri::command]
async fn open_settings_from_config(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Find the window config by label
    let config = app.config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "settings")
        .cloned()
        .ok_or("Settings window config not found")?;

    WebviewWindowBuilder::from_config(&app, &config)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

### Creating Windows from Frontend (TypeScript)

First, add the required permission:

```jsonc
// src-tauri/capabilities/default.json
{
  "permissions": [
    "core:webview:allow-create-webview-window"
  ]
}
```

Then create windows from your frontend code:

```typescript
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// Create a new window
async function openSettingsWindow() {
  // Check if window already exists
  const existing = await WebviewWindow.getByLabel('settings');
  if (existing) {
    await existing.setFocus();
    return;
  }

  const settingsWindow = new WebviewWindow('settings', {
    url: '/settings',
    title: 'Settings',
    width: 600,
    height: 400,
    center: true,
    resizable: false,
  });

  // Listen for the window to be created
  settingsWindow.once('tauri://created', () => {
    console.log('Settings window created');
  });

  // Handle creation errors
  settingsWindow.once('tauri://error', (e) => {
    console.error('Failed to create settings window:', e);
  });
}
```

### React Component: Window Manager

```tsx
// src/components/WindowManager.tsx
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';

interface WindowConfig {
  label: string;
  url: string;
  title: string;
  width: number;
  height: number;
}

const WINDOW_CONFIGS: WindowConfig[] = [
  { label: 'settings', url: '/settings', title: 'Settings', width: 600, height: 400 },
  { label: 'about', url: '/about', title: 'About', width: 400, height: 300 },
  { label: 'logs', url: '/logs', title: 'Log Viewer', width: 800, height: 500 },
];

export function WindowManager() {
  const openWindow = async (config: WindowConfig) => {
    const existing = await WebviewWindow.getByLabel(config.label);
    if (existing) {
      await existing.setFocus();
      return;
    }

    new WebviewWindow(config.label, {
      url: config.url,
      title: config.title,
      width: config.width,
      height: config.height,
      center: true,
    });
  };

  const closeAllSecondary = async () => {
    for (const config of WINDOW_CONFIGS) {
      const win = await WebviewWindow.getByLabel(config.label);
      if (win) {
        await win.close();
      }
    }
  };

  return (
    <div className="window-manager">
      <h3>Windows</h3>
      {WINDOW_CONFIGS.map((config) => (
        <button key={config.label} onClick={() => openWindow(config)}>
          Open {config.title}
        </button>
      ))}
      <button onClick={closeAllSecondary}>Close All</button>
    </div>
  );
}
```

---

## 4. Window Events

Tauri provides a rich event system for reacting to window state changes. You can listen for events from both the frontend and the Rust backend.

### Frontend: Listening to Window Events

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

// --- Close Requested ---
// This fires when the user clicks the close button or calls .close()
// You can prevent the close by NOT calling e.preventDefault()
const unlistenClose = await appWindow.onCloseRequested(async (event) => {
  const confirmed = await confirm('Are you sure you want to close?');
  if (!confirmed) {
    event.preventDefault(); // Prevents the window from closing
  }
});

// --- Moved ---
const unlistenMove = await appWindow.onMoved(({ payload: position }) => {
  console.log(`Window moved to: ${position.x}, ${position.y}`);
});

// --- Resized ---
const unlistenResize = await appWindow.onResized(({ payload: size }) => {
  console.log(`Window resized to: ${size.width}x${size.height}`);
});

// --- Focus / Blur ---
const unlistenFocus = await appWindow.onFocusChanged(({ payload: focused }) => {
  console.log(`Window ${focused ? 'focused' : 'blurred'}`);
});

// --- Scale Factor Changed ---
const unlistenScale = await appWindow.onScaleChanged(({ payload }) => {
  console.log(`Scale factor: ${payload.scaleFactor}`);
  console.log(`New size: ${payload.size.width}x${payload.size.height}`);
});

// --- Theme Changed ---
const unlistenTheme = await appWindow.onThemeChanged(({ payload: theme }) => {
  console.log(`Theme changed to: ${theme}`);
});

// Clean up listeners when done
// unlistenClose();
// unlistenMove();
// unlistenResize();
// unlistenFocus();
```

### React Hook: Window Event Listeners

```tsx
// src/hooks/useWindowEvents.ts
import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { PhysicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';

interface WindowState {
  size: { width: number; height: number };
  position: { x: number; y: number };
  isFocused: boolean;
  isMaximized: boolean;
}

export function useWindowEvents() {
  const [windowState, setWindowState] = useState<WindowState>({
    size: { width: 0, height: 0 },
    position: { x: 0, y: 0 },
    isFocused: true,
    isMaximized: false,
  });

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      // Initialize with current state
      const size = await appWindow.innerSize();
      const position = await appWindow.outerPosition();
      const isMaximized = await appWindow.isMaximized();

      setWindowState({
        size: { width: size.width, height: size.height },
        position: { x: position.x, y: position.y },
        isFocused: true,
        isMaximized,
      });

      // Listen for changes
      unlisteners.push(
        await appWindow.onResized(({ payload }) => {
          setWindowState((prev) => ({
            ...prev,
            size: { width: payload.width, height: payload.height },
          }));
        })
      );

      unlisteners.push(
        await appWindow.onMoved(({ payload }) => {
          setWindowState((prev) => ({
            ...prev,
            position: { x: payload.x, y: payload.y },
          }));
        })
      );

      unlisteners.push(
        await appWindow.onFocusChanged(({ payload: focused }) => {
          setWindowState((prev) => ({ ...prev, isFocused: focused }));
        })
      );
    };

    setup();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  return windowState;
}
```

### Preventing Window Close (Unsaved Changes Pattern)

```tsx
// src/hooks/useUnsavedChanges.ts
import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useUnsavedChanges(hasChanges: boolean) {
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await appWindow.onCloseRequested(async (event) => {
        if (hasChangesRef.current) {
          // Show a native confirmation dialog
          const { ask } = await import('@tauri-apps/plugin-dialog');
          const confirmed = await ask(
            'You have unsaved changes. Are you sure you want to close?',
            {
              title: 'Unsaved Changes',
              kind: 'warning',
            }
          );

          if (!confirmed) {
            event.preventDefault();
          }
        }
      });
    };

    setup();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);
}

// Usage in a component:
// function Editor() {
//   const [hasChanges, setHasChanges] = useState(false);
//   useUnsavedChanges(hasChanges);
//   ...
// }
```

### Rust: Listening to Window Events

```rust
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let main_window = app.get_webview_window("main")
                .expect("main window not found");

            // Listen for close requested
            main_window.on_window_event(|event| {
                match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        println!("Close requested!");
                        // Optionally prevent close:
                        // api.prevent_close();
                    }
                    tauri::WindowEvent::Focused(focused) => {
                        println!("Window focused: {}", focused);
                    }
                    tauri::WindowEvent::Resized(size) => {
                        println!("Resized to {}x{}", size.width, size.height);
                    }
                    tauri::WindowEvent::Moved(position) => {
                        println!("Moved to ({}, {})", position.x, position.y);
                    }
                    tauri::WindowEvent::Destroyed => {
                        println!("Window destroyed");
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

---

## 5. Custom Titlebar

A custom titlebar gives you full control over the look and feel of the window chrome. This is achieved by disabling native decorations and building the titlebar in your frontend.

### Step 1: Disable Decorations

```jsonc
// src-tauri/tauri.conf.json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "decorations": false,
        "width": 1024,
        "height": 768
      }
    ]
  }
}
```

### Step 2: Add Required Permissions

```jsonc
// src-tauri/capabilities/default.json
{
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-is-maximized",
    "core:window:allow-start-dragging"
  ]
}
```

### Step 3: Build the Custom Titlebar Component

```tsx
// src/components/Titlebar.tsx
import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './Titlebar.css';

export function Titlebar() {
  const appWindow = getCurrentWindow();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      setMaximized(await appWindow.isMaximized());
    };
    checkMaximized();

    // Update state when window is resized (which includes maximize/restore)
    let unlisten: (() => void) | undefined;
    appWindow.onResized(async () => {
      setMaximized(await appWindow.isMaximized());
    }).then((fn) => { unlisten = fn; });

    return () => { if (unlisten) unlisten(); };
  }, []);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-icon" data-tauri-drag-region>
        <img src="/app-icon.png" alt="" width={16} height={16} />
      </div>

      <div className="titlebar-title" data-tauri-drag-region>
        My Application
      </div>

      <div className="titlebar-spacer" data-tauri-drag-region />

      <div className="titlebar-buttons">
        <button
          className="titlebar-button"
          onClick={() => appWindow.minimize()}
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        <button
          className="titlebar-button"
          onClick={async () => {
            await appWindow.toggleMaximize();
            setMaximized(await appWindow.isMaximized());
          }}
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M2 0v2H0v8h8V8h2V0H2zm6 8H1V3h7v5zM9 1v6H9V2H3V1h6z"
                fill="currentColor"
              />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect
                width="9"
                height="9"
                x="0.5"
                y="0.5"
                fill="none"
                stroke="currentColor"
              />
            </svg>
          )}
        </button>

        <button
          className="titlebar-button titlebar-button-close"
          onClick={() => appWindow.close()}
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

### Step 4: Style the Titlebar

```css
/* src/components/Titlebar.css */
.titlebar {
  display: flex;
  align-items: center;
  height: 32px;
  background-color: #1e1e2e;
  color: #cdd6f4;
  user-select: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
}

.titlebar-icon {
  display: flex;
  align-items: center;
  padding: 0 8px;
}

.titlebar-title {
  font-size: 12px;
  font-weight: 500;
}

.titlebar-spacer {
  flex: 1;
}

.titlebar-buttons {
  display: flex;
  height: 100%;
}

.titlebar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: #cdd6f4;
  cursor: pointer;
  transition: background-color 0.15s;
}

.titlebar-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.titlebar-button-close:hover {
  background-color: #e81123;
  color: white;
}

/* Offset main content to account for fixed titlebar */
body {
  margin: 0;
  padding-top: 32px;
}
```

### Step 5: Use the Titlebar in Your App

```tsx
// src/App.tsx
import { Titlebar } from './components/Titlebar';

function App() {
  return (
    <>
      <Titlebar />
      <main className="app-content">
        <h1>Hello, Tauri!</h1>
      </main>
    </>
  );
}

export default App;
```

### Important Notes on `data-tauri-drag-region`

The `data-tauri-drag-region` attribute enables window dragging on the element it is applied to. Key behaviors:

1. **It does NOT propagate to children.** You must add it to each individual element that should be draggable.
2. Buttons and interactive elements inside the titlebar should NOT have the attribute, so they remain clickable.
3. The spacer/background elements should have the attribute so users can drag from anywhere on the titlebar.

If `data-tauri-drag-region` is not working as expected, you can use the programmatic alternative:

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

element.addEventListener('mousedown', async (e) => {
  if (e.button === 0 && e.detail === 1) { // left click, single
    await getCurrentWindow().startDragging();
  }
});
```

---

## 6. Splashscreen Pattern

A splashscreen shows a loading window while the app performs heavy initialization tasks, then transitions to the main window.

### Step 1: Configure Both Windows

```jsonc
// src-tauri/tauri.conf.json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "My App",
        "width": 1024,
        "height": 768,
        "visible": false,
        "center": true
      },
      {
        "label": "splashscreen",
        "title": "Loading",
        "url": "/splashscreen",
        "width": 400,
        "height": 300,
        "center": true,
        "decorations": false,
        "resizable": false,
        "alwaysOnTop": true,
        "skipTaskbar": true
      }
    ]
  }
}
```

### Step 2: Create the Splashscreen Page

```tsx
// src/Splashscreen.tsx
import './Splashscreen.css';

export function Splashscreen() {
  return (
    <div className="splashscreen">
      <img src="/logo.svg" alt="App Logo" className="splash-logo" />
      <h1>My Application</h1>
      <div className="splash-spinner" />
      <p className="splash-text">Loading...</p>
    </div>
  );
}
```

```css
/* src/Splashscreen.css */
.splashscreen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #1e1e2e 0%, #313244 100%);
  color: #cdd6f4;
  font-family: sans-serif;
}

.splash-logo {
  width: 80px;
  height: 80px;
  margin-bottom: 16px;
}

.splash-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(205, 214, 244, 0.3);
  border-top-color: #89b4fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 16px 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.splash-text {
  font-size: 14px;
  opacity: 0.7;
}
```

### Step 3: Route Setup (React Router)

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { Splashscreen } from './Splashscreen';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/splashscreen" element={<Splashscreen />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
```

### Option A: Close Splashscreen from Rust Backend

Use this approach when your initialization happens in Rust (database setup, loading config, etc.):

```rust
// src-tauri/src/lib.rs
use tauri::Manager;
use std::time::Duration;

#[tauri::command]
async fn close_splashscreen(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        splash.close().map_err(|e| e.to_string())?;
    }
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            // Perform heavy initialization in a background task
            tauri::async_runtime::spawn(async move {
                // Simulate heavy work (replace with actual initialization)
                // IMPORTANT: use tokio::time::sleep, NOT std::thread::sleep
                // std::thread::sleep blocks the entire async runtime
                tokio::time::sleep(Duration::from_secs(3)).await;

                // --- Your initialization code here ---
                // e.g., database setup, config loading, health checks

                // Close splash and show main window
                if let Some(splash) = handle.get_webview_window("splashscreen") {
                    let _ = splash.close();
                }
                if let Some(main) = handle.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![close_splashscreen])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Option B: Close Splashscreen from Frontend

Use this approach when the frontend needs to finish loading before showing:

```rust
// src-tauri/src/lib.rs
use tauri::Manager;

#[tauri::command]
async fn close_splashscreen(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        splash.close().map_err(|e| e.to_string())?;
    }
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

```tsx
// src/App.tsx
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      // Perform frontend initialization
      // e.g., fetch user data, load settings, hydrate stores
      await loadUserPreferences();
      await initializeStores();

      // Signal that we are ready
      setReady(true);
      await invoke('close_splashscreen');
    };

    initialize();
  }, []);

  if (!ready) return null;

  return (
    <main>
      <h1>Application Ready</h1>
    </main>
  );
}

async function loadUserPreferences() {
  // simulate async work
  return new Promise((resolve) => setTimeout(resolve, 1000));
}

async function initializeStores() {
  return new Promise((resolve) => setTimeout(resolve, 500));
}

export default App;
```

### Permissions for Show/Hide

Make sure to add the relevant permissions:

```jsonc
// src-tauri/capabilities/default.json
{
  "permissions": [
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-close",
    "core:window:allow-set-focus"
  ]
}
```

---

## 7. System Tray

The system tray (or notification area / menu bar icon) allows your application to remain accessible even when the main window is closed or hidden.

### Step 1: Enable the Tray Feature

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-png"] }
```

### Step 2: Add a Tray Icon

Place your tray icon in `src-tauri/icons/`. It should be a PNG file, ideally 32x32 or 64x64 pixels with transparency.

### Step 3: Build the System Tray in Rust

```rust
// src-tauri/src/tray.rs
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

pub fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    // Create menu items
    let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide Window", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    // Build the menu
    let menu = MenuBuilder::new(app)
        .item(&show)
        .item(&hide)
        .item(&separator)
        .item(&quit)
        .build()?;

    // Build the tray icon
    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?)
        .menu(&menu)
        .menu_on_left_click(false) // Left click shows/hides the window
        .tooltip("My Tauri App")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    // Toggle window visibility on left click
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
```

### Step 4: Initialize the Tray in Setup

```rust
// src-tauri/src/lib.rs
mod tray;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Hide to Tray on Close (Instead of Exiting)

A common pattern is to hide the app to the system tray when the user clicks the close button, rather than quitting the application:

```rust
// src-tauri/src/lib.rs
mod tray;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            tray::create_tray(app.handle())?;

            // Intercept close on the main window to hide instead
            let main_window = app.get_webview_window("main")
                .expect("main window not found");

            main_window.on_window_event(|event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // Prevent the window from closing
                    api.prevent_close();
                    // Hide the window instead
                    // The user can reopen it from the tray
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Then combine with the hide in the event handler:

```rust
main_window.clone().on_window_event({
    let window = main_window.clone();
    move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.hide();
        }
    }
});
```

### Updating the Tray Icon Dynamically

```rust
use tauri::{image::Image, tray::TrayIcon, Manager};

#[tauri::command]
async fn set_tray_icon(app: tauri::AppHandle, status: String) -> Result<(), String> {
    let tray = app.tray_by_id("main-tray")
        .ok_or("Tray not found")?;

    let icon_bytes = match status.as_str() {
        "active" => include_bytes!("../icons/tray-active.png").to_vec(),
        "warning" => include_bytes!("../icons/tray-warning.png").to_vec(),
        "error" => include_bytes!("../icons/tray-error.png").to_vec(),
        _ => include_bytes!("../icons/tray-icon.png").to_vec(),
    };

    let icon = Image::from_bytes(&icon_bytes).map_err(|e| e.to_string())?;
    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn set_tray_tooltip(app: tauri::AppHandle, tooltip: String) -> Result<(), String> {
    let tray = app.tray_by_id("main-tray")
        .ok_or("Tray not found")?;
    tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;
    Ok(())
}
```

### Tray with Submenus and Check Items

```rust
use tauri::{
    image::Image,
    menu::{CheckMenuItem, MenuBuilder, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Manager,
};

pub fn create_advanced_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open App", true, None::<&str>)?;

    // Submenu for status
    let status_online = CheckMenuItem::with_id(app, "online", "Online", true, true, None::<&str>)?;
    let status_away = CheckMenuItem::with_id(app, "away", "Away", true, false, None::<&str>)?;
    let status_dnd = CheckMenuItem::with_id(app, "dnd", "Do Not Disturb", true, false, None::<&str>)?;

    let status_menu = Submenu::with_id_and_items(
        app,
        "status",
        "Status",
        true,
        &[&status_online, &status_away, &status_dnd],
    )?;

    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = MenuBuilder::new(app)
        .item(&open)
        .item(&status_menu)
        .item(&separator)
        .item(&quit)
        .build()?;

    TrayIconBuilder::with_id("main-tray")
        .icon(Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?)
        .menu(&menu)
        .tooltip("My App - Online")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "open" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => app.exit(0),
            "online" | "away" | "dnd" => {
                println!("Status changed to: {}", event.id.as_ref());
                // Update check marks and handle status change
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
```

---

## 8. Window Communication

Tauri provides an event system for sending messages between windows, as well as between the frontend and backend.

### Emitting Events to All Windows

From Rust:

```rust
use tauri::{Emitter, Manager};

#[tauri::command]
async fn broadcast_message(app: tauri::AppHandle, message: String) -> Result<(), String> {
    // Emit to ALL windows
    app.emit("broadcast", &message).map_err(|e| e.to_string())?;
    Ok(())
}
```

From the frontend:

```typescript
import { emit } from '@tauri-apps/api/event';

// Emit to all windows and Rust listeners
await emit('broadcast', { message: 'Hello from main window!' });
```

### Emitting Events to a Specific Window

From Rust:

```rust
use tauri::{Emitter, Manager};

#[tauri::command]
async fn send_to_window(
    app: tauri::AppHandle,
    target_label: String,
    data: String,
) -> Result<(), String> {
    // Emit only to a specific window
    app.emit_to(&target_label, "window-message", &data)
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

From the frontend:

```typescript
import { emitTo } from '@tauri-apps/api/event';

// Send to a specific window by label
await emitTo('settings', 'update-theme', { theme: 'dark' });
```

### Listening for Events

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for broadcast events in any window
const unlisten = await listen<string>('broadcast', (event) => {
  console.log('Received broadcast:', event.payload);
  console.log('From window:', event.windowLabel);
});

// Listen for targeted events
const unlistenMsg = await listen('window-message', (event) => {
  console.log('Received message:', event.payload);
});

// Clean up
// unlisten();
// unlistenMsg();
```

### Complete Example: Synchronized State Across Windows

**Rust backend (shared state + events):**

```rust
// src-tauri/src/lib.rs
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

#[derive(Default, Serialize, Deserialize, Clone)]
struct AppSettings {
    theme: String,
    font_size: u32,
    sidebar_visible: bool,
}

struct AppState {
    settings: Mutex<AppSettings>,
}

#[tauri::command]
async fn get_settings(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
async fn update_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    {
        let mut current = state.settings.lock().map_err(|e| e.to_string())?;
        *current = settings.clone();
    }

    // Broadcast the update to ALL windows so they can react
    app.emit("settings-changed", &settings)
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            settings: Mutex::new(AppSettings {
                theme: "dark".into(),
                font_size: 14,
                sidebar_visible: true,
            }),
        })
        .invoke_handler(tauri::generate_handler![get_settings, update_settings])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Frontend (React hook for shared settings):**

```tsx
// src/hooks/useSharedSettings.ts
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface AppSettings {
  theme: string;
  font_size: number;
  sidebar_visible: boolean;
}

export function useSharedSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    // Load initial settings
    invoke<AppSettings>('get_settings').then(setSettings);

    // Listen for changes from other windows
    const unlisten = listen<AppSettings>('settings-changed', (event) => {
      setSettings(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    if (!settings) return;
    const merged = { ...settings, ...newSettings };
    await invoke('update_settings', { settings: merged });
    // The settings-changed event will update our local state
  };

  return { settings, updateSettings };
}
```

### Pattern: Waiting for a Window to Be Ready

A newly created window may not have its listeners registered when you emit an event immediately after creation. Use a "ready" handshake pattern:

```rust
use tauri::{Emitter, Listener, Manager};
use tauri::webview::{WebviewWindowBuilder, WebviewUrl};

#[tauri::command]
async fn open_detail_window(app: tauri::AppHandle, item_id: String) -> Result<(), String> {
    let label = format!("detail-{}", item_id);

    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App("/detail".into()),
    )
    .title(format!("Detail: {}", item_id))
    .inner_size(600.0, 400.0)
    .build()
    .map_err(|e| e.to_string())?;

    // Wait for the new window to signal it is ready, then send data
    let item_id_clone = item_id.clone();
    window.clone().listen("ready", move |_event| {
        let _ = window.emit("load-item", &item_id_clone);
    });

    Ok(())
}
```

```tsx
// In the detail window's component
import { useEffect, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function DetailWindow() {
  const [itemId, setItemId] = useState<string | null>(null);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    // Listen for data from the parent
    const unlistenItem = appWindow.listen<string>('load-item', (event) => {
      setItemId(event.payload);
    });

    // Signal that this window is ready
    emit('ready', {});

    return () => {
      unlistenItem.then((fn) => fn());
    };
  }, []);

  if (!itemId) return <div>Loading...</div>;

  return <div>Showing detail for item: {itemId}</div>;
}
```

---

## 9. Frameless and Transparent Windows

Frameless and transparent windows let you create fully custom window shapes and appearances.

### Basic Frameless Window

A frameless window removes the native title bar and borders but keeps an opaque background:

```jsonc
// src-tauri/tauri.conf.json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "decorations": false,
        "width": 800,
        "height": 600,
        "shadow": true
      }
    ]
  }
}
```

### Transparent Window

A transparent window allows the HTML background to show through to the desktop:

```jsonc
// src-tauri/tauri.conf.json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "decorations": false,
        "transparent": true,
        "width": 800,
        "height": 600,
        "shadow": false
      }
    ]
  }
}
```

### Frontend CSS for Transparency

You must set the HTML/CSS background to transparent as well:

```css
/* src/styles/transparent.css */

/* Make the document background fully transparent */
html, body, #root {
  margin: 0;
  padding: 0;
  background: transparent;
  height: 100%;
}
```

### Rounded Corners with Transparency

```tsx
// src/App.tsx
import './App.css';
import { Titlebar } from './components/Titlebar';

function App() {
  return (
    <div className="app-container">
      <Titlebar />
      <main className="app-content">
        <h1>Transparent Window</h1>
        <p>This window has rounded corners and a semi-transparent background.</p>
      </main>
    </div>
  );
}

export default App;
```

```css
/* src/App.css */
html, body, #root {
  margin: 0;
  padding: 0;
  background: transparent;
  height: 100%;
}

.app-container {
  height: 100vh;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(30, 30, 46, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  padding: 16px 24px;
  color: #cdd6f4;
  overflow-y: auto;
}
```

### Floating Widget Example

Create a small, frameless, transparent widget that floats on the desktop:

```jsonc
// In tauri.conf.json, add a widget window
{
  "app": {
    "windows": [
      {
        "label": "main",
        "width": 1024,
        "height": 768
      },
      {
        "label": "widget",
        "url": "/widget",
        "width": 200,
        "height": 200,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "resizable": false,
        "shadow": false,
        "skipTaskbar": true,
        "create": false
      }
    ]
  }
}
```

```tsx
// src/Widget.tsx
import './Widget.css';

export function Widget() {
  return (
    <div className="widget" data-tauri-drag-region>
      <div className="widget-content" data-tauri-drag-region>
        <div className="widget-value">72%</div>
        <div className="widget-label">CPU Usage</div>
      </div>
    </div>
  );
}
```

```css
/* src/Widget.css */
html, body, #root {
  margin: 0;
  padding: 0;
  background: transparent;
  overflow: hidden;
}

.widget {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: rgba(30, 30, 46, 0.85);
  border: 2px solid rgba(137, 180, 250, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 10px;
  cursor: move;
  backdrop-filter: blur(10px);
}

.widget-content {
  text-align: center;
  color: #cdd6f4;
}

.widget-value {
  font-size: 36px;
  font-weight: bold;
  color: #89b4fa;
}

.widget-label {
  font-size: 12px;
  opacity: 0.7;
  margin-top: 4px;
}
```

### Opening and Closing the Widget from Rust

```rust
use tauri::{Manager, webview::{WebviewWindowBuilder, WebviewUrl}};

#[tauri::command]
async fn toggle_widget(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(widget) = app.get_webview_window("widget") {
        let visible = widget.is_visible().map_err(|e| e.to_string())?;
        if visible {
            widget.hide().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            widget.show().map_err(|e| e.to_string())?;
            Ok(true)
        }
    } else {
        // Create from config if it does not exist yet
        let config = app.config()
            .app
            .windows
            .iter()
            .find(|w| w.label == "widget")
            .cloned()
            .ok_or("Widget config not found")?;

        WebviewWindowBuilder::from_config(&app, &config)
            .map_err(|e| e.to_string())?
            .build()
            .map_err(|e| e.to_string())?;

        Ok(true)
    }
}
```

### Platform Considerations

- **Windows:** Setting `shadow: true` on a transparent, undecorated window adds a thin white border and (on Windows 11) rounded corners automatically. Set `shadow: false` for fully custom shapes.
- **macOS:** Use `titleBarStyle: "Overlay"` or `"Transparent"` for a macOS-native translucent titlebar without full transparency. For full transparency, use `decorations: false` and `transparent: true`.
- **Linux:** Transparency depends on the compositor. Under X11 without compositing, transparent areas may render as black. Wayland compositors generally support transparency.

---

## 10. Coding Challenges

### Challenge 1: Note-Taking App with Multiple Windows

**Description:** Build a note-taking application where each note opens in its own window. The main window shows a list of notes, and double-clicking a note opens it in a dedicated editor window.

**Requirements:**
- The main window displays a list of notes with titles and preview text.
- Double-clicking a note opens a new window for that specific note (use the note ID as part of the window label).
- If the note window is already open, focus it instead of creating a duplicate.
- Edits in the note window are reflected in the main window's list in real-time using the event system.
- Closing all note windows does not close the main window, and vice versa -- closing the main window prompts the user if any note windows have unsaved changes.

**Hints:**
- Use `WebviewWindow.getByLabel()` or `app.get_webview_window()` to check for existing windows before creating.
- Use `emitTo` to send save events from a note window to the main window.
- Store notes in Rust managed state (`tauri::State`) and broadcast changes with `app.emit()`.
- Use the "ready" handshake pattern to pass the note ID to the newly created window.

---

### Challenge 2: System Tray Pomodoro Timer

**Description:** Create a Pomodoro timer application that lives primarily in the system tray. The tray icon and tooltip show the current timer state, and a small popup window appears when the timer expires.

**Requirements:**
- The system tray shows a context menu with: Start (25 min), Short Break (5 min), Long Break (15 min), and Quit.
- The tray tooltip updates every second to show remaining time (e.g., "Pomodoro: 14:32 remaining").
- When the timer completes, a small notification window (300x200, undecorated, always-on-top, centered) pops up to alert the user.
- The tray icon changes color/appearance based on state: working (red), short break (green), long break (blue), idle (gray).
- Clicking the tray icon toggles the main window which shows a full session history.

**Hints:**
- Use `tokio::time::interval` or `tokio::time::sleep` in a background task for the timer.
- Call `tray.set_icon()` and `tray.set_tooltip()` to update the tray dynamically.
- Create the notification window with `WebviewWindowBuilder` when the timer fires, and auto-close it after a few seconds.
- Store session history in managed state and emit events to update the main window.

---

### Challenge 3: Custom Titlebar with Tab Support

**Description:** Build a browser-like tabbed interface with a fully custom titlebar. Each tab loads a different page/component, and tabs can be dragged to reorder.

**Requirements:**
- The custom titlebar replaces native decorations and includes: app icon, tab bar, minimize/maximize/close buttons.
- Tabs are draggable within the titlebar to reorder (use `data-tauri-drag-region` only on the empty space, not on the tabs).
- Clicking a tab switches the content area. A "+" button adds a new tab.
- Middle-clicking a tab closes it.
- The window is draggable from the empty space in the titlebar (between/after tabs).
- The titlebar visually adapts when the window is maximized (rounded corners disappear, different padding).

**Hints:**
- Use `data-tauri-drag-region` on the titlebar background and spacer elements but NOT on the tabs or buttons.
- Track maximize state with `appWindow.onResized()` to adjust border-radius dynamically.
- Use React state for tab management (active tab, tab order, tab content).
- Consider using a drag library like `@dnd-kit/core` for tab reordering, or implement basic drag with native HTML drag events.

---

### Challenge 4: Transparent Desktop Widget Dashboard

**Description:** Create a desktop widget dashboard where multiple transparent, frameless widgets float on the desktop. A hidden main window with a tray icon lets users configure which widgets are visible.

**Requirements:**
- Implement at least three widget types: Clock, System Info (CPU/memory), and a Quick Notes sticky note.
- Each widget is its own transparent, frameless, always-on-top window with rounded corners.
- Widgets can be dragged to reposition on the desktop.
- Right-clicking a widget shows a context menu with "Close Widget" and "Settings."
- The system tray menu lets users toggle each widget on/off and has a "Quit" option.
- Widget positions are saved and restored on app restart (use a file or local storage for persistence).

**Hints:**
- Create each widget as a separate window with `transparent: true`, `decorations: false`, `alwaysOnTop: true`, and `skipTaskbar: true`.
- Use different routes (`/widget/clock`, `/widget/sysinfo`, `/widget/notes`) for each widget type.
- Save widget positions using `appWindow.outerPosition()` and restore with `appWindow.setPosition()`.
- Use the `serde_json` crate to persist widget layout to a JSON file in the app data directory.

---

### Challenge 5: Splashscreen with Progress Updates

**Description:** Implement a polished splashscreen that displays real-time progress updates as the application initializes multiple subsystems.

**Requirements:**
- The splashscreen window is undecorated, centered, 500x350, with a semi-transparent background and rounded corners.
- It shows an app logo, a progress bar, and a status message that updates as each initialization step completes.
- The backend initializes at least four subsystems sequentially (e.g., "Loading configuration...", "Connecting to database...", "Syncing data...", "Preparing UI..."), emitting progress events to the splashscreen.
- Each step takes a realistic amount of time (0.5-2 seconds).
- When initialization completes, the splashscreen fades out (opacity transition), then the main window appears.
- If any initialization step fails, the splashscreen shows an error message with a "Retry" button.

**Hints:**
- Emit events from Rust to the splashscreen window using `app.emit_to("splashscreen", "init-progress", payload)`.
- The payload should include `step` (number), `total` (number), `message` (string), and `status` ("loading" | "done" | "error").
- In the splashscreen React component, listen for `init-progress` events to update the progress bar and message.
- Use CSS transitions for the fade-out effect, then call `invoke('close_splashscreen')` after the transition completes.
- For the retry flow, emit a `retry-init` event from the frontend and listen for it in the Rust backend to restart initialization.
