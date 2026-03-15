# Module 04: Commands and State Management

Commands are the bridge between your React frontend and your Rust backend. Every meaningful Tauri app relies on them: the frontend calls a command, Rust executes logic (reading files, querying a database, performing calculations), and returns a result. State management lets you share data across those commands — a database connection pool, user settings, application configuration — without passing everything around manually.

This module covers commands from basic to advanced and builds up a practical understanding of managed state.

---

## Table of Contents

1. [Tauri Commands](#1-tauri-commands)
2. [Command Arguments](#2-command-arguments)
3. [Return Values](#3-return-values)
4. [Async Commands](#4-async-commands)
5. [Managed State](#5-managed-state)
6. [State Patterns](#6-state-patterns)
7. [Command Context](#7-command-context)
8. [Validation and Error Handling](#8-validation-and-error-handling)
9. [Coding Challenges](#9-coding-challenges)

---

## 1. Tauri Commands

A Tauri command is a Rust function annotated with `#[tauri::command]` that can be called from your frontend JavaScript/TypeScript code via `invoke()`.

### Defining a Basic Command

```rust
// src-tauri/src/lib.rs

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Tauri.", name)
}
```

That is a complete command. The `#[tauri::command]` macro handles all the serialization plumbing — it reads the arguments from the frontend's JSON payload, calls your function, and serializes the return value back to JSON.

### Registering Commands

Defining a command does nothing until you register it. You do this with `invoke_handler` in your app builder:

```rust
// src-tauri/src/lib.rs

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[tauri::command]
fn get_version() -> &'static str {
    "1.0.0"
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, get_version])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

The `generate_handler!` macro accepts a comma-separated list of command function names. If you forget to list a command here, the frontend call will fail with an "unknown command" error — this is the most common mistake when starting out.

### Naming Conventions

Tauri automatically converts Rust's `snake_case` function names to `camelCase` for the frontend. This means:

| Rust function name | Frontend invoke name |
|---|---|
| `greet` | `"greet"` |
| `get_user_data` | `"getUserData"` |
| `save_file_to_disk` | `"saveFileToDisk"` |

You can override this with the `rename_all` attribute if you prefer to keep snake_case on the frontend:

```rust
#[tauri::command(rename_all = "snake_case")]
fn get_user_data() -> String {
    "data".into()
}
// Frontend: invoke("get_user_data")
```

### Calling from React

```tsx
// src/App.tsx
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

function App() {
  const [greeting, setGreeting] = useState("");

  async function handleGreet() {
    // The function name is camelCase on the frontend
    const result = await invoke<string>("greet", { name: "Alice" });
    setGreeting(result);
  }

  return (
    <div>
      <button onClick={handleGreet}>Greet</button>
      <p>{greeting}</p>
    </div>
  );
}

export default App;
```

The `invoke` function is generic in TypeScript — `invoke<string>(...)` tells TypeScript the return type. The second argument is an object whose keys must match the Rust function's parameter names exactly.

---

## 2. Command Arguments

### Primitive Types

Commands accept any type that implements `serde::Deserialize`. All the common types work out of the box:

```rust
#[tauri::command]
fn calculate_bmi(weight_kg: f64, height_m: f64) -> f64 {
    weight_kg / (height_m * height_m)
}
```

```tsx
const bmi = await invoke<number>("calculateBmi", {
  weightKg: 75.0,
  heightM: 1.80,
});
```

Note how `weight_kg` becomes `weightKg` in the frontend — arguments follow the same snake_case-to-camelCase conversion.

### String Arguments

You can accept strings as `String` (owned) or `&str` (borrowed):

```rust
#[tauri::command]
fn count_words(text: &str) -> usize {
    text.split_whitespace().count()
}
```

```tsx
const count = await invoke<number>("countWords", {
  text: "Tauri is a great framework",
});
// count === 5
```

Use `&str` when you only need to read the string. Use `String` when you need ownership (storing it, returning it, moving it into a thread).

### Complex Objects with Serde

For structured data, define a struct that derives `Serialize` and `Deserialize`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TodoItem {
    pub id: Option<u32>,
    pub title: String,
    pub completed: bool,
    pub priority: Priority,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Medium,
    High,
}

#[tauri::command]
fn create_todo(item: TodoItem) -> TodoItem {
    TodoItem {
        id: Some(1), // In a real app, this comes from a database
        ..item
    }
}
```

```tsx
// src/types.ts
interface TodoItem {
  id?: number;
  title: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
}

// src/App.tsx
const newTodo = await invoke<TodoItem>("createTodo", {
  item: {
    title: "Learn Tauri commands",
    completed: false,
    priority: "high",
  },
});
console.log(newTodo.id); // 1
```

### Vectors and Collections

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ScoreEntry {
    pub name: String,
    pub score: u32,
}

#[tauri::command]
fn sort_scores(mut entries: Vec<ScoreEntry>) -> Vec<ScoreEntry> {
    entries.sort_by(|a, b| b.score.cmp(&a.score));
    entries
}
```

```tsx
interface ScoreEntry {
  name: string;
  score: number;
}

const sorted = await invoke<ScoreEntry[]>("sortScores", {
  entries: [
    { name: "Alice", score: 42 },
    { name: "Bob", score: 87 },
    { name: "Charlie", score: 63 },
  ],
});
// sorted[0].name === "Bob"
```

### Optional Arguments

Use `Option<T>` for arguments the frontend may or may not send:

```rust
#[tauri::command]
fn search_items(query: &str, limit: Option<usize>) -> Vec<String> {
    let limit = limit.unwrap_or(10);
    // ... perform search with the limit
    vec![format!("Results for '{}' (limit: {})", query, limit)]
}
```

```tsx
// Both of these work:
await invoke("searchItems", { query: "tauri" });
await invoke("searchItems", { query: "tauri", limit: 5 });
```

---

## 3. Return Values

### Simple Returns

Any type that implements `serde::Serialize` can be returned from a command:

```rust
#[tauri::command]
fn get_app_name() -> &'static str {
    "My Tauri App"
}

#[tauri::command]
fn get_random_number() -> u32 {
    rand::random::<u32>() % 100
}

#[tauri::command]
fn is_feature_enabled(feature: &str) -> bool {
    match feature {
        "dark_mode" => true,
        "notifications" => true,
        _ => false,
    }
}
```

### Returning Structs

```rust
#[derive(Serialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub cpu_count: usize,
    pub hostname: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        cpu_count: std::thread::available_parallelism()
            .map(|p| p.get())
            .unwrap_or(1),
        hostname: hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string()),
    }
}
```

```tsx
interface SystemInfo {
  os: string;
  arch: string;
  cpuCount: number;
  hostname: string;
}

function SystemInfoPanel() {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    invoke<SystemInfo>("getSystemInfo").then(setInfo);
  }, []);

  if (!info) return <p>Loading...</p>;

  return (
    <div>
      <p>OS: {info.os}</p>
      <p>Architecture: {info.arch}</p>
      <p>CPUs: {info.cpuCount}</p>
      <p>Hostname: {info.hostname}</p>
    </div>
  );
}
```

### Result Types and Error Handling

Most real commands can fail. Use `Result<T, E>` where `E` implements `Serialize`:

```rust
use serde::Serialize;

// A simple string error works for prototyping
#[tauri::command]
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err("Cannot divide by zero".to_string())
    } else {
        Ok(a / b)
    }
}
```

On the frontend, a command that returns `Err` causes the `invoke` promise to reject:

```tsx
async function handleDivide() {
  try {
    const result = await invoke<number>("divide", { a: 10, b: 0 });
    setResult(result);
  } catch (error) {
    // error is the string "Cannot divide by zero"
    setError(error as string);
  }
}
```

### Custom Error Types

String errors are fine for simple cases, but structured error types are better for production apps. The key requirement is that the error type must implement `Serialize`:

```rust
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
pub enum AppError {
    #[error("Item not found: {0}")]
    NotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Validation failed: {0}")]
    ValidationError(String),

    #[error("Internal error: {0}")]
    InternalError(String),
}

// For errors from libraries that don't implement Serialize,
// convert them to your own type:
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::InternalError(err.to_string())
    }
}

