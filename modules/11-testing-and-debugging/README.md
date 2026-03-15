# Module 11: Testing and Debugging Tauri Applications

## Overview

Testing a Tauri application involves three layers:
1. **Rust unit tests** — test backend logic in isolation
2. **Frontend unit tests** — test React components and hooks
3. **E2E tests** — test the full app through the webview

This module covers all three, plus debugging techniques for both the Rust and frontend sides.

---

## 1. Testing Strategy

Think of your Tauri app as two separate apps that communicate:

```
┌─────────────────────────────────────────┐
│  Frontend (React)                       │
│  → Unit test with Vitest                │
│  → Mock Tauri APIs                      │
├─────────────────────────────────────────┤
│  IPC Bridge                             │
│  → E2E test with WebDriver             │
├─────────────────────────────────────────┤
│  Backend (Rust)                         │
│  → Unit test with cargo test            │
│  → Test commands in isolation           │
└─────────────────────────────────────────┘
```

**Rule of thumb**: Test business logic in Rust unit tests. Test UI behavior in Vitest. Test integration with E2E tests sparingly.

---

## 2. Rust Unit Tests

Rust has a built-in test framework. Tests live in the same file as the code they test.

### Basic Test Structure

```rust
// src-tauri/src/lib.rs

// Your application code
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn is_valid_username(name: &str) -> bool {
    !name.is_empty() && name.len() <= 32 && name.chars().all(|c| c.is_alphanumeric() || c == '_')
}

// Tests module — only compiled when running tests
#[cfg(test)]
mod tests {
    use super::*; // Import everything from the parent module

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
        assert_eq!(add(-1, 1), 0);
        assert_eq!(add(0, 0), 0);
    }

    #[test]
    fn test_valid_username() {
        assert!(is_valid_username("alice"));
        assert!(is_valid_username("bob_123"));
        assert!(!is_valid_username(""));
        assert!(!is_valid_username("a".repeat(33).as_str()));
        assert!(!is_valid_username("hello world")); // spaces not allowed
    }

    #[test]
    #[should_panic(expected = "divide by zero")]
    fn test_divide_by_zero() {
        let _ = 1 / 0; // This will panic
    }
}
```

Run tests:

```bash
# Run all tests
cd src-tauri && cargo test

# Run tests with output
cargo test -- --nocapture

# Run a specific test
cargo test test_valid_username

# Run tests matching a pattern
cargo test username
```

### Testing Tauri Commands

You can test your command logic by extracting it from the command handler:

```rust
// src-tauri/src/commands.rs

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct TodoItem {
    pub id: u32,
    pub title: String,
    pub completed: bool,
}

// Extract business logic into a testable function
pub fn filter_todos(todos: &[TodoItem], show_completed: bool) -> Vec<&TodoItem> {
    todos.iter()
        .filter(|t| show_completed || !t.completed)
        .collect()
}

pub fn validate_title(title: &str) -> Result<String, String> {
    let trimmed = title.trim().to_string();
    if trimmed.is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    if trimmed.len() > 200 {
        return Err("Title too long (max 200 characters)".to_string());
    }
    Ok(trimmed)
}

// The Tauri command calls the business logic
#[tauri::command]
pub fn create_todo(title: String) -> Result<TodoItem, String> {
    let validated_title = validate_title(&title)?;
    Ok(TodoItem {
        id: 1, // In reality, generate proper IDs
        title: validated_title,
        completed: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_todos() -> Vec<TodoItem> {
        vec![
            TodoItem { id: 1, title: "Buy groceries".into(), completed: false },
            TodoItem { id: 2, title: "Walk dog".into(), completed: true },
            TodoItem { id: 3, title: "Write code".into(), completed: false },
        ]
    }

    #[test]
    fn test_filter_todos_all() {
        let todos = sample_todos();
        let result = filter_todos(&todos, true);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_filter_todos_incomplete_only() {
        let todos = sample_todos();
        let result = filter_todos(&todos, false);
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|t| !t.completed));
    }

    #[test]
    fn test_validate_title_valid() {
        assert_eq!(validate_title("Hello").unwrap(), "Hello");
        assert_eq!(validate_title("  Hello  ").unwrap(), "Hello"); // trims whitespace
    }

    #[test]
    fn test_validate_title_empty() {
        assert!(validate_title("").is_err());
        assert!(validate_title("   ").is_err());
    }

    #[test]
    fn test_validate_title_too_long() {
        let long_title = "a".repeat(201);
        assert!(validate_title(&long_title).is_err());
    }

    #[test]
    fn test_create_todo_success() {
        let result = create_todo("Buy milk".to_string());
        assert!(result.is_ok());
        let todo = result.unwrap();
        assert_eq!(todo.title, "Buy milk");
        assert!(!todo.completed);
    }

    #[test]
    fn test_create_todo_empty_title() {
        let result = create_todo("".to_string());
        assert!(result.is_err());
    }
}
```

