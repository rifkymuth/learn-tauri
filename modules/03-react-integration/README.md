# Module 03: React Integration

In Modules 01 and 02 you learned Rust fundamentals and how Tauri works under the hood. Now it is time to bring in what you already know: **React**. This module shows you how React, Vite, and Tauri fit together, and introduces the patterns you will use throughout every project in this course.

If you have built React apps before, most of this will feel familiar. The key difference is that your "backend" is no longer a remote server — it is a Rust process running on the same machine, communicating with your React frontend over an IPC bridge.

---

## Table of Contents

1. [Vite + React + Tauri Setup](#1-vite--react--tauri-setup)
2. [The @tauri-apps/api Package](#2-the-tauri-appsapi-package)
3. [Calling Rust from React](#3-calling-rust-from-react)
4. [React Patterns for Tauri](#4-react-patterns-for-tauri)
5. [Styling Options](#5-styling-options)
6. [Routing](#6-routing)
7. [Frontend State Management](#7-frontend-state-management)
8. [Environment Detection](#8-environment-detection)
9. [Hot Module Replacement](#9-hot-module-replacement)
10. [Coding Challenges](#10-coding-challenges)

---

## 1. Vite + React + Tauri Setup

### How the Pieces Fit Together

A Tauri app has two processes:

```
┌──────────────────────────────────────────┐
│              Tauri Application           │
│                                          │
│  ┌─────────────────┐  IPC  ┌──────────┐ │
│  │   Webview        │◄────►│  Rust    │ │
│  │   (React + Vite) │      │  Backend │ │
│  └─────────────────┘      └──────────┘ │
│                                          │
│  Vite dev server (dev) ──► serves HTML   │
│  Vite build (prod) ──► static files      │
└──────────────────────────────────────────┘
```

- **Vite** is the build tool and dev server for your React frontend. It compiles TypeScript, bundles your code, and serves it during development.
- **React** runs inside the system webview (not Chromium — the OS's native webview).
- **Tauri** manages the window, the Rust backend, and the IPC bridge between the two.

During `cargo tauri dev`, Tauri starts the Vite dev server and points the webview at it. During `cargo tauri build`, Vite produces static files that get embedded directly into the final binary.

### Project Structure

After running `npm create tauri-app@latest my-app -- --template react-ts`, you get:

```
my-app/
├── src/                    # React frontend
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx            # React entry point
│   ├── vite-env.d.ts       # Vite type declarations
│   ├── components/         # Your React components
│   ├── hooks/              # Custom hooks (useInvoke, etc.)
│   ├── lib/                # Utility functions
│   └── styles/             # CSS / Tailwind
├── src-tauri/              # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json     # Tauri configuration
│   ├── capabilities/       # Permission capabilities
│   ├── src/
│   │   ├── main.rs         # Rust entry point
│   │   └── lib.rs          # Command definitions
│   └── icons/              # App icons
├── index.html              # HTML entry point (Vite uses this)
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts          # Vite configuration
```

### vite.config.ts for Tauri

The Vite config for a Tauri project has a few critical settings:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

  server: {
    port: 1420,
    // Tauri expects a fixed port; fail if it is occupied
    strictPort: true,
    // Expose to all network interfaces so Tauri can reach it
    host: "0.0.0.0",
    hmr: {
      // Use the same protocol as the page
      protocol: "ws",
      // HMR WebSocket must be accessible from the webview
      host: "localhost",
      port: 1421,
    },
  },

  // Configure path aliases for cleaner imports
  resolve: {
    alias: {
      "@": "/src",
      "@components": "/src/components",
      "@hooks": "/src/hooks",
      "@lib": "/src/lib",
    },
  },

  // Environment variables prefixed with VITE_ are exposed to the frontend
  envPrefix: ["VITE_"],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target:
      process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : "safari14",
    // Produce sourcemaps for debugging in dev
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Lower the chunk size warning limit (desktop apps load locally)
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Keep chunk names readable in dev builds
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
}));
```

**Why these settings matter:**

- `clearScreen: false` — when Rust compilation errors occur you want to see them in the terminal, not have them wiped by Vite's output.
- `strictPort: true` — Tauri's `tauri.conf.json` is configured to connect to a specific port. If that port is already taken by another process, you want a clear error rather than a silent switch to a random port.
- `host: "0.0.0.0"` — the system webview needs to reach the dev server, which requires binding to an accessible address.
- `target` — Tauri uses different rendering engines on different platforms. Setting the right target ensures Vite does not polyfill features the engine already supports natively.

### tauri.conf.json Frontend Config

The corresponding section in `src-tauri/tauri.conf.json` tells Tauri where to find your frontend:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  }
}
```

- `beforeDevCommand` — Tauri runs this command to start your Vite dev server.
- `devUrl` — where the webview connects during development.
- `beforeBuildCommand` — runs your production build before bundling.
- `frontendDist` — path to the built frontend files (relative to `src-tauri/`).

---

## 2. The @tauri-apps/api Package

### Installation

```bash
npm install @tauri-apps/api
```

This is the official JavaScript/TypeScript package for communicating with the Tauri backend. It provides type-safe wrappers around the IPC bridge.

### What It Provides

The package is organized into submodules, each covering a different Tauri capability:

```typescript
// Core IPC — calling Rust commands
import { invoke } from "@tauri-apps/api/core";

// Event system — listen for events from Rust or other windows
import { listen, emit } from "@tauri-apps/api/event";

// Window management
import { getCurrentWindow, Window } from "@tauri-apps/api/window";

// App info and lifecycle
import { getName, getVersion, getTauriVersion } from "@tauri-apps/api/app";

// Path utilities — resolve platform-specific paths
import {
  appDataDir,
  desktopDir,
  homeDir,
} from "@tauri-apps/api/path";

// Menu (programmatic menu creation)
import { Menu, MenuItem, Submenu } from "@tauri-apps/api/menu";

// Image handling
import { Image } from "@tauri-apps/api/image";

// Webview management
import { getCurrentWebview } from "@tauri-apps/api/webview";
```

### TypeScript Support

The package ships with full TypeScript definitions. You get autocompletion and type checking out of the box. Here is an example showing what the type system gives you:

```typescript
import { invoke } from "@tauri-apps/api/core";

// invoke is generic — you specify the return type
const result = await invoke<string>("greet", { name: "World" });
//    ^ result is typed as string

// You can also define an interface for the response
interface FileInfo {
  name: string;
  size: number;
  modified: string;
  is_directory: boolean;
}

const info = await invoke<FileInfo>("get_file_info", {
  path: "/home/user/document.txt",
});
// info.name, info.size, etc. are all typed
```

### Additional Plugin Packages

Many Tauri capabilities come through separate plugin packages:

```bash
# File system access
npm install @tauri-apps/plugin-fs

# HTTP client
npm install @tauri-apps/plugin-http

# Shell commands
npm install @tauri-apps/plugin-shell

# File/folder dialog
npm install @tauri-apps/plugin-dialog

# Clipboard
npm install @tauri-apps/plugin-clipboard-manager

# Notifications
npm install @tauri-apps/plugin-notification
```

Each plugin must also be registered on the Rust side in `src-tauri/src/lib.rs` and permitted in the capabilities configuration.

---

## 3. Calling Rust from React

### The invoke() Function

`invoke()` is the bridge between your React frontend and Rust backend. It calls a Rust function (a "command") by name, optionally passes arguments, and returns the result as a Promise.

**Rust side** (`src-tauri/src/lib.rs`):

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Tauri.", name)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**React side**:

```typescript
import { invoke } from "@tauri-apps/api/core";

// Simple call with no arguments
const version = await invoke<string>("get_version");

// Call with arguments — pass them as an object
const greeting = await invoke<string>("greet", { name: "Alice" });
```

### Sending Arguments

Arguments are passed as a plain object. The keys must match the Rust function parameter names exactly.

**Rust command with multiple parameters:**

```rust
#[tauri::command]
fn calculate(a: f64, b: f64, operation: &str) -> Result<f64, String> {
    match operation {
        "add" => Ok(a + b),
        "subtract" => Ok(a - b),
        "multiply" => Ok(a * b),
        "divide" => {
            if b == 0.0 {
                Err("Division by zero".to_string())
            } else {
                Ok(a / b)
            }
        }
        _ => Err(format!("Unknown operation: {}", operation)),
    }
}
```

**React call:**

```typescript
try {
  const result = await invoke<number>("calculate", {
    a: 10,
    b: 3,
    operation: "divide",
  });
  console.log(result); // 3.3333...
} catch (error) {
  // Rust Err variants are thrown as exceptions
  console.error("Calculation failed:", error);
}
```

### Receiving Responses and Error Handling

Rust commands that return `Result<T, E>` map cleanly to JavaScript Promises:

- `Ok(value)` resolves the Promise with `value`.
- `Err(error)` rejects the Promise with `error`.

**Rust:**

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct TodoItem {
    pub id: u32,
    pub title: String,
    pub completed: bool,
}

#[tauri::command]
fn get_todos() -> Result<Vec<TodoItem>, String> {
    // In a real app, this would read from a database
    Ok(vec![
        TodoItem { id: 1, title: "Learn Rust".into(), completed: true },
        TodoItem { id: 2, title: "Build Tauri app".into(), completed: false },
    ])
}

#[tauri::command]
fn create_todo(title: String) -> Result<TodoItem, String> {
    if title.trim().is_empty() {
        return Err("Title cannot be empty".into());
    }
    Ok(TodoItem {
        id: 42, // In reality, generated by the database
        title,
        completed: false,
    })
}
```

**React component:**

```tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
}

function TodoList() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    invoke<TodoItem[]>("get_todos")
      .then(setTodos)
      .catch((err) => setError(String(err)));
  }, []);

  const addTodo = async () => {
    try {
      const todo = await invoke<TodoItem>("create_todo", {
        title: newTitle,
      });
      setTodos((prev) => [...prev, todo]);
      setNewTitle("");
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div>
      <h2>Todos</h2>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <span
              style={{
                textDecoration: todo.completed ? "line-through" : "none",
              }}
            >
              {todo.title}
            </span>
          </li>
        ))}
      </ul>
      <input
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        placeholder="New todo..."
      />
      <button onClick={addTodo}>Add</button>
    </div>
  );
}

export default TodoList;
```

### TypeScript Typing for Commands

For larger projects, create a dedicated types file that mirrors your Rust structs:

```typescript
// src/types/commands.ts

// Mirrors Rust structs (use snake_case to match serde defaults)
export interface FileEntry {
  name: string;
  path: string;
  size: number;
  is_directory: boolean;
  modified_at: string;
  children?: FileEntry[];
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  font_size: number;
  auto_save: boolean;
  recent_files: string[];
}

export interface SystemInfo {
  os_name: string;
  os_version: string;
  cpu_count: number;
  memory_total: number;
  memory_available: number;
}

// Type-safe wrapper for invoke calls
// This is optional but provides an extra layer of safety
export async function listFiles(directory: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_files", { directory });
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function updateSettings(
  settings: AppSettings,
): Promise<void> {
  return invoke("update_settings", { settings });
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>("get_system_info");
}
```

> **Note on naming:** Rust uses `snake_case` for struct fields. Serde serializes them as `snake_case` by default. Your TypeScript interfaces should use `snake_case` to match, unless you configure serde with `#[serde(rename_all = "camelCase")]` on the Rust side.

---

## 4. React Patterns for Tauri

### The useInvoke Custom Hook

Calling `invoke()` in every component creates repetitive boilerplate. A custom hook encapsulates loading, error, and data states — exactly like you would with `useFetch` for HTTP requests:

```typescript
// src/hooks/useInvoke.ts
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UseInvokeResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

export function useInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): UseInvokeResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Serialize args to a stable string for the dependency array
  const argsKey = JSON.stringify(args);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<T>(command, args);
      setData(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, argsKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, error, loading, refetch: fetchData };
}
```

**Using it in a component:**

```tsx
import { useInvoke } from "@/hooks/useInvoke";

interface SystemInfo {
  os_name: string;
  os_version: string;
  cpu_count: number;
  memory_total: number;
}

function SystemInfoPanel() {
  const { data, error, loading, refetch } = useInvoke<SystemInfo>(
    "get_system_info",
  );

  if (loading) return <div className="spinner">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="panel">
      <h3>System Information</h3>
      <dl>
        <dt>Operating System</dt>
        <dd>{data.os_name} {data.os_version}</dd>
        <dt>CPU Cores</dt>
        <dd>{data.cpu_count}</dd>
        <dt>Total Memory</dt>
        <dd>{(data.memory_total / 1_073_741_824).toFixed(1)} GB</dd>
      </dl>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

### A Lazy useInvoke for On-Demand Commands

Sometimes you do not want to call a command on mount — you want to call it when the user clicks a button. A "lazy" variant handles this:

```typescript
// src/hooks/useLazyInvoke.ts
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UseLazyInvokeResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  execute: (args?: Record<string, unknown>) => Promise<T>;
}

export function useLazyInvoke<T>(
  command: string,
): UseLazyInvokeResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (args?: Record<string, unknown>): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<T>(command, args);
        setData(result);
        return result;
      } catch (err) {
        const message = String(err);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [command],
  );

  return { data, error, loading, execute };
}
```

**Usage:**

```tsx
import { useLazyInvoke } from "@/hooks/useLazyInvoke";