#[tauri::command]
fn read_config(path: &str) -> Result<String, AppError> {
    if path.is_empty() {
        return Err(AppError::ValidationError(
            "Path cannot be empty".to_string(),
        ));
    }
    std::fs::read_to_string(path).map_err(AppError::from)
}
```

On the frontend, the serialized error is a string by default (the `Display` impl from `thiserror`). If you want structured errors, you can serialize them as objects instead. See section 8 for a thorough pattern.

---

## 4. Async Commands

### Why Async?

Synchronous commands block the main thread. For quick operations (math, string formatting, reading small config), that is fine. But for anything that takes time — network requests, file I/O on large files, database queries — you should use async commands.

Tauri runs async commands on a thread pool via the Tokio runtime, so they do not block the UI.

### Basic Async Command

```rust
#[tauri::command]
async fn fetch_weather(city: String) -> Result<String, String> {
    // reqwest is an async HTTP client
    let url = format!(
        "https://api.weatherapi.com/v1/current.json?key=YOUR_KEY&q={}",
        city
    );

    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?;

    let body = response.text()
        .await
        .map_err(|e| e.to_string())?;

    Ok(body)
}
```

Notice two important things:
1. The function is `async fn`.
2. String parameters in async commands must be `String`, not `&str`. Borrowed references cannot live across `.await` points, so the data must be owned.

### Async File Operations

```rust
use tokio::fs;