### Testing with State (Mocking Managed State)

Testing commands that use `State<T>` requires extracting logic:

```rust
use std::sync::Mutex;

pub struct AppState {
    pub counter: Mutex<i32>,
}

// Business logic — easily testable
pub fn increment_counter(current: i32) -> i32 {
    current + 1
}

// Tauri command — thin wrapper around business logic
#[tauri::command]
pub fn increment(state: tauri::State<AppState>) -> i32 {
    let mut counter = state.counter.lock().unwrap();
    *counter = increment_counter(*counter);
    *counter
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_increment_counter() {
        assert_eq!(increment_counter(0), 1);
        assert_eq!(increment_counter(41), 42);
        assert_eq!(increment_counter(-1), 0);
    }

    #[test]
    fn test_app_state_directly() {
        let state = AppState {
            counter: Mutex::new(0),
        };

        {
            let mut counter = state.counter.lock().unwrap();
            *counter = increment_counter(*counter);
        }

        assert_eq!(*state.counter.lock().unwrap(), 1);
    }
}
```

### Integration Tests

Place integration tests in `src-tauri/tests/`:

```rust
// src-tauri/tests/integration_test.rs
use tauri_react_starter_lib::commands::*;

#[test]
fn test_full_todo_workflow() {
    // Create
    let todo = create_todo("Test todo".to_string()).unwrap();
    assert_eq!(todo.title, "Test todo");
    assert!(!todo.completed);

    // Filter
    let todos = vec![todo];
    let active = filter_todos(&todos, false);
    assert_eq!(active.len(), 1);
}
```

---

## 3. Frontend Testing with Vitest

### Setup

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

`vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

`src/test/setup.ts`:

```typescript
import "@testing-library/jest-dom";