function FileProcessor() {
  const { data, error, loading, execute } = useLazyInvoke<string>(
    "process_file",
  );

  const handleProcess = () => {
    execute({ path: "/home/user/data.csv" });
  };

  return (
    <div>
      <button onClick={handleProcess} disabled={loading}>
        {loading ? "Processing..." : "Process File"}
      </button>
      {error && <p className="error">{error}</p>}
      {data && <p className="success">Result: {data}</p>}
    </div>
  );
}
```

### Error Boundaries for Tauri Commands

React error boundaries catch rendering errors, but they do not catch errors from async operations like `invoke()`. You need a combination of an error boundary for render-time crashes and try/catch for command calls:

```tsx
// src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    // In a Tauri app, you could invoke a Rust command to log this
    // invoke("log_error", { error: error.message, stack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-boundary">
            <h2>Something went wrong</h2>
            <pre>{this.state.error?.message}</pre>
            <button
              onClick={() =>
                this.setState({ hasError: false, error: null })
              }
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

**Wrapping your app:**

```tsx
// src/App.tsx
import ErrorBoundary from "@/components/ErrorBoundary";
import MainView from "@/components/MainView";

function App() {
  return (
    <ErrorBoundary>
      <MainView />
    </ErrorBoundary>
  );
}

export default App;
```