#[tauri::command]
async fn read_large_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content)
        .await
        .map_err(|e| format!("Failed to write {}: {}", path, e))
}
```

```tsx
function FileEditor() {
  const [content, setContent] = useState("");
  const [filePath, setFilePath] = useState("");

  async function loadFile() {
    try {
      const text = await invoke<string>("readLargeFile", { path: filePath });
      setContent(text);
    } catch (err) {
      console.error("Failed to load:", err);
    }
  }

  async function saveFile() {
    try {
      await invoke("writeFile", { path: filePath, content });
    } catch (err) {
      console.error("Failed to save:", err);
    }
  }

  return (
    <div>
      <input
        value={filePath}
        onChange={(e) => setFilePath(e.target.value)}
        placeholder="File path..."
      />
      <button onClick={loadFile}>Load</button>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={20}
        cols={80}
      />
      <button onClick={saveFile}>Save</button>
    </div>
  );
}
```

### Expensive Computation in Async Commands

For CPU-heavy work, use `tokio::task::spawn_blocking` so you don't starve the async thread pool:

```rust
#[tauri::command]
async fn hash_file(path: String) -> Result<String, String> {
    // Move the heavy work onto a blocking thread
    tokio::task::spawn_blocking(move || {
        use sha2::{Sha256, Digest};
        let bytes = std::fs::read(&path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let hash = hasher.finalize();
        Ok(format!("{:x}", hash))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
```

### When to Use Sync vs Async

| Use sync | Use async |
|---|---|
| Pure calculations | File I/O |
| String formatting | Network requests |
| Reading small in-memory state | Database queries |
| Returning constants | Anything with `sleep` or timers |
| Simple struct construction | Heavy computation (with `spawn_blocking`) |

---

## 5. Managed State

Managed state lets you share data across all your commands without global variables. You register state with `app.manage()`, then extract it in any command using the `State<T>` parameter.

### Basic Read-Only State

```rust
use tauri::State;

struct AppConfig {
    api_base_url: String,
    max_retries: u32,
    app_name: String,
}

#[tauri::command]
fn get_config(config: State<AppConfig>) -> String {
    format!(
        "App: {}, API: {}, Retries: {}",
        config.app_name, config.api_base_url, config.max_retries
    )
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppConfig {
            api_base_url: "https://api.example.com".to_string(),
            max_retries: 3,
            app_name: "My App".to_string(),
        })
        .invoke_handler(tauri::generate_handler![get_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`State<AppConfig>` is an extractor — Tauri sees this special parameter and automatically injects the managed state. It does not appear as an argument on the frontend side.

### Mutable State with Mutex

`State<T>` gives you a shared reference (`&T`). To mutate state, wrap the interior data in a `Mutex`:

```rust
use std::sync::Mutex;
use serde::Serialize;
use tauri::State;

#[derive(Default)]
struct Counter {
    value: Mutex<i64>,
}

#[tauri::command]
fn increment(counter: State<Counter>) -> i64 {
    let mut val = counter.value.lock().unwrap();
    *val += 1;
    *val
}

#[tauri::command]
fn decrement(counter: State<Counter>) -> i64 {
    let mut val = counter.value.lock().unwrap();
    *val -= 1;
    *val
}

#[tauri::command]
fn get_count(counter: State<Counter>) -> i64 {
    *counter.value.lock().unwrap()
}

pub fn run() {
    tauri::Builder::default()
        .manage(Counter::default())
        .invoke_handler(tauri::generate_handler![increment, decrement, get_count])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    invoke<number>("getCount").then(setCount);
  }, []);

  async function handleIncrement() {
    const newCount = await invoke<number>("increment");
    setCount(newCount);
  }

  async function handleDecrement() {
    const newCount = await invoke<number>("decrement");
    setCount(newCount);
  }

  return (
    <div>
      <button onClick={handleDecrement}>-</button>
      <span>{count}</span>
      <button onClick={handleIncrement}>+</button>
    </div>
  );
}
```

### RwLock for Read-Heavy Workloads

If your state is read frequently but written rarely, `RwLock` performs better than `Mutex` because it allows multiple simultaneous readers:

```rust
use std::sync::RwLock;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UserSettings {
    theme: String,
    language: String,
    font_size: u32,
    notifications_enabled: bool,
}

struct SettingsStore {
    settings: RwLock<UserSettings>,
}

#[tauri::command]
fn get_settings(store: State<SettingsStore>) -> UserSettings {
    store.settings.read().unwrap().clone()
}

#[tauri::command]
fn update_theme(store: State<SettingsStore>, theme: String) {
    store.settings.write().unwrap().theme = theme;
}

#[tauri::command]
fn update_font_size(store: State<SettingsStore>, size: u32) {
    store.settings.write().unwrap().font_size = size;
}

pub fn run() {
    tauri::Builder::default()
        .manage(SettingsStore {
            settings: RwLock::new(UserSettings {
                theme: "light".to_string(),
                language: "en".to_string(),
                font_size: 14,
                notifications_enabled: true,
            }),
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            update_theme,
            update_font_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```tsx
interface UserSettings {
  theme: string;
  language: string;
  fontSize: number;
  notificationsEnabled: boolean;
}

function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    invoke<UserSettings>("getSettings").then(setSettings);
  }, []);

  async function changeTheme(theme: string) {
    await invoke("updateTheme", { theme });
    // Re-fetch to confirm the update
    const updated = await invoke<UserSettings>("getSettings");
    setSettings(updated);
  }

  if (!settings) return <p>Loading settings...</p>;

  return (
    <div>
      <h2>Settings</h2>
      <label>
        Theme:
        <select
          value={settings.theme}
          onChange={(e) => changeTheme(e.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </label>
    </div>
  );
}
```

---

## 6. State Patterns

### The AppState Struct Pattern

For most applications, a single `AppState` struct is the cleanest approach. It groups all your app-level state in one place:

```rust
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub username: String,
    pub email: String,
}

pub struct AppState {
    pub db_path: String,
    pub current_user: Mutex<Option<UserProfile>>,
    pub request_count: Mutex<u64>,
}

impl AppState {
    pub fn new(db_path: String) -> Self {
        Self {
            db_path,
            current_user: Mutex::new(None),
            request_count: Mutex::new(0),
        }
    }
}

#[tauri::command]
fn login(state: State<AppState>, username: String, email: String) -> UserProfile {
    let profile = UserProfile { username, email };
    *state.current_user.lock().unwrap() = Some(profile.clone());
    profile
}

#[tauri::command]
fn get_current_user(state: State<AppState>) -> Option<UserProfile> {
    state.current_user.lock().unwrap().clone()
}

#[tauri::command]
fn logout(state: State<AppState>) {
    *state.current_user.lock().unwrap() = None;
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new("/data/app.db".to_string()))
        .invoke_handler(tauri::generate_handler![login, get_current_user, logout])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```tsx
interface UserProfile {
  username: string;
  email: string;
}

function AuthPanel() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    invoke<UserProfile | null>("getCurrentUser").then(setUser);
  }, []);

  async function handleLogin() {
    const profile = await invoke<UserProfile>("login", {
      username: "alice",
      email: "alice@example.com",
    });
    setUser(profile);
  }

  async function handleLogout() {
    await invoke("logout");
    setUser(null);
  }

  if (!user) {
    return <button onClick={handleLogin}>Log in</button>;
  }

  return (
    <div>
      <p>Welcome, {user.username}!</p>
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}
```

### Multiple State Types

You can manage multiple distinct types when it makes sense to separate concerns:

```rust
pub struct DatabasePool {
    pub pool: sqlx::SqlitePool,
}

pub struct AppConfig {
    pub version: String,
    pub debug_mode: bool,
}

pub struct AuthTokens {
    pub access_token: Mutex<Option<String>>,
    pub refresh_token: Mutex<Option<String>>,
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppConfig {
            version: "1.0.0".to_string(),
            debug_mode: cfg!(debug_assertions),
        })
        .manage(AuthTokens {
            access_token: Mutex::new(None),
            refresh_token: Mutex::new(None),
        })
        // Multiple .manage() calls are fine
        .invoke_handler(tauri::generate_handler![...])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Commands can extract multiple state types
#[tauri::command]
fn debug_info(config: State<AppConfig>, tokens: State<AuthTokens>) -> String {
    let logged_in = tokens.access_token.lock().unwrap().is_some();
    format!(
        "v{} | debug={} | logged_in={}",
        config.version, config.debug_mode, logged_in
    )
}
```

### Initializing State with the Setup Hook

When state requires async initialization (database connections, loading from disk), use the `setup` hook:

```rust
use tauri::Manager;
use std::sync::Mutex;

pub struct AppState {
    pub settings: Mutex<serde_json::Value>,
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Load settings from a file during app startup
            let config_dir = app.path().app_config_dir()?;
            let config_path = config_dir.join("settings.json");

            let settings = if config_path.exists() {
                let content = std::fs::read_to_string(&config_path)
                    .unwrap_or_else(|_| "{}".to_string());
                serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
            } else {
                serde_json::json!({
                    "theme": "light",
                    "language": "en"
                })
            };

            app.manage(AppState {
                settings: Mutex::new(settings),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_settings])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> serde_json::Value {
    state.settings.lock().unwrap().clone()
}
```

### State with Database Connections

A common real-world pattern — managing a SQLite connection pool:

```rust
use std::sync::Mutex;
use tauri::{Manager, State};
use rusqlite::Connection;
use serde::Serialize;

pub struct Database {
    pub conn: Mutex<Connection>,
}

#[derive(Debug, Serialize)]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub body: String,
    pub created_at: String,
}

#[tauri::command]
fn list_notes(db: State<Database>) -> Result<Vec<Note>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, title, body, created_at FROM notes ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let notes = stmt
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                body: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(notes)
}

#[tauri::command]
fn create_note(db: State<Database>, title: String, body: String) -> Result<Note, String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO notes (title, body, created_at) VALUES (?1, ?2, datetime('now'))",
        rusqlite::params![title, body],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let created_at: String = conn
        .query_row("SELECT created_at FROM notes WHERE id = ?1", [id], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;

    Ok(Note {
        id,
        title,
        body,
        created_at,
    })
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("app.db");

            let conn = Connection::open(&db_path)
                .expect("Failed to open database");

            conn.execute(
                "CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )",
                [],
            )
            .expect("Failed to create notes table");

            app.manage(Database {
                conn: Mutex::new(conn),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_notes, create_note])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```tsx
interface Note {
  id: number;
  title: string;
  body: string;
  createdAt: string;
}

function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    const data = await invoke<Note[]>("listNotes");
    setNotes(data);
  }

  async function handleCreate() {
    try {
      await invoke("createNote", { title, body });
      setTitle("");
      setBody("");
      await loadNotes();
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  }

  return (
    <div>
      <h1>Notes</h1>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Body"
      />
      <button onClick={handleCreate}>Add Note</button>

      <ul>
        {notes.map((note) => (
          <li key={note.id}>
            <strong>{note.title}</strong>
            <p>{note.body}</p>
            <small>{note.createdAt}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 7. Command Context

Commands can access more than just arguments and state. Tauri injects special context parameters when it sees their types in the function signature.

### AppHandle

`AppHandle` gives you access to the full application API — emitting events, accessing state, managing windows, resolving paths:

```rust
use tauri::{AppHandle, Manager};

#[tauri::command]
fn get_data_dir(app: AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn emit_notification(app: AppHandle, message: String) -> Result<(), String> {
    app.emit("notification", message)
        .map_err(|e| e.to_string())
}
```

```tsx
async function showDataDir() {
  const dir = await invoke<string>("getDataDir");
  console.log("Data directory:", dir);
}
```

### Window

Access the calling window to manipulate it — set title, resize, minimize, or query its label:

```rust
use tauri::Window;

#[tauri::command]
fn set_window_title(window: Window, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_window_label(window: Window) -> String {
    window.label().to_string()
}

#[tauri::command]
fn toggle_fullscreen(window: Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| e.to_string())
}
```

```tsx
async function renameWindow() {
  await invoke("setWindowTitle", { title: "My Custom Title" });
}

async function handleFullscreen() {
  await invoke("toggleFullscreen");
}
```

### Combining Context Parameters

You can use multiple context extractors together with regular arguments:

```rust
use tauri::{AppHandle, State, Window, Manager};
use std::sync::Mutex;

pub struct RequestLog {
    pub entries: Mutex<Vec<String>>,
}

#[tauri::command]
fn tracked_operation(
    app: AppHandle,
    window: Window,
    log: State<RequestLog>,
    operation: String,
) -> Result<String, String> {
    // Log which window called what operation
    let entry = format!(
        "Window '{}' requested '{}'",
        window.label(),
        operation
    );
    log.entries.lock().unwrap().push(entry.clone());

    // Emit an event to all windows
    app.emit("operation_logged", &entry)
        .map_err(|e| e.to_string())?;

    Ok(format!("Operation '{}' completed", operation))
}
```

```tsx
const result = await invoke<string>("trackedOperation", {
  operation: "export_data",
});
```

The context parameters (`app`, `window`, `log`) are invisible to the frontend. Only `operation` needs to be passed from JavaScript.

### Webview and WebviewWindow

In Tauri v2, you also have access to `Webview` and `WebviewWindow`:

```rust
use tauri::Webview;

#[tauri::command]
fn get_webview_url(webview: Webview) -> String {
    webview.url().map(|u| u.to_string()).unwrap_or_default()
}
```

---

## 8. Validation and Error Handling

Production-quality commands need validation on the Rust side. Never trust frontend input.

### Input Validation Pattern

```rust
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CommandError {
    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

// Tauri commands need the error to be serializable.
// We serialize it as a structured object so the frontend
// can inspect the error type programmatically.
impl Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("CommandError", 2)?;

        let (kind, message) = match self {
            CommandError::Validation(msg) => ("validation", msg.as_str()),
            CommandError::NotFound(msg) => ("not_found", msg.as_str()),
            CommandError::Database(msg) => ("database", msg.as_str()),
            CommandError::Io(err) => {
                let msg_string = err.to_string();
                // We need a reference that lives long enough
                state.serialize_field("kind", "io")?;
                state.serialize_field("message", &msg_string)?;
                return state.end();
            }
        };

        state.serialize_field("kind", kind)?;
        state.serialize_field("message", message)?;
        state.end()
    }
}

type CmdResult<T> = Result<T, CommandError>;

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub email: String,
    pub age: u32,
}

impl CreateUserRequest {
    fn validate(&self) -> CmdResult<()> {
        if self.username.trim().is_empty() {
            return Err(CommandError::Validation(
                "Username cannot be empty".to_string(),
            ));
        }
        if self.username.len() < 3 {
            return Err(CommandError::Validation(
                "Username must be at least 3 characters".to_string(),
            ));
        }
        if self.username.len() > 30 {
            return Err(CommandError::Validation(
                "Username must be 30 characters or fewer".to_string(),
            ));
        }
        if !self.email.contains('@') || !self.email.contains('.') {
            return Err(CommandError::Validation(
                "Invalid email address".to_string(),
            ));
        }
        if self.age < 13 {
            return Err(CommandError::Validation(
                "User must be at least 13 years old".to_string(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct User {
    pub id: u32,
    pub username: String,
    pub email: String,
    pub age: u32,
}

#[tauri::command]
fn create_user(request: CreateUserRequest) -> CmdResult<User> {
    // Always validate first
    request.validate()?;

    // Proceed with creation (database insert in a real app)
    Ok(User {
        id: 1,
        username: request.username,
        email: request.email,
        age: request.age,
    })
}
```

```tsx
interface CommandError {
  kind: "validation" | "not_found" | "database" | "io";
  message: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  age: number;
}

function CreateUserForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<User | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const user = await invoke<User>("createUser", {
        request: {
          username,
          email,
          age: parseInt(age, 10),
        },
      });
      setSuccess(user);
    } catch (err) {
      // The error arrives as the serialized CommandError object
      const cmdErr = err as CommandError;
      if (cmdErr.kind === "validation") {
        setError(cmdErr.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
        console.error("Command error:", cmdErr);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        value={age}
        onChange={(e) => setAge(e.target.value)}
        placeholder="Age"
        type="number"
      />
      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>Created user: {success.username}</p>}
      <button type="submit">Create User</button>
    </form>
  );
}
```

### Converting Library Errors

Many Rust libraries return their own error types. Convert them with `From` implementations or `.map_err()`:

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Network error: {0}")]
    Network(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Serialization(err.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Network(err.to_string())
    }
}

// Now you can use ? freely and errors convert automatically
#[tauri::command]
async fn fetch_and_store(url: String, db: State<'_, Database>) -> Result<String, AppError> {
    let response = reqwest::get(&url).await?;       // Network error? Converted.
    let body = response.text().await?;               // Network error? Converted.
    let data: serde_json::Value = serde_json::from_str(&body)?; // Parse error? Converted.

    let conn = db.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO cache (url, data) VALUES (?1, ?2)",
        rusqlite::params![url, body],
    )?;  // Database error? Converted.

    Ok(data.to_string())
}
```

### Defensive Validation Helper

A reusable pattern for validating multiple fields at once:

```rust
pub struct Validator {
    errors: Vec<String>,
}

impl Validator {
    pub fn new() -> Self {
        Self { errors: Vec::new() }
    }

    pub fn check(&mut self, condition: bool, message: &str) -> &mut Self {
        if !condition {
            self.errors.push(message.to_string());
        }
        self
    }

    pub fn finish(&self) -> CmdResult<()> {
        if self.errors.is_empty() {
            Ok(())
        } else {
            Err(CommandError::Validation(self.errors.join("; ")))
        }
    }
}

#[tauri::command]
fn update_profile(name: String, bio: String, website: String) -> CmdResult<()> {
    Validator::new()
        .check(!name.trim().is_empty(), "Name is required")
        .check(name.len() <= 100, "Name must be 100 characters or fewer")
        .check(bio.len() <= 500, "Bio must be 500 characters or fewer")
        .check(
            website.is_empty() || website.starts_with("https://"),
            "Website must start with https://",
        )
        .finish()?;

    // ... save the profile
    Ok(())
}
```

---

## 9. Coding Challenges

### Challenge 1: Key-Value Store

**Build a persistent key-value store with full CRUD commands.**

Your app should function like a simple settings panel where users can create, read, update, and delete arbitrary key-value pairs. The data should live in managed state.

**Requirements:**
- Create four commands: `kv_set`, `kv_get`, `kv_delete`, `kv_list`
- Use a `HashMap<String, String>` wrapped in a `Mutex` as managed state
- `kv_get` should return a `Result` with a "not found" error if the key does not exist
- `kv_list` should return all key-value pairs as a `Vec<(String, String)>`
- Build a React UI with an input form for setting values, a display table for all pairs, and delete buttons

**Hints:**
- `std::collections::HashMap` is your friend
- Remember to derive `Serialize` for any struct you return to the frontend
- The `HashMap::entry` API is useful for insert-or-update patterns

---

### Challenge 2: Command-Line Calculator

**Build a calculator where all math happens in Rust, with history tracking.**

The frontend sends expressions to the backend. The backend parses and evaluates them, stores each calculation in a history list, and returns the result.

**Requirements:**
- A `calculate` command that accepts an expression string like `"2 + 3"` or `"10 * 5"` and returns the numeric result
- Support at least: `+`, `-`, `*`, `/`
- Return proper errors for division by zero and invalid expressions
- A `get_history` command that returns the last N calculations (stored in managed state)
- A `clear_history` command
- React UI with an input field, result display, and scrollable history panel

**Hints:**
- You can split the expression string and parse the operator and operands
- Store history as `Vec<CalculationEntry>` where each entry has the expression, result, and timestamp
- Use `chrono::Local::now()` for timestamps (add the `chrono` crate)

---

### Challenge 3: Task Queue with Async Processing

**Build a background task queue where the frontend submits jobs and can check their status.**

This simulates real-world patterns like file processing, data imports, or report generation.

**Requirements:**
- A `submit_task` command that accepts a task description and duration (in seconds), assigns an ID, and returns immediately
- Tasks should process in the background using `tokio::spawn`
- A `get_task_status` command that returns the current status of a task: `Pending`, `Running`, or `Completed`
- A `list_tasks` command that returns all tasks with their statuses
- Managed state should track all tasks using a `HashMap<u32, TaskInfo>` behind an `Arc<Mutex<...>>`
- React UI showing a submit form and a live status dashboard that polls for updates

**Hints:**
- Use `Arc<Mutex<HashMap<...>>>` so the spawned task can update its own status
- `tokio::time::sleep` can simulate work
- Use `tokio::spawn` inside the async command to start the background work
- Poll from the frontend with `setInterval` and clear it when all tasks are done

---

### Challenge 4: Multi-Window Chat Relay

**Build an app where multiple windows can send messages through the Rust backend.**

Each window identifies itself, sends messages to the backend, and the backend stores a shared message log that any window can read.

**Requirements:**
- A `send_message` command that uses the `Window` context to determine the sender, accepts a message body, and stores it in managed state
- A `get_messages` command that returns all messages with sender window labels and timestamps
- Messages should be stored in a `Vec<ChatMessage>` wrapped in `RwLock`
- Use `AppHandle` to emit an event to all windows when a new message arrives
- React UI with a message list and input field
- Open a second window from Rust (using the `setup` hook or a command) to test multi-window messaging

**Hints:**
- `window.label()` gives you the window's identifier
- `app.emit("event_name", payload)` broadcasts to all windows
- Listen for events on the frontend with `listen` from `@tauri-apps/api/event`
- Create a new window with `WebviewWindowBuilder::new()`

---

### Challenge 5: Validated Contact Book

**Build a contact book with thorough validation, structured error handling, and search.**

This challenge combines everything: complex structs, custom error types, validation, mutable state, and async commands.

**Requirements:**
- Define a `Contact` struct with: `id`, `first_name`, `last_name`, `email`, `phone` (optional), `notes` (optional)
- Implement a custom `ContactError` enum with variants: `ValidationError`, `DuplicateEmail`, `NotFound`
- Serialize errors as structured objects (`{ kind, message }`) to the frontend
- Commands: `add_contact`, `update_contact`, `delete_contact`, `get_contact`, `list_contacts`, `search_contacts`
- Validation rules: names must be 1-50 characters, email must be valid format, phone (if provided) must be digits only and 7-15 characters
- `search_contacts` should accept a query string and search across first name, last name, and email (case-insensitive)
- React UI with a contact list, add/edit form with inline validation errors, search bar, and delete confirmation

**Hints:**
- Use `str::to_lowercase()` and `str::contains()` for case-insensitive search
- Give each contact a unique ID using an atomic counter: `std::sync::atomic::AtomicU32`
- The `validate` method pattern from section 8 works well here
- On the frontend, create a reusable `useContacts` hook that encapsulates all the `invoke` calls