// Mock the Tauri API globally
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));
```

### Mocking Tauri APIs

Create a reusable mock helper:

```typescript
// src/test/tauri-mock.ts
import { vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

const mockedInvoke = vi.mocked(invoke);

/**
 * Mock a Tauri command to return a specific value.
 *
 * Usage:
 *   mockCommand("greet", "Hello, World!");
 *   mockCommand("get_todos", [{ id: 1, title: "Test" }]);
 */
export function mockCommand<T>(command: string, returnValue: T) {
  mockedInvoke.mockImplementation(async (cmd: string) => {
    if (cmd === command) return returnValue;
    throw new Error(`Unexpected command: ${cmd}`);
  });
}

/**
 * Mock a Tauri command to throw an error.
 */
export function mockCommandError(command: string, error: string) {
  mockedInvoke.mockImplementation(async (cmd: string) => {
    if (cmd === command) throw new Error(error);
    throw new Error(`Unexpected command: ${cmd}`);
  });
}

/**
 * Mock multiple commands at once.
 */
export function mockCommands(mocks: Record<string, unknown>) {
  mockedInvoke.mockImplementation(async (cmd: string) => {
    if (cmd in mocks) return mocks[cmd];
    throw new Error(`Unexpected command: ${cmd}`);
  });
}

export { mockedInvoke };
```

### Testing Components

```typescript
// src/components/__tests__/GreetForm.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import GreetPage from "../../pages/GreetPage";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("GreetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form", () => {
    render(<GreetPage />);
    expect(screen.getByPlaceholderText(/enter your name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /greet/i })).toBeInTheDocument();
  });

  it("calls greet command and displays result", async () => {
    mockedInvoke.mockResolvedValueOnce("Hello, Alice!");

    render(<GreetPage />);

    const input = screen.getByPlaceholderText(/enter your name/i);
    const button = screen.getByRole("button", { name: /greet/i });

    fireEvent.change(input, { target: { value: "Alice" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Hello, Alice!")).toBeInTheDocument();
    });

    expect(mockedInvoke).toHaveBeenCalledWith("greet", { name: "Alice" });
  });

  it("displays error on command failure", async () => {
    mockedInvoke.mockRejectedValueOnce(new Error("Backend error"));

    render(<GreetPage />);

    const input = screen.getByPlaceholderText(/enter your name/i);
    const button = screen.getByRole("button", { name: /greet/i });

    fireEvent.change(input, { target: { value: "Alice" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

### Testing Custom Hooks

```typescript
// src/hooks/__tests__/useInvoke.test.ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useInvoke } from "../useInvoke";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("useInvoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with initial state", () => {
    const { result } = renderHook(() => useInvoke<string>("test_cmd"));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles successful invocation", async () => {
    mockedInvoke.mockResolvedValueOnce("success!");

    const { result } = renderHook(() => useInvoke<string>("test_cmd"));

    await act(async () => {
      await result.current.execute({ key: "value" });
    });

    expect(result.current.data).toBe("success!");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockedInvoke).toHaveBeenCalledWith("test_cmd", { key: "value" });
  });

  it("handles errors", async () => {
    mockedInvoke.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useInvoke<string>("test_cmd"));

    await act(async () => {
      try {
        await result.current.execute();
      } catch {
        // expected
      }
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error?.message).toBe("fail");
  });
});
```

### Testing Zustand Stores

```typescript
// src/lib/__tests__/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useCounterStore } from "../store";

describe("counterStore", () => {
  beforeEach(() => {
    // Reset store state between tests
    useCounterStore.setState({ count: 0 });
  });

  it("starts at 0", () => {
    expect(useCounterStore.getState().count).toBe(0);
  });

  it("increments", () => {
    useCounterStore.getState().increment();
    expect(useCounterStore.getState().count).toBe(1);
  });

  it("decrements", () => {
    useCounterStore.getState().decrement();
    expect(useCounterStore.getState().count).toBe(-1);
  });

  it("resets", () => {
    useCounterStore.getState().increment();
    useCounterStore.getState().increment();
    useCounterStore.getState().reset();
    expect(useCounterStore.getState().count).toBe(0);
  });
});
```

---

## 4. E2E Testing with WebDriver

Tauri provides `tauri-driver` for WebDriver-based E2E testing.

### Setup

```bash
# Install tauri-driver
cargo install tauri-driver

# Install WebdriverIO
npm install -D @wdio/cli @wdio/local-runner @wdio/mocha-framework @wdio/spec-reporter
```

### WebdriverIO Config

```javascript
// wdio.conf.js
const path = require("path");

exports.config = {
  specs: ["./test/e2e/**/*.test.js"],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application: path.resolve(
          "./src-tauri/target/release/tauri-react-starter"
        ),
      },
    },
  ],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },

  // Automatically start tauri-driver
  beforeSession: function () {
    const cp = require("child_process");
    this.tauriDriver = cp.spawn("tauri-driver", [], {
      stdio: [null, process.stdout, process.stderr],
    });
  },
  afterSession: function () {
    this.tauriDriver.kill();
  },
  hostname: "localhost",
  port: 4444,
};
```

### E2E Test Example

```javascript
// test/e2e/app.test.js
describe("Tauri App", () => {
  it("should display the welcome message", async () => {
    const header = await $("h2");
    const text = await header.getText();
    expect(text).toBe("Welcome to Tauri + React");
  });

  it("should navigate to greet page", async () => {
    const greetLink = await $('a[href="#/greet"]');
    await greetLink.click();

    const header = await $("h2");
    const text = await header.getText();
    expect(text).toBe("Greet Example");
  });

  it("should greet the user", async () => {
    const input = await $('input[placeholder*="name"]');
    await input.setValue("TestUser");

    const button = await $("button=Greet");
    await button.click();

    // Wait for the response
    const result = await $(".text-green-700");
    await result.waitForExist({ timeout: 5000 });
    const text = await result.getText();
    expect(text).toContain("TestUser");
  });
});
```

---

## 5. Debugging the Rust Backend

### println! Debugging

The simplest approach — prints show in the terminal where `cargo tauri dev` runs:

```rust
#[tauri::command]
fn process_data(input: String) -> Result<String, String> {
    println!("DEBUG: process_data called with input: {:?}", input);

    let result = input.to_uppercase();
    println!("DEBUG: result = {:?}", result);

    Ok(result)
}
```

### Using the `tracing` Crate

More structured logging for production use:

```toml
# Cargo.toml
[dependencies]
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

```rust
use tracing::{info, warn, error, debug, instrument};

// The #[instrument] macro automatically logs function entry/exit
#[instrument]
#[tauri::command]
fn process_data(input: String) -> Result<String, String> {
    info!("Processing data");
    debug!(input_length = input.len(), "Input details");

    if input.is_empty() {
        warn!("Empty input received");
        return Err("Input cannot be empty".to_string());
    }

    let result = input.to_uppercase();
    info!(result_length = result.len(), "Processing complete");
    Ok(result)
}

// In your main setup:
pub fn run() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("debug") // or use RUST_LOG env var
        .init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![process_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Using tauri-plugin-log

Unified logging for both frontend and backend:

```toml
# Cargo.toml
[dependencies]
tauri-plugin-log = "2"
log = "0.4"
```

```rust
use log::{info, warn, error};

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                ))
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir { file_name: None },
                ))
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Frontend:

```typescript
import { info, warn, error, debug } from "@tauri-apps/plugin-log";

// These log to the same output as Rust logs!
await info("User clicked button");
await debug("Form data: " + JSON.stringify(data));
await error("Failed to load: " + err.message);
```

### VS Code Debugging (Breakpoints)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Debug Tauri (Rust)",
      "cargo": {
        "args": [
          "build",
          "--manifest-path=./src-tauri/Cargo.toml",
          "--no-default-features"
        ]
      },
      "preLaunchTask": "npm: dev"
    }
  ]
}
```

This requires the **CodeLLDB** extension for VS Code. You can then set breakpoints in Rust code and step through execution.

---

## 6. Debugging the Frontend

### DevTools

In development mode, Tauri apps have DevTools built in:

- **macOS**: `Cmd + Shift + I` or `Cmd + Option + I`
- **Windows/Linux**: `F12` or `Ctrl + Shift + I`

You get the full Chrome DevTools experience:
- Console for logs
- Network tab for IPC calls
- Elements inspector
- React DevTools (if installed as browser extension — see below)

### React DevTools

React DevTools doesn't work as a browser extension in Tauri. Instead, use the standalone version:

```bash
# Install standalone React DevTools
npx react-devtools
```

Then add this to your `index.html` in development:

```html
<script src="http://localhost:8097"></script>
```

### Console Logging with Context

```typescript
// A helper for structured console logging in development
const isDev = import.meta.env.DEV;

export function devLog(context: string, data?: unknown) {
  if (isDev) {
    console.log(`[${context}]`, data ?? "");
  }
}

// Usage
devLog("GreetPage", { action: "submit", name });
devLog("useInvoke", { command: "greet", status: "loading" });
```

---

## 7. Common Errors and Solutions

### Rust Compilation Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `cannot find value 'xxx'` | Typo or missing import | Check spelling, add `use` statement |
| `borrowed value does not live long enough` | Ownership issue | Clone the value or restructure code |
| `cannot borrow as mutable` | Missing `mut` or borrow conflict | Add `mut`, check for simultaneous borrows |
| `mismatched types` | Wrong type | Check function signatures, use `.into()` or `as` |
| `unresolved import` | Missing dependency or wrong path | Check Cargo.toml, check `mod` declarations |

### Tauri-Specific Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `command xxx not found` | Command not registered | Add to `generate_handler![]` |
| `invalid args for command` | Serialization mismatch | Check argument names match between frontend and Rust |
| `permission denied` | Missing capability | Add permission to capabilities JSON |
| `window not found` | Wrong window label | Check window labels in tauri.conf.json |
| `failed to deserialize` | JSON structure mismatch | Ensure Rust struct matches JSON, use `#[serde(rename_all = "camelCase")]` |

### IPC Serialization Issues

The most common gotcha — argument names must match exactly:

```rust
// Rust command
#[tauri::command]
fn greet(name: String) -> String {  // parameter is "name"
    format!("Hello, {name}!")
}
```

```typescript
// Frontend — argument key must match "name"
await invoke("greet", { name: "Alice" });  // correct
await invoke("greet", { user: "Alice" });  // WRONG — will error
```

### Debug Checklist

When something isn't working:

1. Check the terminal running `cargo tauri dev` for Rust errors
2. Open DevTools (F12) and check the Console for frontend errors
3. Verify command names match between Rust and frontend
4. Verify argument names and types match
5. Check capabilities/permissions if using plugins
6. Run `cargo tauri info` to verify your environment
7. Try `cargo clean` and rebuild if compilation is weird

---

## 8. Performance Profiling

### Measuring Startup Time

```rust
use std::time::Instant;

pub fn run() {
    let start = Instant::now();

    tauri::Builder::default()
        .setup(|_app| {
            let elapsed = start.elapsed();
            println!("App setup completed in {:?}", elapsed);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Frontend Performance

```typescript
// Measure invoke round-trip time
async function measureInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const start = performance.now();
  const result = await invoke<T>(command, args);
  const elapsed = performance.now() - start;
  console.log(`invoke("${command}") took ${elapsed.toFixed(2)}ms`);
  return result;
}
```

### Rust Profiling

```toml
# Cargo.toml — enable debug info in release for profiling
[profile.release]
debug = true  # Temporarily enable for profiling
```

```bash
# Use cargo-flamegraph for flame graphs
cargo install flamegraph
cargo flamegraph --bin tauri-react-starter
```

---

## 9. VS Code Recommended Setup

### Extensions

- **rust-analyzer** — Rust language server (essential)
- **CodeLLDB** — Rust debugger
- **Even Better TOML** — Cargo.toml syntax
- **Error Lens** — Inline error display
- **Tauri** — Tauri-specific helpers

### settings.json

```json
{
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.check.command": "clippy",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer",
    "editor.formatOnSave": true
  }
}
```

### tasks.json

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Tauri Dev",
      "type": "shell",
      "command": "cargo tauri dev",
      "group": "build",
      "isBackground": true,
      "problemMatcher": []
    },
    {
      "label": "Rust Tests",
      "type": "shell",
      "command": "cd src-tauri && cargo test",
      "group": "test"
    },
    {
      "label": "Frontend Tests",
      "type": "shell",
      "command": "npx vitest run",
      "group": "test"
    }
  ]
}
```

---

## 10. Continuous Integration Testing

### GitHub Actions for Tests

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test-rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri
      - name: Install system deps
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev
      - name: Run Rust tests
        run: cd src-tauri && cargo test

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
      - run: npm install
      - run: npx vitest run
```

---

## Coding Challenges

### Challenge 1: Test a Todo CRUD Module

**Description**: Create a Rust module with functions for creating, reading, updating, and deleting todo items stored in a `Vec`. Write comprehensive tests for all operations.

**Requirements**:
- `create_todo(title: &str) -> Result<Todo, String>` — validates title (non-empty, max 200 chars)
- `get_todo(todos: &[Todo], id: u32) -> Option<&Todo>`
- `toggle_todo(todos: &mut [Todo], id: u32) -> Result<(), String>`
- `delete_todo(todos: &mut Vec<Todo>, id: u32) -> Result<(), String>`
- At least 10 test cases covering happy paths and error cases

**Hints**:
- Use `#[cfg(test)] mod tests { ... }` for the test module
- Test edge cases: empty title, duplicate IDs, non-existent ID
- Use `assert!(result.is_err())` for error cases

### Challenge 2: Mock and Test a React Component

**Description**: Create a React component that displays a list of files from a Tauri command and allows deleting them. Write tests with mocked Tauri APIs.

**Requirements**:
- Component calls `invoke("list_files")` on mount
- Shows loading spinner while fetching
- Displays file list with delete buttons
- Delete button calls `invoke("delete_file", { path })` and removes from list
- Write at least 5 tests covering: loading state, display, delete, error handling

**Hints**:
- Use `vi.mock("@tauri-apps/api/core")` to mock invoke
- Use `waitFor` for async assertions
- Mock different return values with `mockResolvedValueOnce`

### Challenge 3: Debug a Broken Command

**Description**: Given this intentionally buggy code, find and fix all the issues:

```rust
#[tauri::command]
fn calculate(operation: String, a: String, b: String) -> String {
    let x = a.parse::<f64>().unwrap();
    let y = b.parse::<f64>().unwrap();

    match operation.as_str() {
        "add" => (x + y).to_string(),
        "subtract" => (x - y).to_string(),
        "multiply" => (x * y).to_string(),
        "divide" => (x / y).to_string(),
        _ => "unknown".to_string(),
    }
}
```

```typescript
const result = await invoke("calculate", {
  op: "divide",
  a: "10",
  b: "0",
});
```

**Requirements**:
- Fix the unwrap panics (use proper error handling)
- Fix the argument name mismatch
- Handle division by zero
- Return `Result<String, String>` instead of `String`
- Write tests for all operations including error cases

**Hints**:
- Parameter names in Rust and TypeScript must match exactly
- Use `parse::<f64>().map_err(|e| e.to_string())?`
- Check for zero before dividing

### Challenge 4: Build a Test Dashboard

**Description**: Create a React component that shows the health status of your Tauri app by calling multiple diagnostic commands.

**Requirements**:
- Call `invoke("get_version")`, `invoke("get_uptime")`, `invoke("check_database")` on mount
- Show each status with a green/red indicator
- Handle partial failures (one command fails but others succeed)
- Auto-refresh every 30 seconds
- Write tests for: all success, partial failure, all failure, refresh cycle

**Hints**:
- Use `Promise.allSettled()` to handle partial failures
- Use `vi.useFakeTimers()` to test the refresh interval
- Clean up intervals in `useEffect` return function

### Challenge 5: Performance Benchmark Suite

**Description**: Create a Rust benchmark module that measures the performance of different data operations and reports results to the frontend.

**Requirements**:
- Benchmark sorting 10,000 items (Vec::sort vs sort_unstable)
- Benchmark HashMap vs BTreeMap lookups
- Benchmark String concatenation vs format! macro
- Return timing results to the frontend as structured data
- Display results in a React chart or table

**Hints**:
- Use `std::time::Instant` for timing
- Run each benchmark multiple times and average
- Use `#[tauri::command]` to expose benchmarks
- Consider running benchmarks in async commands to not block the UI