### Loading States

A reusable loading component that matches the desktop app feel:

```tsx
// src/components/LoadingSpinner.tsx
interface LoadingSpinnerProps {
  message?: string;
  size?: "small" | "medium" | "large";
}

function LoadingSpinner({
  message = "Loading...",
  size = "medium",
}: LoadingSpinnerProps) {
  const sizeMap = { small: 16, medium: 32, large: 48 };
  const pixels = sizeMap[size];

  return (
    <div
      className="loading-container"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        padding: "20px",
      }}
    >
      <div
        className="spinner"
        style={{
          width: pixels,
          height: pixels,
          border: "3px solid #e0e0e0",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span style={{ color: "#6b7280", fontSize: "14px" }}>{message}</span>
    </div>
  );
}

export default LoadingSpinner;
```

---

## 5. Styling Options

### Tailwind CSS Setup with Tauri

Tailwind CSS works perfectly with Tauri and Vite. It is the most popular choice in the Tauri community.

**Installation:**

```bash
npm install -D tailwindcss @tailwindcss/vite
```

**Vite plugin setup** (`vite.config.ts`):

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ... rest of your Tauri config
});
```

**Import in CSS** (`src/styles/main.css`):

```css
@import "tailwindcss";

/* Desktop-app-specific base styles */
@layer base {
  /* Prevent text selection on UI elements (feels more native) */
  body {
    -webkit-user-select: none;
    user-select: none;
  }

  /* But allow selection in content areas */
  .selectable,
  input,
  textarea,
  [contenteditable] {
    -webkit-user-select: text;
    user-select: text;
  }

  /* Remove the focus ring for mouse users, keep for keyboard */
  :focus:not(:focus-visible) {
    outline: none;
  }
}
```

**Usage in a component:**

```tsx
function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col bg-gray-900 text-gray-100">
      <div className="border-b border-gray-700 p-4">
        <h1 className="text-lg font-semibold">My Tauri App</h1>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        <a
          href="#"
          className="block rounded-md bg-gray-800 px-3 py-2 text-sm font-medium"
        >
          Dashboard
        </a>
        <a
          href="#"
          className="block rounded-md px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          Settings
        </a>
      </nav>
    </aside>
  );
}
```

### CSS Modules

CSS Modules work out of the box with Vite — no extra configuration needed:

```css
/* src/components/Panel.module.css */
.panel {
  background: var(--panel-bg, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary, #111827);
}

.content {
  font-size: 14px;
  color: var(--text-secondary, #6b7280);
  line-height: 1.5;
}
```

```tsx
import styles from "./Panel.module.css";

interface PanelProps {
  title: string;
  children: React.ReactNode;
}

function Panel({ title, children }: PanelProps) {
  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

export default Panel;
```

### styled-components

styled-components works fine but adds runtime overhead. For desktop apps where bundle size is less critical, it is a valid choice:

```bash
npm install styled-components
npm install -D @types/styled-components
```

```tsx
import styled from "styled-components";

const TitleBar = styled.header<{ $platform?: string }>`
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  background: ${(props) =>
    props.$platform === "macos" ? "transparent" : "#1f2937"};
  -webkit-app-region: drag;
  user-select: none;

  /* macOS has window controls on the left */
  padding-left: ${(props) =>
    props.$platform === "macos" ? "72px" : "12px"};
`;

const Title = styled.span`
  font-size: 13px;
  color: #d1d5db;
  font-weight: 500;
`;

function AppTitleBar() {
  const platform = "linux"; // detect dynamically in a real app
  return (
    <TitleBar $platform={platform}>
      <Title>My Desktop App</Title>
    </TitleBar>
  );
}
```

### Which Approach Works Best?

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Tailwind CSS** | Fast, no runtime cost, great DX with Vite | Verbose class names | Most Tauri apps |
| **CSS Modules** | Scoped by default, zero config with Vite | More files to manage | Component libraries |
| **styled-components** | Dynamic styles, colocated | Runtime CSS-in-JS overhead | Complex theming |
| **Vanilla CSS** | Simple, no dependencies | Global scope issues | Small projects |

**Recommendation:** Tailwind CSS is the best default choice for Tauri apps. It has zero runtime overhead, integrates cleanly with Vite, and the utility-first approach works well for building desktop-style UIs.

---

## 6. Routing

### React Router in a Tauri App

Install React Router:

```bash
npm install react-router-dom
```

### Hash Router vs Browser Router

In a typical web app, you use `BrowserRouter`, which relies on the server handling URL paths (e.g., `/settings` returns `index.html`). In a Tauri app, there is no web server in production — your files are loaded from the local filesystem via a custom protocol.

**Use `HashRouter` for Tauri apps.** It uses the URL hash (`#/settings`) for navigation, which does not require server-side routing support.

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./styles/main.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
```

### Full Routing Example

```tsx
// src/App.tsx
import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "@/components/Dashboard";
import Settings from "@/components/Settings";
import FileExplorer from "@/components/FileExplorer";
import About from "@/components/About";

function App() {
  return (
    <div className="flex h-screen">
      {/* Sidebar navigation */}
      <nav className="flex w-56 flex-col border-r border-gray-200 bg-gray-50 p-4">
        <h1 className="mb-6 text-lg font-bold">My App</h1>
        <ul className="space-y-1">
          <SidebarLink to="/" label="Dashboard" />
          <SidebarLink to="/files" label="Files" />
          <SidebarLink to="/settings" label="Settings" />
          <SidebarLink to="/about" label="About" />
        </ul>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/files" element={<FileExplorer />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  );
}

function SidebarLink({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) =>
          `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isActive
              ? "bg-blue-100 text-blue-700"
              : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          }`
        }
      >
        {label}
      </NavLink>
    </li>
  );
}

export default App;
```

### Nested Routes

For complex apps, nest routes just like you would in a web app:

```tsx
// src/components/Settings.tsx
import { Routes, Route, NavLink, Outlet } from "react-router-dom";

function Settings() {
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Settings</h2>
      <div className="flex gap-4">
        <nav className="w-48 space-y-1">
          <NavLink to="/settings" end className="settings-link">
            General
          </NavLink>
          <NavLink to="/settings/appearance" className="settings-link">
            Appearance
          </NavLink>
          <NavLink to="/settings/shortcuts" className="settings-link">
            Keyboard Shortcuts
          </NavLink>
        </nav>
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

// In App.tsx routes:
// <Route path="/settings" element={<Settings />}>
//   <Route index element={<GeneralSettings />} />
//   <Route path="appearance" element={<AppearanceSettings />} />
//   <Route path="shortcuts" element={<ShortcutSettings />} />
// </Route>
```

---

## 7. Frontend State Management

### Why Not Just useState?

For small Tauri apps, `useState` and prop drilling work fine. As your app grows, you need a state management solution. In Tauri apps, you also need to synchronize state between the React frontend and the Rust backend — something web apps do not normally deal with.

### Zustand for Tauri Apps

Zustand is lightweight, has minimal boilerplate, and works beautifully with Tauri's async command pattern.

```bash
npm install zustand
```

**A Zustand store that syncs with Rust:**

```typescript
// src/stores/settingsStore.ts
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface AppSettings {
  theme: "light" | "dark" | "system";
  font_size: number;
  auto_save: boolean;
  sidebar_visible: boolean;
}

interface SettingsStore {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => Promise<void>;
  toggleSidebar: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  loading: false,
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await invoke<AppSettings>("get_settings");
      set({ settings, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  updateSetting: async (key, value) => {
    const current = get().settings;
    if (!current) return;

    // Optimistic update — change the UI immediately
    const updated = { ...current, [key]: value };
    set({ settings: updated });

    try {
      // Persist to Rust backend
      await invoke("update_settings", { settings: updated });
    } catch (err) {
      // Rollback on failure
      set({ settings: current, error: String(err) });
    }
  },

  // Pure frontend state — no Rust call needed
  toggleSidebar: () => {
    const current = get().settings;
    if (!current) return;
    set({
      settings: {
        ...current,
        sidebar_visible: !current.sidebar_visible,
      },
    });
  },
}));
```

**Using the store in components:**

```tsx
// src/components/SettingsPanel.tsx
import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

function SettingsPanel() {
  const { settings, loading, error, loadSettings, updateSetting } =
    useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (loading) return <p>Loading settings...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!settings) return null;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Theme</label>
        <select
          value={settings.theme}
          onChange={(e) =>
            updateSetting(
              "theme",
              e.target.value as AppSettings["theme"],
            )
          }
          className="mt-1 rounded border px-3 py-2"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Font Size</label>
        <input
          type="range"
          min={12}
          max={24}
          value={settings.font_size}
          onChange={(e) =>
            updateSetting("font_size", Number(e.target.value))
          }
        />
        <span className="ml-2">{settings.font_size}px</span>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.auto_save}
            onChange={(e) =>
              updateSetting("auto_save", e.target.checked)
            }
          />
          <span className="text-sm">Enable auto-save</span>
        </label>
      </div>
    </div>
  );
}

export default SettingsPanel;
```

### Jotai as an Alternative

Jotai takes an atomic approach — each piece of state is an independent atom. This is useful when different parts of your app need different slices of state:

```bash
npm install jotai
```

```typescript
// src/atoms/appAtoms.ts
import { atom } from "jotai";
import { invoke } from "@tauri-apps/api/core";

// Simple atoms — pure frontend state
export const sidebarOpenAtom = atom(true);
export const searchQueryAtom = atom("");

// Async atom — fetches from Rust backend
interface Project {
  id: string;
  name: string;
  path: string;
  last_opened: string;
}

export const projectsAtom = atom(async () => {
  return invoke<Project[]>("list_recent_projects");
});

// Writable derived atom — reads and writes to Rust
export const currentProjectAtom = atom<Project | null>(null);

export const openProjectAtom = atom(
  null, // write-only
  async (get, set, projectPath: string) => {
    const project = await invoke<Project>("open_project", {
      path: projectPath,
    });
    set(currentProjectAtom, project);
  },
);
```

```tsx
// src/components/ProjectSwitcher.tsx
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  projectsAtom,
  openProjectAtom,
  searchQueryAtom,
} from "@/atoms/appAtoms";
import { Suspense } from "react";

function ProjectList() {
  const projects = useAtomValue(projectsAtom);
  const openProject = useSetAtom(openProjectAtom);
  const [search, setSearch] = useAtom(searchQueryAtom);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search projects..."
        className="mb-4 w-full rounded border px-3 py-2"
      />
      <ul className="space-y-2">
        {filtered.map((project) => (
          <li key={project.id}>
            <button
              onClick={() => openProject(project.path)}
              className="w-full rounded p-3 text-left hover:bg-gray-100"
            >
              <div className="font-medium">{project.name}</div>
              <div className="text-sm text-gray-500">{project.path}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Suspense handles the loading state for async atoms
function ProjectSwitcher() {
  return (
    <Suspense fallback={<p>Loading projects...</p>}>
      <ProjectList />
    </Suspense>
  );
}

export default ProjectSwitcher;
```

### Syncing Frontend State with Rust Backend State

A common pattern is to listen for events from Rust to keep the frontend in sync:

```typescript
// src/stores/syncedStore.ts
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

interface DownloadProgress {
  file_name: string;
  bytes_downloaded: number;
  total_bytes: number;
  speed_bps: number;
}

interface DownloadStore {
  downloads: Map<string, DownloadProgress>;
  subscribe: () => Promise<UnlistenFn>;
  startDownload: (url: string) => Promise<void>;
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  downloads: new Map(),

  subscribe: async () => {
    // Listen for progress events emitted by Rust
    const unlisten = await listen<DownloadProgress>(
      "download-progress",
      (event) => {
        set((state) => {
          const downloads = new Map(state.downloads);
          downloads.set(event.payload.file_name, event.payload);
          return { downloads };
        });
      },
    );
    return unlisten;
  },

  startDownload: async (url: string) => {
    await invoke("start_download", { url });
  },
}));
```

**Using it in a component with proper cleanup:**

```tsx
// src/components/DownloadManager.tsx
import { useEffect } from "react";
import { useDownloadStore } from "@/stores/syncedStore";

function DownloadManager() {
  const { downloads, subscribe, startDownload } = useDownloadStore();

  useEffect(() => {
    // Subscribe returns a cleanup function
    const promise = subscribe();
    return () => {
      promise.then((unlisten) => unlisten());
    };
  }, [subscribe]);

  return (
    <div>
      <h3>Downloads</h3>
      {Array.from(downloads.values()).map((dl) => {
        const percent = Math.round(
          (dl.bytes_downloaded / dl.total_bytes) * 100,
        );
        return (
          <div key={dl.file_name} className="mb-2">
            <div className="flex justify-between text-sm">
              <span>{dl.file_name}</span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 w-full rounded bg-gray-200">
              <div
                className="h-full rounded bg-blue-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DownloadManager;
```

---

## 8. Environment Detection

### Detecting If Running in Tauri vs Browser

When you build a Tauri app, the global `window.__TAURI_INTERNALS__` object is injected into the webview. You can use this to detect the Tauri environment:

```typescript
// src/lib/platform.ts

/**
 * Returns true if the app is running inside a Tauri webview.
 * Returns false if running in a regular browser (e.g., during development
 * when you open http://localhost:1420 directly in Chrome).
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" &&
    window.__TAURI_INTERNALS__ !== undefined;
}

/**
 * Run a function only in Tauri context, with a fallback for browsers.
 */
export async function tauriOrFallback<T>(
  tauriFn: () => Promise<T>,
  browserFallback: T,
): Promise<T> {
  if (isTauri()) {
    return tauriFn();
  }
  return browserFallback;
}
```

### Type Declaration for `window.__TAURI_INTERNALS__`

To avoid TypeScript errors, extend the `Window` interface:

```typescript
// src/tauri-env.d.ts
declare global {
  interface Window {
    __TAURI_INTERNALS__?: Record<string, unknown>;
  }
}

export {};
```

### Conditional Features

Use the detection function to conditionally render features that only work inside Tauri:

```tsx
// src/components/FileMenu.tsx
import { isTauri } from "@/lib/platform";
import { invoke } from "@tauri-apps/api/core";

function FileMenu() {
  const handleSave = async () => {
    if (isTauri()) {
      // Use Rust backend to save to filesystem
      await invoke("save_file", {
        path: "/home/user/document.txt",
        content: "Hello, World!",
      });
    } else {
      // Browser fallback: download as a file
      const blob = new Blob(["Hello, World!"], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "document.txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="menu">
      <button onClick={handleSave}>Save</button>

      {/* Only show "System Info" when running in Tauri */}
      {isTauri() && (
        <button onClick={() => invoke("show_system_info")}>
          System Info
        </button>
      )}
    </div>
  );
}

export default FileMenu;
```

### A Platform-Aware Hook

```typescript
// src/hooks/usePlatform.ts
import { useState, useEffect } from "react";
import { isTauri } from "@/lib/platform";

type Platform = "macos" | "windows" | "linux" | "browser";

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>("browser");

  useEffect(() => {
    if (isTauri()) {
      import("@tauri-apps/api/os").then(async (os) => {
        const type = await os.type();
        switch (type) {
          case "macos":
            setPlatform("macos");
            break;
          case "windows":
            setPlatform("windows");
            break;
          default:
            setPlatform("linux");
        }
      });
    }
  }, []);

  return platform;
}
```

**Using platform info for conditional rendering:**

```tsx
import { usePlatform } from "@/hooks/usePlatform";

function KeyboardShortcutHint({ action }: { action: string }) {
  const platform = usePlatform();
  const modKey = platform === "macos" ? "\u2318" : "Ctrl";

  const shortcuts: Record<string, string> = {
    save: `${modKey}+S`,
    open: `${modKey}+O`,
    quit: platform === "macos" ? `${modKey}+Q` : `${modKey}+W`,
  };

  return (
    <kbd className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
      {shortcuts[action] || "?"}
    </kbd>
  );
}
```

---

## 9. Hot Module Replacement

### How HMR Works with Tauri Dev

When you run `cargo tauri dev`, two things happen in parallel:

1. Vite starts its dev server at `http://localhost:1420` with HMR enabled.
2. Tauri compiles and runs the Rust backend, then opens a webview pointed at the Vite dev server.

HMR works through the Vite dev server's WebSocket connection. When you edit a React component, Vite detects the change, compiles only the modified module, and pushes the update to the webview over WebSocket. React's fast refresh then swaps the component in place without losing state.

**The development workflow:**

```
Edit .tsx file
    → Vite detects change (~10ms)
    → Compiles updated module (~50ms)
    → Sends update via WebSocket
    → React Fast Refresh swaps component
    → You see the change (~200ms total)

Edit .rs file
    → Cargo detects change
    → Recompiles Rust (~2-30s depending on change)
    → Tauri restarts the backend
    → Webview reconnects
    → Full page reload
```

Frontend changes are near-instant. Rust changes require a recompilation, which is slower but still automatic.

### Vite Config for Optimal DX

The following configuration optimizes the development experience:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => ({
  plugins: [react()],

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 1421,
    },
    // Watch options to reduce CPU usage
    watch: {
      // Ignore Rust source files — Cargo handles those
      ignored: ["**/src-tauri/**"],
    },
  },

  // Optimize dependency pre-bundling
  optimizeDeps: {
    // Pre-bundle these packages for faster page loads
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tauri-apps/api",
    ],
    // Exclude packages that should not be pre-bundled
    exclude: [],
  },

  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : "safari14",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },

  // CSS configuration
  css: {
    // Enable CSS modules for .module.css files
    modules: {
      localsConvention: "camelCaseOnly",
    },
    devSourcemap: true,
  },
}));
```

**Key settings explained:**

- `server.watch.ignored: ["**/src-tauri/**"]` — Vite does not need to watch Rust files. Cargo has its own file watcher. Without this, Vite wastes CPU cycles processing `.rs` file changes it cannot act on.
- `optimizeDeps.include` — tells Vite to pre-bundle heavy dependencies. The first page load in development is faster because Vite does not need to process these packages on the fly.
- `css.modules.localsConvention: "camelCaseOnly"` — lets you write `.my-class` in CSS and use `styles.myClass` in TypeScript.
- `css.devSourcemap: true` — CSS sourcemaps make debugging styles in the webview's DevTools easier.

### Troubleshooting HMR Issues

Sometimes HMR stops working in the Tauri webview. Common causes:

**1. WebSocket port conflict:**

If port 1421 is taken, HMR cannot establish the WebSocket connection. Change both the `hmr.port` in `vite.config.ts` and ensure nothing else is using it.

**2. Full-page reloads instead of HMR:**

This happens when you edit a file that is not a React component (e.g., a utility module imported at the top level). The fix is structural: keep side-effect-free utilities separate from components.

**3. State loss on HMR:**

React Fast Refresh preserves state for function components using hooks, but it cannot preserve state when:
- The component file exports non-component values.
- The component uses class components.
- The hook call order changes between updates.

```tsx
// This file will NOT get fast refresh because it exports a non-component
export const API_URL = "http://localhost:3000"; // non-component export
export default function App() {
  return <div>Hello</div>;
}

// Fix: move constants to a separate file
// src/lib/constants.ts
export const API_URL = "http://localhost:3000";

// src/App.tsx
import { API_URL } from "@/lib/constants";
export default function App() {
  return <div>Hello</div>;
}
```

### Opening DevTools Automatically

During development, you may want DevTools to open automatically. Configure this in `src-tauri/tauri.conf.json`:

```json
{
  "app": {
    "windows": [
      {
        "title": "My App",
        "width": 1200,
        "height": 800
      }
    ]
  }
}
```

Then in Rust, open DevTools programmatically during development:

```rust
// src-tauri/src/lib.rs
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 10. Coding Challenges

### Challenge 1: Build a Tauri Command Dashboard

**Description:**
Create a React dashboard that calls multiple Tauri commands and displays the results. This exercise practices the `useInvoke` hook pattern and composing multiple async data sources in a single UI.

**Requirements:**
- Create at least three Rust commands: `get_system_info`, `get_disk_usage`, and `get_uptime`.
- Build a `useInvoke` hook (or use the one from this module) to call each command.
- Display the results in a dashboard layout with three separate cards/panels.
- Each panel should handle its own loading, error, and success states independently.
- Add a "Refresh All" button that re-fetches every panel simultaneously.

**Hints:**
- Start with the Rust commands returning hardcoded data. You can make them call real system APIs later.
- Your `useInvoke` hook returns a `refetch` function — store all three in the parent component and call them together for "Refresh All."
- Use `Promise.allSettled()` if you want to refresh all panels even if one fails.

---

### Challenge 2: Settings Page with Rust Persistence

**Description:**
Build a settings page that reads preferences from Rust on load, allows the user to modify them, and persists changes back to Rust. This practices the Zustand store pattern with optimistic updates and rollback.

**Requirements:**
- Create a `Settings` struct in Rust with at least four fields: `theme` (string), `font_size` (number), `notifications_enabled` (boolean), and `language` (string).
- Implement `get_settings` and `update_settings` Tauri commands. Store settings in memory (a `Mutex<Settings>`).
- Create a Zustand store that loads settings on app start, applies optimistic updates when the user changes a setting, and rolls back if the Rust command fails.
- Build form controls (select, slider, checkbox, dropdown) for each setting.
- Show a toast or status message when settings are saved or when an error occurs.

**Hints:**
- Use `tauri::State<Mutex<Settings>>` to manage settings in Rust. You covered this in Module 02.
- For the optimistic update pattern, save the previous state before calling `invoke`, then restore it in the `catch` block.
- Consider debouncing the slider input so you do not invoke the Rust command on every pixel of slider movement.

---

### Challenge 3: Dual-Mode App (Tauri + Browser)

**Description:**
Build a note-taking component that works in both a Tauri desktop app and a regular browser. When running in Tauri, notes are saved to the filesystem via Rust. When running in a browser, notes are saved to `localStorage`. This practices environment detection and the adapter pattern.

**Requirements:**
- Create a `NoteStorage` interface with `save(note: Note)`, `load(id: string)`, and `list()` methods.
- Implement `TauriNoteStorage` (uses `invoke`) and `BrowserNoteStorage` (uses `localStorage`).
- Use the `isTauri()` detection function to select the right implementation at startup.
- Build a simple note editor with a list of saved notes, a text area for editing, and save/delete buttons.
- The component code should be identical regardless of which storage backend is active.

**Hints:**
- Define the `NoteStorage` interface as a TypeScript interface, then create two classes that implement it.
- Use React Context to provide the storage implementation to all components: `<StorageProvider storage={isTauri() ? new TauriNoteStorage() : new BrowserNoteStorage()}>`.
- For `BrowserNoteStorage`, `JSON.parse(localStorage.getItem("notes") || "[]")` is a simple way to load all notes.
- The Rust side needs `save_note`, `load_note`, and `list_notes` commands that read/write to a JSON file in the app data directory.

---

### Challenge 4: Real-Time Progress Tracker

**Description:**
Build a component that starts a long-running Rust task and displays real-time progress. This practices the event-based communication pattern between Rust and React, which is essential for operations like file processing, downloads, or database migrations.

**Requirements:**
- Create a Rust command `start_processing` that simulates a long task (loop with `std::thread::sleep`) and emits progress events using `app.emit("processing-progress", payload)`.
- The progress event payload should include: `current_step` (number), `total_steps` (number), `message` (string), and `percent` (number).
- Build a React component with a "Start" button, a progress bar, a step counter, and a log of status messages.
- Use Tauri's `listen()` function in a `useEffect` with proper cleanup (call the unlisten function on unmount).
- Disable the "Start" button while processing is in progress.

**Hints:**
- On the Rust side, spawn the work on a separate thread with `std::thread::spawn` so you do not block the main thread.
- The `app.emit()` function requires a `tauri::AppHandle`, which you can get by adding `app: tauri::AppHandle` as a parameter to your command.
- Remember to clean up the event listener: `listen()` returns a Promise that resolves to an unlisten function. Store it and call it in the `useEffect` cleanup.
- Use `useState` for the progress data and append each message to an array for the log display.

---

### Challenge 5: Hash Router with Persistent Navigation State

**Description:**
Build a multi-page Tauri app with React Router that remembers which page the user was on when they closed the app. On next launch, the app navigates directly to the last-viewed page. This combines routing, environment detection, and Rust persistence.

**Requirements:**
- Set up `HashRouter` with at least four routes: Home, Projects, Editor, and Settings.
- Create a sidebar navigation with `NavLink` components that highlight the active route.
- On every route change, save the current path to Rust via a `save_last_route` command.
- On app startup, call `get_last_route` and programmatically navigate to the saved route.
- If running in a browser (not Tauri), fall back to `sessionStorage` for persistence.
- Handle the case where the saved route no longer exists (navigate to Home as a default).

**Hints:**
- Use `useLocation()` from React Router to watch for route changes. Combine it with `useEffect` to trigger the save.
- Use `useNavigate()` to programmatically navigate on startup.
- The Rust side can store the route in a simple text file in the app's data directory, or in a `Mutex<String>` for simplicity.
- Debounce the save operation — if the user clicks through routes quickly, you do not want to invoke Rust on every single navigation.
- Check `isTauri()` before calling `invoke` to keep the browser fallback working.
